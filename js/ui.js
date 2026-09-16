/**
 * UI Renderer, In-Cell Editor, Drag & Drop Field Manager, and Modal Controller
 */

class PivotUI {
  constructor(engine) {
    this.engine = engine;
    this.selectedCell = null; // { nodeKey, colKey, measureId, element }
    this.editingCell = null;
    this.measurePlacement = 'ROWS'; // 'ROWS' | 'COLS'
    this.draggedField = null;

    this.initDOMReferences();
    this.attachEventListeners();
    this.initSidebarFields();
  }

  initDOMReferences() {
    this.pivotTable = document.getElementById('pivotTable');
    this.gridViewport = document.getElementById('gridViewport');
    this.pivotSidebar = document.getElementById('pivotSidebar');
    this.activeCellAddress = document.getElementById('activeCellAddress');
    this.formulaBarInput = document.getElementById('formulaBarInput');
    this.statusMessage = document.getElementById('statusMessage');
    this.statSelected = document.getElementById('statSelected');
    this.statAvg = document.getElementById('statAvg');
    this.statSum = document.getElementById('statSum');

    // Drag and Drop Zones
    this.availableFieldsList = document.getElementById('availableFieldsList');
    this.zoneFilters = document.getElementById('zoneFilters');
    this.zoneColumns = document.getElementById('zoneColumns');
    this.zoneRows = document.getElementById('zoneRows');
    this.zoneMeasures = document.getElementById('zoneMeasures');

    // Modals
    this.formulaModal = document.getElementById('formulaModal');
    this.importModal = document.getElementById('importModal');
    this.exportModal = document.getElementById('exportModal');
  }

  attachEventListeners() {
    // Toolbar buttons
    document.getElementById('btnToggleSidebar')?.addEventListener('click', () => {
      this.pivotSidebar.style.display = this.pivotSidebar.style.display === 'none' ? 'flex' : 'none';
    });

    document.getElementById('btnCloseSidebar')?.addEventListener('click', () => {
      this.pivotSidebar.style.display = 'none';
    });

    document.getElementById('btnExpandAll')?.addEventListener('click', () => {
      this.engine.expandAll();
      this.render();
    });

    document.getElementById('btnCollapseAll')?.addEventListener('click', () => {
      this.engine.collapseAll();
      this.render();
    });

    document.getElementById('btnResetData')?.addEventListener('click', () => {
      const parsed = CSVUtils.parse(window.DEFAULT_CSV_DATA);
      this.engine.setData(parsed);
      this.initSidebarFields();
      this.render();
      this.showStatus('Reset dataset to default sample data.');
    });

    document.getElementById('measurePlacementSelect')?.addEventListener('change', (e) => {
      this.measurePlacement = e.target.value;
      this.render();
    });

    // Global param n
    document.getElementById('globalParamN')?.addEventListener('change', (e) => {
      const nVal = parseFloat(e.target.value) || 0;
      this.engine.globalParams.n = nVal;
      this.engine.recomputeAll();
      this.render();
    });

    // Modals open/close
    document.getElementById('btnAddFormula')?.addEventListener('click', () => this.openFormulaModal());
    document.getElementById('btnCloseFormulaModal')?.addEventListener('click', () => this.closeModal(this.formulaModal));
    document.getElementById('btnCancelFormulaModal')?.addEventListener('click', () => this.closeModal(this.formulaModal));

    document.getElementById('btnImportCSV')?.addEventListener('click', () => this.openImportModal());
    document.getElementById('btnCloseImportModal')?.addEventListener('click', () => this.closeModal(this.importModal));
    document.getElementById('btnCancelImport')?.addEventListener('click', () => this.closeModal(this.importModal));

    document.getElementById('btnExportCSV')?.addEventListener('click', () => this.openExportModal('PIVOT'));
    document.getElementById('btnExportRawCSV')?.addEventListener('click', () => this.openExportModal('RAW'));
    document.getElementById('btnCloseExportModal')?.addEventListener('click', () => this.closeModal(this.exportModal));

    // Preset formula chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const formula = chip.getAttribute('data-formula');
        document.getElementById('modalFormulaText').value = formula;
        this.validateModalFormula();
      });
    });

    document.getElementById('modalFormulaText')?.addEventListener('input', () => {
      this.validateModalFormula();
    });

    document.getElementById('btnSaveFormula')?.addEventListener('click', () => {
      this.saveCustomFormula();
    });

    // CSV Import apply
    document.getElementById('btnApplyImport')?.addEventListener('click', () => {
      this.applyCSVImport();
    });

    document.getElementById('csvFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          document.getElementById('csvPasteArea').value = evt.target.result;
        };
        reader.readAsText(file);
      }
    });

    // CSV Export Actions
    document.getElementById('btnCopyExportCSV')?.addEventListener('click', () => {
      const txt = document.getElementById('csvExportPreview').value;
      navigator.clipboard.writeText(txt).then(() => {
        alert('CSV copied to clipboard!');
      });
    });

    document.getElementById('btnDownloadExportCSV')?.addEventListener('click', () => {
      const txt = document.getElementById('csvExportPreview').value;
      const blob = new Blob([txt], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pivot_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Formula bar direct input
    this.formulaBarInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.selectedCell) {
        const val = this.formulaBarInput.value;
        this.commitEdit(this.selectedCell.node, this.selectedCell.colKey, this.selectedCell.measureId, val);
      }
    });

    // Setup drag and drop zones
    this.setupDropZones();
  }

  initSidebarFields() {
    this.renderFieldPool();
    this.renderDropZones();
  }

  renderFieldPool() {
    this.availableFieldsList.innerHTML = '';
    const allDims = this.engine.headers.filter(h => {
      const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return !['price', 'actualsales', 'forecast', 'supply', 'initialinventory', '__row_id'].includes(norm);
    });

    const activeRows = new Set(this.engine.rowDimensions);
    const activeCols = new Set(this.engine.columnDimensions);

    allDims.forEach(dim => {
      if (!activeRows.has(dim) && !activeCols.has(dim)) {
        const chip = this.createFieldChip(dim, 'DIMENSION');
        this.availableFieldsList.appendChild(chip);
      }
    });
  }

  createFieldChip(name, type, onRemove, isCalculated = false, listIndex = 0, zoneType = 'rows') {
    const chip = document.createElement('div');
    chip.className = 'field-chip';
    chip.draggable = true;
    chip.dataset.fieldName = name;
    chip.dataset.fieldType = type;
    chip.dataset.zoneType = zoneType;
    chip.dataset.listIndex = listIndex;

    const dragHandle = document.createElement('span');
    dragHandle.innerHTML = '⋮⋮ ';
    dragHandle.style.color = '#8a8886';
    dragHandle.style.cursor = 'grab';
    chip.appendChild(dragHandle);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'chip-name';
    nameSpan.innerHTML = isCalculated ? `<em>fx</em> ${name}` : name;
    chip.appendChild(nameSpan);

    if (onRemove) {
      const removeBtn = document.createElement('span');
      removeBtn.className = 'chip-remove';
      removeBtn.innerHTML = '✕';
      removeBtn.title = 'Remove field';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        onRemove();
      };
      chip.appendChild(removeBtn);
    }

    chip.addEventListener('dragstart', (e) => {
      this.draggedField = { name, type, sourceZone: zoneType, index: listIndex };
      chip.classList.add('dragging');
      e.dataTransfer.setData('text/plain', name);
      e.dataTransfer.effectAllowed = 'move';
    });

    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      this.draggedField = null;
      document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
      document.querySelectorAll('.field-chip').forEach(c => c.classList.remove('chip-drag-over'));
    });

    // Support dropping directly on another chip to insert before it (reorder)
    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chip.classList.add('chip-drag-over');
    });

    chip.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      chip.classList.remove('chip-drag-over');
    });

    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chip.classList.remove('chip-drag-over');
      if (!this.draggedField) return;

      const draggedName = this.draggedField.name;
      const targetZone = zoneType;
      const targetIndex = listIndex;

      this.handleFieldDrop(draggedName, targetZone, targetIndex);
    });

    return chip;
  }

  renderDropZones() {
    this.zoneRows.innerHTML = '';
    this.zoneColumns.innerHTML = '';
    this.zoneMeasures.innerHTML = '';

    // Rows
    this.engine.rowDimensions.forEach((dim, idx) => {
      const chip = this.createFieldChip(dim, 'ROW_DIM', () => {
        this.engine.rowDimensions = this.engine.rowDimensions.filter(d => d !== dim);
        this.initSidebarFields();
        this.render();
      }, false, idx, 'rows');
      this.zoneRows.appendChild(chip);
    });

    // Columns
    this.engine.columnDimensions.forEach((dim, idx) => {
      const chip = this.createFieldChip(dim, 'COL_DIM', () => {
        this.engine.columnDimensions = this.engine.columnDimensions.filter(d => d !== dim);
        this.initSidebarFields();
        this.render();
      }, false, idx, 'columns');
      this.zoneColumns.appendChild(chip);
    });

    // Measures
    this.engine.getAllMeasures().forEach((meas, idx) => {
      const isActive = this.engine.activeMeasureIds.includes(meas.id);
      if (isActive) {
        const chip = this.createFieldChip(meas.label || meas.id, 'MEASURE', () => {
          this.engine.activeMeasureIds = this.engine.activeMeasureIds.filter(id => id !== meas.id);
          this.initSidebarFields();
          this.render();
        }, meas.type === 'CALCULATED', idx, 'measures');
        this.zoneMeasures.appendChild(chip);
      }
    });
  }

  setupDropZones() {
    const zones = [
      { el: this.zoneRows, target: 'rows' },
      { el: this.zoneColumns, target: 'columns' },
      { el: this.zoneMeasures, target: 'measures' },
      { el: this.availableFieldsList, target: 'pool' }
    ];

    zones.forEach(({ el, target }) => {
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.parentElement.classList.add('drag-over');
      });

      el.addEventListener('dragleave', () => {
        el.parentElement.classList.remove('drag-over');
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.parentElement.classList.remove('drag-over');
        if (!this.draggedField) return;

        const fieldName = this.draggedField.name;
        this.handleFieldDrop(fieldName, target, null);
      });
    });
  }

  handleFieldDrop(fieldName, targetZone, targetIndex = null) {
    // 1. Remove field from dimensions if it was in rows or columns
    this.engine.rowDimensions = this.engine.rowDimensions.filter(d => d !== fieldName);
    this.engine.columnDimensions = this.engine.columnDimensions.filter(d => d !== fieldName);

    // 2. Insert into target zone at target index
    if (targetZone === 'rows') {
      if (targetIndex !== null && targetIndex >= 0 && targetIndex <= this.engine.rowDimensions.length) {
        this.engine.rowDimensions.splice(targetIndex, 0, fieldName);
      } else {
        this.engine.rowDimensions.push(fieldName);
      }
    } else if (targetZone === 'columns') {
      if (targetIndex !== null && targetIndex >= 0 && targetIndex <= this.engine.columnDimensions.length) {
        this.engine.columnDimensions.splice(targetIndex, 0, fieldName);
      } else {
        this.engine.columnDimensions.push(fieldName);
      }
    } else if (targetZone === 'measures') {
      const meas = this.engine.getAllMeasures().find(m => (m.label || m.id) === fieldName || m.id === fieldName);
      if (meas && !this.engine.activeMeasureIds.includes(meas.id)) {
        this.engine.activeMeasureIds.push(meas.id);
      }
    }

    this.initSidebarFields();
    this.render();
    this.showStatus(`Updated pivot layout: Moved "${fieldName}" to ${targetZone.toUpperCase()}.`);
  }

  render() {
    const pivotData = this.engine.buildPivotGrid();
    const { rootNode, timePeriods, activeMeasures } = pivotData;

    this.pivotTable.innerHTML = '';

    if (activeMeasures.length === 0) {
      this.pivotTable.innerHTML = '<thead><tr><th style="padding: 20px;">Please select at least one active Measure in the Pivot Fields panel.</th></tr></thead>';
      return;
    }

    // Build the Grid View
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // 1. Render Column Headers (Multi-tiered time periods)
    this.renderHeaderRows(thead, timePeriods, activeMeasures);

    // 2. Render Row Tree Hierarchies & Stacked Measures
    this.renderTreeRows(tbody, rootNode, timePeriods, activeMeasures);

    this.pivotTable.appendChild(thead);
    this.pivotTable.appendChild(tbody);
  }

  renderHeaderRows(thead, timePeriods, activeMeasures) {
    const colDims = this.engine.columnDimensions;

    if (this.measurePlacement === 'ROWS') {
      // Dimension level headers across top
      colDims.forEach((dimName, level) => {
        const tr = document.createElement('tr');

        if (level === 0) {
          const cornerTh = document.createElement('th');
          cornerTh.className = 'corner-header';
          cornerTh.rowSpan = colDims.length;
          cornerTh.innerHTML = `<strong>${this.engine.rowDimensions.join(' ▸ ')}</strong>`;
          tr.appendChild(cornerTh);
        }

        // Add headers for each time bucket
        timePeriods.forEach(period => {
          const th = document.createElement('th');
          th.textContent = period.colValues[level] || '';
          tr.appendChild(th);
        });

        thead.appendChild(tr);
      });
    } else {
      // Measure spread across columns
      colDims.forEach((dimName, level) => {
        const tr = document.createElement('tr');
        if (level === 0) {
          const cornerTh = document.createElement('th');
          cornerTh.className = 'corner-header';
          cornerTh.rowSpan = colDims.length + 1;
          cornerTh.innerHTML = `<strong>${this.engine.rowDimensions.join(' ▸ ')}</strong>`;
          tr.appendChild(cornerTh);
        }

        timePeriods.forEach(period => {
          const th = document.createElement('th');
          th.colSpan = activeMeasures.length;
          th.textContent = period.colValues[level] || '';
          tr.appendChild(th);
        });

        thead.appendChild(tr);
      });

      // Bottom header row for Measures
      const measTr = document.createElement('tr');
      timePeriods.forEach(() => {
        activeMeasures.forEach(m => {
          const th = document.createElement('th');
          th.style.fontSize = '11px';
          th.textContent = m.label || m.id;
          measTr.appendChild(th);
        });
      });
      thead.appendChild(measTr);
    }
  }

  renderTreeRows(tbody, node, timePeriods, activeMeasures) {
    const isExpanded = this.engine.isNodeExpanded(node.key);
    const hasChildren = node.children.size > 0;
    const isRoot = node.key === 'ROOT';

    // Render this node's rows
    if (this.measurePlacement === 'ROWS') {
      // Stacked Measures on Rows
      activeMeasures.forEach((measure, mIdx) => {
        const tr = document.createElement('tr');
        tr.className = isRoot ? 'row-level-root' : `row-level-${node.level}`;

        // Header cell (rendered only on first measure row using rowspan)
        if (mIdx === 0) {
          const th = document.createElement('th');
          th.className = 'row-header';
          th.rowSpan = activeMeasures.length;

          const content = document.createElement('div');
          content.className = 'tree-node-content';
          content.style.paddingLeft = `${Math.max(0, node.level) * 20}px`;

          // Expander button
          const expander = document.createElement('span');
          expander.className = `tree-expander ${hasChildren ? '' : 'empty'}`;
          expander.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '•';
          if (hasChildren) {
            expander.onclick = (e) => {
              e.stopPropagation();
              this.engine.toggleNode(node.key);
              this.render();
            };
          }
          content.appendChild(expander);

          // Dimension badge & title
          if (!isRoot) {
            const badge = document.createElement('span');
            badge.className = 'tree-dim-badge';
            badge.textContent = node.dimName;
            content.appendChild(badge);
          }

          const label = document.createElement('span');
          label.style.fontWeight = isRoot ? '700' : (hasChildren ? '600' : 'normal');
          label.textContent = node.dimValue;
          content.appendChild(label);

          th.appendChild(content);
          tr.appendChild(th);
        }

        // Measure label indicator
        const measLabelTd = document.createElement('td');
        measLabelTd.className = 'measure-name-label';
        measLabelTd.style.width = '160px';
        measLabelTd.innerHTML = `${measure.type === 'CALCULATED' ? '<em>fx</em> ' : ''}<strong>${measure.label || measure.id}</strong>`;
        tr.appendChild(measLabelTd);

        // Data cells across time periods
        timePeriods.forEach(period => {
          const colKey = period.colKey;
          const val = node.aggregatedData[colKey]?.[measure.id] ?? 0;

          const td = document.createElement('td');
          td.className = 'cell-number';
          if (measure.editable) {
            td.classList.add('cell-editable');
          }

          td.dataset.nodeKey = node.key;
          td.dataset.colKey = colKey;
          td.dataset.measureId = measure.id;
          td.dataset.rawVal = val;

          td.textContent = this.formatValue(val, measure.format);

          td.addEventListener('click', () => {
            this.selectCell(td, node, colKey, measure, val);
          });

          if (measure.editable) {
            td.addEventListener('dblclick', () => {
              this.startCellEdit(td, node, colKey, measure);
            });
          }

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    } else {
      // Measures on Columns (Spread side-by-side horizontally)
      const tr = document.createElement('tr');
      tr.className = isRoot ? 'row-level-root' : `row-level-${node.level}`;

      const th = document.createElement('th');
      th.className = 'row-header';

      const content = document.createElement('div');
      content.className = 'tree-node-content';
      content.style.paddingLeft = `${Math.max(0, node.level) * 20}px`;

      // Expander button
      const expander = document.createElement('span');
      expander.className = `tree-expander ${hasChildren ? '' : 'empty'}`;
      expander.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '•';
      if (hasChildren) {
        expander.onclick = (e) => {
          e.stopPropagation();
          this.engine.toggleNode(node.key);
          this.render();
        };
      }
      content.appendChild(expander);

      // Dimension badge & title
      if (!isRoot) {
        const badge = document.createElement('span');
        badge.className = 'tree-dim-badge';
        badge.textContent = node.dimName;
        content.appendChild(badge);
      }

      const label = document.createElement('span');
      label.style.fontWeight = isRoot ? '700' : (hasChildren ? '600' : 'normal');
      label.textContent = node.dimValue;
      content.appendChild(label);

      th.appendChild(content);
      tr.appendChild(th);

      // Data cells for each time period and each measure
      timePeriods.forEach(period => {
        const colKey = period.colKey;
        activeMeasures.forEach(measure => {
          const val = node.aggregatedData[colKey]?.[measure.id] ?? 0;

          const td = document.createElement('td');
          td.className = 'cell-number';
          if (measure.editable) {
            td.classList.add('cell-editable');
          }

          td.dataset.nodeKey = node.key;
          td.dataset.colKey = colKey;
          td.dataset.measureId = measure.id;
          td.dataset.rawVal = val;

          td.textContent = this.formatValue(val, measure.format);

          td.addEventListener('click', () => {
            this.selectCell(td, node, colKey, measure, val);
          });

          if (measure.editable) {
            td.addEventListener('dblclick', () => {
              this.startCellEdit(td, node, colKey, measure);
            });
          }

          tr.appendChild(td);
        });
      });

      tbody.appendChild(tr);
    }

    // Recurse children if expanded
    if (isExpanded && hasChildren) {
      node.children.forEach(child => {
        this.renderTreeRows(tbody, child, timePeriods, activeMeasures);
      });
    }
  }

  selectCell(td, node, colKey, measure, val) {
    if (this.selectedCell?.element) {
      this.selectedCell.element.classList.remove('cell-selected');
    }

    this.selectedCell = {
      element: td,
      node,
      colKey,
      measureId: measure.id,
      measure,
      val
    };

    td.classList.add('cell-selected');

    // Update Formula Bar
    const path = node.key === 'ROOT' ? 'Grand Total' : node.key.replace(/:/g, ' = ');
    this.activeCellAddress.textContent = `${measure.id} @ ${node.dimValue}`;
    this.formulaBarInput.value = measure.type === 'CALCULATED' ? measure.formula : val;

    // Update Status Bar
    this.statSelected.textContent = `${path} [${colKey}]`;
    this.statSum.textContent = this.formatValue(val, measure.format);
    this.statAvg.textContent = this.formatValue(val, measure.format);
    this.showStatus(`Selected ${measure.label || measure.id} for ${node.dimValue} (${colKey}). ${measure.editable ? 'Double-click or press Enter to edit.' : ''}`);
  }

  startCellEdit(td, node, colKey, measure) {
    if (this.editingCell) return;

    this.editingCell = td;
    const currentVal = td.dataset.rawVal || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input-editor';
    input.value = currentVal;

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const newVal = input.value;
      this.editingCell = null;
      this.commitEdit(node, colKey, measure.id, newVal);
    };

    const cancel = () => {
      this.editingCell = null;
      this.render();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
  }

  commitEdit(node, colKey, measureId, newVal) {
    const success = this.engine.updateCellValue({
      node,
      colKey,
      measureId,
      newValue: newVal
    });

    if (success) {
      this.render();
      this.flashCellUpdate(node.key, colKey);
      this.showStatus(`Updated ${measureId} to ${newVal}. Inventory chains & rollups recalculated.`);
    } else {
      this.render();
      this.showStatus(`Could not update cell value: invalid numeric input.`, true);
    }
  }

  flashCellUpdate(nodeKey, colKey) {
    setTimeout(() => {
      const cells = document.querySelectorAll(`td[data-col-key="${colKey}"]`);
      cells.forEach(c => {
        c.classList.add('cell-flash');
        setTimeout(() => c.classList.remove('cell-flash'), 1200);
      });
    }, 50);
  }

  formatValue(val, formatType) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    const num = Number(val);
    if (formatType === 'currency') {
      return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  showStatus(msg, isError = false) {
    if (this.statusMessage) {
      this.statusMessage.textContent = msg;
      this.statusMessage.style.color = isError ? '#d83b01' : 'inherit';
    }
  }

  // --- MODALS ---

  openFormulaModal() {
    document.getElementById('modalMeasureName').value = 'Adjusted Forecast Metric';
    document.getElementById('modalFormulaText').value = 'IF msr1 < msr2 THEN msr1 ELSE (n-2)*msr2*msr3';
    document.getElementById('modalParamN').value = this.engine.globalParams.n || 4;
    this.validateModalFormula();
    this.openModal(this.formulaModal);
  }

  validateModalFormula() {
    const formula = document.getElementById('modalFormulaText').value;
    const res = this.engine.formulaEngine.validate(formula);
    const resultDiv = document.getElementById('formulaValidationResult');

    if (res.valid) {
      resultDiv.innerHTML = `<span style="color: #107c41;">✓ Valid Formula! Variables: ${res.variables.join(', ')}</span>`;
    } else {
      resultDiv.innerHTML = `<span style="color: #d83b01;">✕ Syntax Error: ${res.error}</span>`;
    }
  }

  saveCustomFormula() {
    const name = document.getElementById('modalMeasureName').value.trim() || 'Custom Formula';
    const formula = document.getElementById('modalFormulaText').value.trim();
    const evalMode = document.querySelector('input[name="modalEvalMode"]:checked').value;
    const paramN = parseFloat(document.getElementById('modalParamN').value) || 4;

    const validation = this.engine.formulaEngine.validate(formula);
    if (!validation.valid) {
      alert(`Invalid formula: ${validation.error}`);
      return;
    }

    const id = 'MSR_' + name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4);

    this.engine.addCustomMeasure({
      id,
      label: name,
      type: 'CALCULATED',
      formula,
      evalMode,
      params: { n: paramN },
      format: 'number'
    });

    this.closeModal(this.formulaModal);
    this.initSidebarFields();
    this.render();
    this.showStatus(`Added calculated measure "${name}" with ${evalMode} evaluation.`);
  }

  openImportModal() {
    document.getElementById('csvPasteArea').value = '';
    document.getElementById('csvFileInput').value = '';
    this.openModal(this.importModal);
  }

  applyCSVImport() {
    const txt = document.getElementById('csvPasteArea').value.trim();
    if (!txt) {
      alert('Please select a CSV file or paste CSV text.');
      return;
    }

    const parsed = CSVUtils.parse(txt);
    if (parsed.rows.length === 0) {
      alert('Could not parse any rows from CSV data. Please check formatting.');
      return;
    }

    this.engine.setData(parsed);
    this.closeModal(this.importModal);
    this.initSidebarFields();
    this.render();
    this.showStatus(`Successfully imported ${parsed.rows.length} rows with ${parsed.headers.length} columns.`);
  }

  openExportModal(type) {
    let csvTxt = '';
    if (type === 'RAW') {
      csvTxt = CSVUtils.stringify(this.engine.rawRows, this.engine.headers);
    } else {
      // Export current pivot tree
      const pivotData = this.engine.buildPivotGrid();
      const { rootNode, timePeriods, activeMeasures } = pivotData;
      const headers = ['Hierarchy', 'Measure', ...timePeriods.map(p => p.colKey.replace(/___/g, ' '))];
      const rows = [];

      const walk = (node) => {
        activeMeasures.forEach(m => {
          const rowObj = {
            'Hierarchy': `${'  '.repeat(Math.max(0, node.level))}${node.dimValue}`,
            'Measure': m.label || m.id
          };
          timePeriods.forEach(p => {
            rowObj[p.colKey.replace(/___/g, ' ')] = node.aggregatedData[p.colKey]?.[m.id] ?? 0;
          });
          rows.push(rowObj);
        });
        node.children.forEach(walk);
      };

      walk(rootNode);
      csvTxt = CSVUtils.stringify(rows, headers);
    }

    document.getElementById('csvExportPreview').value = csvTxt;
    this.openModal(this.exportModal);
  }

  openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  closeModal(modal) {
    if (modal) modal.classList.remove('active');
  }
}

window.PivotUI = PivotUI;
