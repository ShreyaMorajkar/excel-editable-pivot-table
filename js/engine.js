/**
 * Multidimensional Pivot Calculation & Disaggregation Engine
 * Handles dynamic row/column hierarchies, tree grouping, weighted averages,
 * chronological time-series inventory chaining, dual-mode formula evaluation,
 * and top-down disaggregation.
 */

class PivotEngine {
  constructor(options = {}) {
    this.formulaEngine = new FormulaEngine();
    this.rawRows = [];
    this.headers = [];

    // Pivot Configuration State
    this.rowDimensions = options.rowDimensions || ['Region', 'Country', 'ProductFamily', 'Item'];
    this.columnDimensions = options.columnDimensions || ['Year', 'Month'];
    this.filters = options.filters || {}; // { dimension: Set of selected values }
    this.globalParams = options.globalParams || { n: 4 };

    // Measures Definitions
    // type: 'BASE' | 'CALCULATED'
    // evalMode: 'LEAF_ROLLUP' | 'POST_AGGREGATE'
    this.measures = [
      {
        id: 'Price',
        label: 'Price ($)',
        type: 'BASE',
        aggType: 'WEIGHTED_AVG',
        weightBy: 'Forecast',
        editable: true,
        format: 'currency'
      },
      {
        id: 'ActualSales',
        label: 'Actual Sales',
        type: 'BASE',
        aggType: 'SUM',
        editable: true,
        format: 'number'
      },
      {
        id: 'Forecast',
        label: 'Forecast Demand',
        type: 'BASE',
        aggType: 'SUM',
        editable: true,
        format: 'number'
      },
      {
        id: 'Supply',
        label: 'Supply / Production',
        type: 'BASE',
        aggType: 'SUM',
        editable: true,
        format: 'number'
      },
      {
        id: 'Revenue',
        label: 'Revenue ($)',
        type: 'CALCULATED',
        formula: '[Forecast] * [Price]',
        evalMode: 'POST_AGGREGATE', // Revenue at summary is Demand * Weighted Price
        editable: false,
        format: 'currency'
      },
      {
        id: 'PrevInventory',
        label: 'Prev Bucket Inv',
        type: 'INVENTORY_PREV',
        editable: false,
        format: 'number'
      },
      {
        id: 'EndingInventory',
        label: 'Ending Inventory',
        type: 'INVENTORY_END',
        editable: false,
        format: 'number'
      }
    ];

    // User-created Custom Calculated Measures
    this.customMeasures = [];

    // Node Expand/Collapse State: Map of nodeKey -> boolean (true = expanded)
    this.expandedNodes = new Map();
    // Default root level expanded
    this.expandedNodes.set('ROOT', true);

    // Column Hierarchy Expand/Collapse State: Map of colNodeKey -> boolean (true = expanded)
    this.expandedColNodes = new Map();

    // Active Visible Measures (ids)
    this.activeMeasureIds = ['Price', 'ActualSales', 'Forecast', 'Supply', 'Revenue', 'PrevInventory', 'EndingInventory'];

    // Sorted chronological time periods cache
    this.timePeriods = [];
  }

  toggleColNode(colNodeKey) {
    const current = this.isColNodeExpanded(colNodeKey);
    this.expandedColNodes.set(colNodeKey, !current);
  }

  isColNodeExpanded(colNodeKey) {
    // Default to true (expanded) if not explicitly set
    if (!this.expandedColNodes.has(colNodeKey)) return true;
    return this.expandedColNodes.get(colNodeKey) === true;
  }

  /**
   * Returns active time periods taking into account collapsible column dimensions (e.g. Year)
   */
  getActiveTimePeriods() {
    const basePeriods = this.getSortedTimePeriods();
    if (this.columnDimensions.length <= 1) {
      return basePeriods.map(p => ({
        ...p,
        isCollapsed: false,
        topDimKey: p.colValues[0],
        childColKeys: [p.colKey]
      }));
    }

    // Group by top-level dimension (e.g. Year)
    const groups = new Map();
    basePeriods.forEach(p => {
      const topVal = p.colValues[0] || '(Blank)';
      if (!groups.has(topVal)) {
        groups.set(topVal, []);
      }
      groups.get(topVal).push(p);
    });

    const result = [];
    groups.forEach((periods, topVal) => {
      const isExp = this.isColNodeExpanded(topVal);
      if (isExp) {
        periods.forEach((p, idx) => {
          result.push({
            ...p,
            topDimKey: topVal,
            isCollapsed: false,
            isFirstInGroup: idx === 0,
            groupSpan: periods.length,
            childColKeys: [p.colKey]
          });
        });
      } else {
        // Collapsed column summary for this top dimension
        const collapsedKey = `${topVal}___COLLAPSED_TOTAL`;
        const collapsedColValues = [topVal, 'Total'];
        result.push({
          colKey: collapsedKey,
          colValues: collapsedColValues,
          topDimKey: topVal,
          isCollapsed: true,
          isFirstInGroup: true,
          groupSpan: 1,
          childColKeys: periods.map(p => p.colKey),
          firstPeriodColKey: periods[0].colKey,
          lastPeriodColKey: periods[periods.length - 1].colKey
        });
      }
    });

    return result;
  }

  setData(csvParsed) {
    this.headers = csvParsed.headers || [];
    this.rawRows = csvParsed.rows ? JSON.parse(JSON.stringify(csvParsed.rows)) : [];
    this.recomputeAll();
  }

  setPivotConfig({ rowDimensions, columnDimensions, activeMeasureIds, filters, globalParams }) {
    if (rowDimensions) this.rowDimensions = [...rowDimensions];
    if (columnDimensions) this.columnDimensions = [...columnDimensions];
    if (activeMeasureIds) this.activeMeasureIds = [...activeMeasureIds];
    if (filters) this.filters = { ...filters };
    if (globalParams) this.globalParams = { ...this.globalParams, ...globalParams };
  }

  addCustomMeasure(customMeasure) {
    // customMeasure = { id, label, formula, evalMode: 'LEAF_ROLLUP' | 'POST_AGGREGATE', params: { n: 4 } }
    const existingIdx = this.customMeasures.findIndex(m => m.id === customMeasure.id);
    if (existingIdx >= 0) {
      this.customMeasures[existingIdx] = customMeasure;
    } else {
      this.customMeasures.push(customMeasure);
    }
    if (!this.activeMeasureIds.includes(customMeasure.id)) {
      this.activeMeasureIds.push(customMeasure.id);
    }
  }

  removeCustomMeasure(id) {
    this.customMeasures = this.customMeasures.filter(m => m.id !== id);
    this.activeMeasureIds = this.activeMeasureIds.filter(mid => mid !== id);
  }

  getAllMeasures() {
    return [...this.measures, ...this.customMeasures];
  }

  getMeasureById(id) {
    return this.getAllMeasures().find(m => m.id === id);
  }

  /**
   * Sorts time periods chronologically
   */
  getSortedTimePeriods() {
    const monthOrder = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
      'q1': 1, 'q2': 4, 'q3': 7, 'q4': 10
    };

    const periodMap = new Map();

    this.rawRows.forEach(row => {
      const colValues = this.columnDimensions.map(dim => String(row[dim] || ''));
      const colKey = colValues.join('___');

      if (!periodMap.has(colKey)) {
        let sortScore = 0;
        const year = parseFloat(row['Year'] || 0) || 0;
        sortScore += year * 10000;

        const q = String(row['Quarter'] || '').toLowerCase();
        if (monthOrder[q]) sortScore += monthOrder[q] * 100;

        const m = String(row['Month'] || '').toLowerCase();
        if (monthOrder[m]) sortScore += monthOrder[m];

        periodMap.set(colKey, {
          colKey,
          colValues,
          sortScore
        });
      }
    });

    const sorted = Array.from(periodMap.values()).sort((a, b) => a.sortScore - b.sortScore);
    this.timePeriods = sorted.map(s => s.colKey);
    return sorted;
  }

  /**
   * Builds the multi-level time-series inventory series map for all atomic series
   */
  recomputeInventoryFlows() {
    // Determine unique series key excluding column dimensions
    const seriesMap = new Map();
    const sortedPeriods = this.getSortedTimePeriods();

    // Group raw rows into time series by row coordinates
    this.rawRows.forEach(row => {
      // Create a unique leaf series key using all row dimensions
      const seriesKey = this.rowDimensions.map(dim => row[dim] || '').join('___');
      const colKey = this.columnDimensions.map(dim => row[dim] || '').join('___');

      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, new Map());
      }
      seriesMap.get(seriesKey).set(colKey, row);
    });

    // For each series, walk chronologically and chain PrevInventory and EndingInventory
    seriesMap.forEach((colMap, seriesKey) => {
      let runningEndingInventory = 0;
      let isFirstPeriod = true;

      sortedPeriods.forEach(periodObj => {
        const colKey = periodObj.colKey;
        const row = colMap.get(colKey);

        if (row) {
          let prevInv = 0;
          if (isFirstPeriod) {
            prevInv = parseFloat(row['InitialInventory']) || 0;
            isFirstPeriod = false;
          } else {
            prevInv = runningEndingInventory;
          }

          const supply = parseFloat(row['Supply']) || 0;
          const demand = parseFloat(row['Forecast'] !== undefined ? row['Forecast'] : row['ActualSales']) || 0;
          const endingInv = prevInv + supply - demand;

          row.PrevInventory = prevInv;
          row.EndingInventory = endingInv;
          runningEndingInventory = endingInv;
        }
      });
    });
  }

  /**
   * Pre-calculates Leaf-Level custom formulas directly on raw rows
   */
  recomputeLeafFormulas() {
    const leafMeasures = this.customMeasures.filter(m => m.evalMode === 'LEAF_ROLLUP');
    if (leafMeasures.length === 0) return;

    this.rawRows.forEach(row => {
      leafMeasures.forEach(meas => {
        try {
          const ast = this.formulaEngine.parse(meas.formula);
          const val = this.formulaEngine.evaluateAST(ast, {
            vars: row,
            params: { ...this.globalParams, ...(meas.params || {}) }
          });
          row[meas.id] = val;
        } catch (e) {
          row[meas.id] = 0;
        }
      });
    });
  }

  recomputeAll() {
    this.recomputeInventoryFlows();
    this.recomputeLeafFormulas();
  }

  /**
   * Builds the Pivot Tree
   */
  buildPivotGrid() {
    this.recomputeAll();

    const activePeriods = this.getActiveTimePeriods();
    const rootNode = {
      key: 'ROOT',
      dimName: 'ALL',
      dimValue: 'Total',
      level: -1,
      children: new Map(),
      rows: [],
      aggregatedData: {} // colKey -> measureId -> value
    };

    // Filter raw rows
    const filteredRows = this.rawRows.filter(row => {
      for (const [dim, allowedSet] of Object.entries(this.filters)) {
        if (allowedSet && allowedSet.size > 0 && !allowedSet.has(row[dim])) {
          return false;
        }
      }
      return true;
    });

    // Insert rows into tree
    filteredRows.forEach(row => {
      let currentNode = rootNode;
      currentNode.rows.push(row);

      this.rowDimensions.forEach((dimName, level) => {
        const val = row[dimName] !== undefined ? String(row[dimName]) : '(Blank)';
        const nodeKey = (currentNode.key === 'ROOT' ? '' : currentNode.key + ' > ') + `${dimName}:${val}`;

        if (!currentNode.children.has(val)) {
          currentNode.children.set(val, {
            key: nodeKey,
            dimName,
            dimValue: val,
            level,
            parent: currentNode,
            children: new Map(),
            rows: [],
            aggregatedData: {}
          });
        }
        currentNode = currentNode.children.get(val);
        currentNode.rows.push(row);
      });
    });

    // Aggregate measures on all tree nodes
    this.aggregateTreeNode(rootNode, activePeriods);

    return {
      rootNode,
      timePeriods: activePeriods,
      columnDimensions: this.columnDimensions,
      rowDimensions: this.rowDimensions,
      activeMeasures: this.activeMeasureIds.map(id => this.getMeasureById(id)).filter(Boolean)
    };
  }

  /**
   * Recursively aggregates base measures and evaluates formulas on node
   */
  aggregateTreeNode(node, activePeriods) {
    // First recurse children
    node.children.forEach(child => this.aggregateTreeNode(child, activePeriods));

    const isLeaf = node.children.size === 0;
    node.isLeaf = isLeaf;
    node.aggregatedData = {};

    activePeriods.forEach(period => {
      const colKey = period.colKey;
      const childKeysSet = new Set(period.childColKeys || [colKey]);

      const matchingRows = node.rows.filter(row => {
        const rowColKey = this.columnDimensions.map(d => row[d] || '').join('___');
        return childKeysSet.has(rowColKey);
      });

      const data = {};

      // 1. Aggregate Base Numerical Measures
      let sumSales = 0;
      let sumForecast = 0;
      let sumSupply = 0;
      let sumWeightedPriceNumerator = 0;
      let sumPriceWeightUnits = 0;
      let sumPrevInv = 0;
      let sumEndingInv = 0;

      matchingRows.forEach(row => {
        const sales = parseFloat(row.ActualSales) || 0;
        const forecast = parseFloat(row.Forecast) || 0;
        const price = parseFloat(row.Price) || 0;
        const supply = parseFloat(row.Supply) || 0;

        sumSales += sales;
        sumForecast += forecast;
        sumSupply += supply;

        // Price weighting by Forecast (or Sales if Forecast is 0)
        const weight = forecast > 0 ? forecast : (sales > 0 ? sales : 1);
        sumWeightedPriceNumerator += (price * weight);
        sumPriceWeightUnits += weight;
      });

      // Inventory aggregation
      if (period.isCollapsed) {
        // PrevInventory from earliest period, EndingInventory from latest period
        const firstPeriodRows = node.rows.filter(row => {
          const rowColKey = this.columnDimensions.map(d => row[d] || '').join('___');
          return rowColKey === period.firstPeriodColKey;
        });
        const lastPeriodRows = node.rows.filter(row => {
          const rowColKey = this.columnDimensions.map(d => row[d] || '').join('___');
          return rowColKey === period.lastPeriodColKey;
        });
        sumPrevInv = firstPeriodRows.reduce((sum, r) => sum + (parseFloat(r.PrevInventory) || 0), 0);
        sumEndingInv = lastPeriodRows.reduce((sum, r) => sum + (parseFloat(r.EndingInventory) || 0), 0);
      } else {
        sumPrevInv = matchingRows.reduce((sum, r) => sum + (parseFloat(r.PrevInventory) || 0), 0);
        sumEndingInv = matchingRows.reduce((sum, r) => sum + (parseFloat(r.EndingInventory) || 0), 0);
      }

      data['ActualSales'] = sumSales;
      data['Forecast'] = sumForecast;
      data['Supply'] = sumSupply;
      data['PrevInventory'] = sumPrevInv;
      data['EndingInventory'] = sumEndingInv;

      // Weighted Average Price calculation
      data['Price'] = sumPriceWeightUnits > 0 ? (sumWeightedPriceNumerator / sumPriceWeightUnits) : (matchingRows.length > 0 ? (matchingRows[0].Price || 0) : 0);

      // Revenue = Demand * Weighted Price
      data['Revenue'] = sumForecast * data['Price'];

      // 2. Leaf-Rollup Custom Measures
      this.customMeasures.filter(m => m.evalMode === 'LEAF_ROLLUP').forEach(m => {
        let sumLeaf = 0;
        matchingRows.forEach(row => {
          sumLeaf += (parseFloat(row[m.id]) || 0);
        });
        data[m.id] = sumLeaf;
      });

      // 3. Post-Aggregate Custom Measures (Directly evaluate formula on node's aggregated data dictionary)
      this.customMeasures.filter(m => m.evalMode === 'POST_AGGREGATE').forEach(m => {
        try {
          const ast = this.formulaEngine.parse(m.formula);
          const val = this.formulaEngine.evaluateAST(ast, {
            vars: data,
            params: { ...this.globalParams, ...(m.params || {}) },
            aliases: {
              msr1: 'Forecast',
              msr2: 'ActualSales',
              msr3: 'Price',
              msr4: 'Supply',
              msr5: 'Revenue',
              sales: 'ActualSales',
              demand: 'Forecast',
              inventory: 'EndingInventory'
            }
          });
          data[m.id] = val;
        } catch (e) {
          data[m.id] = 0;
        }
      });

      node.aggregatedData[colKey] = data;
    });
  }

  /**
   * Top-Down Disaggregation & In-Cell Edit Handler
   */
  updateCellValue({ node, colKey, measureId, newValue }) {
    if (newValue === null || newValue === undefined) return false;
    const cleanStr = String(newValue).replace(/[\$,]/g, '').trim();
    const numVal = parseFloat(cleanStr);
    if (isNaN(numVal)) return false;

    // Filter node's rows matching this column time bucket (including collapsed totals)
    const targetRows = node.rows.filter(row => {
      const rowColKey = this.columnDimensions.map(d => row[d] || '').join('___');
      if (colKey.endsWith('___COLLAPSED_TOTAL')) {
        const topVal = colKey.replace('___COLLAPSED_TOTAL', '');
        return String(row[this.columnDimensions[0]]) === topVal;
      }
      return rowColKey === colKey;
    });

    if (targetRows.length === 0) return false;

    if (node.isLeaf) {
      // Direct Leaf Node Edit
      targetRows.forEach(row => {
        row[measureId] = numVal;
      });
    } else {
      // Disaggregate to Child Rows
      if (measureId === 'Forecast' || measureId === 'ActualSales' || measureId === 'Supply') {
        const oldTotal = targetRows.reduce((sum, r) => sum + (parseFloat(r[measureId]) || 0), 0);

        if (oldTotal > 0) {
          // Proportional distribution
          const ratio = numVal / oldTotal;
          targetRows.forEach(row => {
            row[measureId] = (parseFloat(row[measureId]) || 0) * ratio;
          });
        } else {
          // Equal distribution if previous total was 0
          const equalShare = numVal / targetRows.length;
          targetRows.forEach(row => {
            row[measureId] = equalShare;
          });
        }
      } else if (measureId === 'Price') {
        // Disaggregate Price change by adjusting child prices proportionally
        const oldPrice = node.aggregatedData[colKey]?.Price || 0;
        if (oldPrice > 0) {
          const ratio = numVal / oldPrice;
          targetRows.forEach(row => {
            row.Price = (parseFloat(row.Price) || 0) * ratio;
          });
        } else {
          targetRows.forEach(row => {
            row.Price = numVal;
          });
        }
      } else {
        // Generic measure disaggregation
        const oldTotal = targetRows.reduce((sum, r) => sum + (parseFloat(r[measureId]) || 0), 0);
        const ratio = oldTotal > 0 ? numVal / oldTotal : 1 / targetRows.length;
        targetRows.forEach(row => {
          row[measureId] = oldTotal > 0 ? (parseFloat(row[measureId]) || 0) * ratio : numVal * ratio;
        });
      }
    }

    // Recompute all dependencies, inventory flows, and rollups
    this.recomputeAll();
    return true;
  }

  toggleNode(nodeKey) {
    const isExp = this.isNodeExpanded(nodeKey);
    this.expandedNodes.set(nodeKey, !isExp);
  }

  isNodeExpanded(nodeKey) {
    if (!this.expandedNodes.has(nodeKey)) {
      return true;
    }
    return this.expandedNodes.get(nodeKey) === true;
  }

  expandAll() {
    const walk = (node) => {
      this.expandedNodes.set(node.key, true);
      node.children.forEach(walk);
    };
    const { rootNode } = this.buildPivotGrid();
    walk(rootNode);
  }

  collapseAll() {
    this.expandedNodes.clear();
    this.expandedNodes.set('ROOT', false);
  }
}

window.PivotEngine = PivotEngine;
