/**
 * Application Bootstrap
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Pivot Engine
  const engine = new PivotEngine({
    rowDimensions: ['Region', 'Country', 'City', 'ProductFamily', 'Item'],
    columnDimensions: ['Year', 'Month'],
    globalParams: { n: 4 }
  });

  // 2. Load Default CSV Dataset
  const parsed = CSVUtils.parse(window.DEFAULT_CSV_DATA);
  engine.setData(parsed);

  // 3. Pre-add the user's requested formula as a calculated measure out of the box!
  engine.addCustomMeasure({
    id: 'Adjusted_Demand_Formula',
    label: 'IF msr1 < msr2 THEN msr1 ELSE (n-2)*msr2*msr3',
    type: 'CALCULATED',
    formula: 'IF msr1 < msr2 THEN msr1 ELSE (n-2)*msr2*msr3',
    evalMode: 'POST_AGGREGATE',
    params: { n: 4 },
    format: 'number'
  });

  // 4. Initialize and render UI
  const ui = new PivotUI(engine);
  ui.render();

  // Expose to window for debugging / scripting
  window.app = { engine, ui };
});
