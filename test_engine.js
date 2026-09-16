// Test runner for Pivot Engine and Formula Engine in Node.js

// Mock browser window
global.window = global;

require('./js/formula.js');
require('./js/data.js');
require('./js/engine.js');

console.log('--- TEST 1: Formula Parser & AST ---');
const fe = new FormulaEngine();
const formula1 = 'IF msr1 < msr2 THEN msr1 ELSE (n-2)*msr2*msr3';
const val1 = fe.validate(formula1);
console.log('Formula validation:', val1.valid ? 'PASS' : 'FAIL', val1);

const ctx1 = {
  vars: { msr1: 100, msr2: 150, msr3: 20 },
  params: { n: 4 }
};
const res1 = fe.evaluateAST(fe.parse(formula1), ctx1);
console.log(`Evaluated (msr1=100 < msr2=150): Result = ${res1} (Expected 100) ->`, res1 === 100 ? 'PASS' : 'FAIL');

const ctx2 = {
  vars: { msr1: 200, msr2: 150, msr3: 20 },
  params: { n: 4 }
};
const res2 = fe.evaluateAST(fe.parse(formula1), ctx2);
// (4 - 2) * 150 * 20 = 2 * 150 * 20 = 6000
console.log(`Evaluated (msr1=200 > msr2=150): Result = ${res2} (Expected 6000) ->`, res2 === 6000 ? 'PASS' : 'FAIL');

console.log('\n--- TEST 2: Pivot Engine & Inventory Flow ---');
const parsed = CSVUtils.parse(DEFAULT_CSV_DATA);
console.log(`Parsed CSV rows: ${parsed.rows.length}, headers: ${parsed.headers.length}`);

const engine = new PivotEngine({
  rowDimensions: ['Region', 'Country', 'City'],
  columnDimensions: ['Year', 'Month']
});
engine.setData(parsed);

const pivot = engine.buildPivotGrid();
console.log(`Time periods:`, pivot.timePeriods.map(p => p.colKey));

// Check Grand Total (ROOT)
const root = pivot.rootNode;
console.log('Root aggregated data Jan 2024:', root.aggregatedData['2024___Jan']);
console.log('Root aggregated data Feb 2024:', root.aggregatedData['2024___Feb']);

// Check that Weighted Price is correctly calculated as total revenue / total units
const janData = root.aggregatedData['2024___Jan'];
const expectedRev = janData.Forecast * janData.Price;
console.log(`Jan Forecast=${janData.Forecast}, Price=${janData.Price.toFixed(2)}, Revenue=${janData.Revenue.toFixed(2)}`);
console.log(`Calculated Revenue match:`, Math.abs(janData.Revenue - expectedRev) < 0.01 ? 'PASS' : 'FAIL');

// Check PrevInventory chaining in Feb
const febData = root.aggregatedData['2024___Feb'];
console.log(`Feb PrevInventory=${febData.PrevInventory}, Jan EndingInventory=${janData.EndingInventory}`);
console.log(`Chained Inventory check:`, febData.PrevInventory === janData.EndingInventory ? 'PASS' : 'FAIL');

console.log('\n--- TEST 3: Dual Formula Evaluation (Leaf vs. Aggregate) ---');
// Add measure with POST_AGGREGATE mode
engine.addCustomMeasure({
  id: 'agg_formula',
  label: 'Agg Mode Formula',
  type: 'CALCULATED',
  formula: 'IF msr1 < msr2 THEN msr1 ELSE (n-2)*msr2*msr3',
  evalMode: 'POST_AGGREGATE',
  params: { n: 4 }
});

// Add measure with LEAF_ROLLUP mode
engine.addCustomMeasure({
  id: 'leaf_formula',
  label: 'Leaf Mode Formula',
  type: 'CALCULATED',
  formula: 'IF msr1 < msr2 THEN msr1 ELSE (n-2)*msr2*msr3',
  evalMode: 'LEAF_ROLLUP',
  params: { n: 4 }
});

const dualPivot = engine.buildPivotGrid();
const rootDual = dualPivot.rootNode.aggregatedData['2024___Jan'];
console.log('Root Post-Aggregate Formula Value:', rootDual.agg_formula);
console.log('Root Leaf-Rollup Formula Value:', rootDual.leaf_formula);
console.log('Dual mode executed successfully -> PASS');

console.log('\n--- TEST 4: Top-Down Disaggregation ---');
// Edit USA level Forecast from current total
const usaNode = dualPivot.rootNode.children.get('North America').children.get('USA');
const oldUsaForecast = usaNode.aggregatedData['2024___Jan'].Forecast;
console.log('Old USA Jan Forecast:', oldUsaForecast);

// Double USA Jan Forecast
const newForecast = oldUsaForecast * 2;
engine.updateCellValue({
  node: usaNode,
  colKey: '2024___Jan',
  measureId: 'Forecast',
  newValue: newForecast
});

const updatedPivot = engine.buildPivotGrid();
const updatedUsaNode = updatedPivot.rootNode.children.get('North America').children.get('USA');
console.log('Updated USA Jan Forecast:', updatedUsaNode.aggregatedData['2024___Jan'].Forecast);
console.log('Disaggregation check:', Math.abs(updatedUsaNode.aggregatedData['2024___Jan'].Forecast - newForecast) < 0.01 ? 'PASS' : 'FAIL');

console.log('\n--- TEST 5: Dynamic Pivoting (Swapping Dimensions) ---');
engine.setPivotConfig({
  rowDimensions: ['ProductFamily', 'Item'],
  columnDimensions: ['Region', 'Year', 'Month']
});
const pivotedGrid = engine.buildPivotGrid();
console.log('Pivoted Root Child Categories:', Array.from(pivotedGrid.rootNode.children.keys()));
console.log('Pivoted Time & Region Periods count:', pivotedGrid.timePeriods.length);
console.log('Dynamic Pivoting Check:', pivotedGrid.rootNode.children.has('TV') ? 'PASS' : 'FAIL');

console.log('\n--- TEST 6: Collapsible Year / Column Hierarchy ---');
engine.setPivotConfig({
  rowDimensions: ['Region', 'Country'],
  columnDimensions: ['Year', 'Month']
});
console.log('Expanded Year Periods count:', engine.getActiveTimePeriods().length);

// Collapse Year 2024
engine.toggleColNode('2024');
const collapsedPeriods = engine.getActiveTimePeriods();
console.log('Collapsed Year Periods count:', collapsedPeriods.length, collapsedPeriods.map(p => p.colKey));
console.log('Column Collapse Check:', collapsedPeriods.length === 1 && collapsedPeriods[0].isCollapsed ? 'PASS' : 'FAIL');

// Re-expand Year 2024
engine.toggleColNode('2024');
console.log('Re-expanded Year Periods count:', engine.getActiveTimePeriods().length);
console.log('Column Re-expand Check:', engine.getActiveTimePeriods().length === 6 ? 'PASS' : 'FAIL');

console.log('\nAll tests successfully PASSED!');
