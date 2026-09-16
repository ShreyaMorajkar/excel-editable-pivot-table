# Excel Editable Pivot Table Engine

An enterprise-grade, Excel-inspired **Editable Pivot Table Web Application** built strictly with **100% Vanilla JavaScript (ES6+), HTML5, and CSS3** (No TypeScript, zero external npm dependencies or build tools).

---

## 🌟 Key Features

- **Multi-Level Row & Column Hierarchies**:
  - Rows: Geography (`Region` → `Country` → `City`) and Products (`Product Family` → `Item` / TV models).
  - Columns: Time buckets (`Year` → `Quarter` → `Month`) sorted chronologically.
- **Drag-and-Drop Pivot Fields**:
  - Reorder dimensions, move fields between **Rows**, **Columns**, **Values (Measures)**, and **Filters** just like Excel Pivot Tables.
- **Dynamic AST Formula Engine**:
  - Full recursive-descent AST evaluator supporting arbitrary formulas like:
    $$\text{IF } \text{msr1} < \text{msr2} \text{ THEN } \text{msr1} \text{ ELSE } (n-2) \times \text{msr2} \times \text{msr3}$$
  - Shorthand multiplication, nested parentheses, math functions (`MIN`, `MAX`, `ROUND`, `ABS`), logical/comparison operators (`<`, `>`, `<=`, `>=`, `==`, `!=`, `AND`, `OR`), parameter bindings ($n$), and lag lookups (`PREV([EndingInventory], 1)`).
- **Dual Formula Evaluation Modes**:
  - **Leaf Level (`LEAF_ROLLUP`)**: Evaluates on each atomic record then rolls up.
  - **Aggregate Level (`POST_AGGREGATE`)**: Rolls up component metrics first and evaluates formula directly on node totals.
- **Weighted Average Price**:
  - $\text{Weighted Price} = \frac{\sum(\text{Units} \times \text{Price})}{\sum \text{Units}}$ dynamically calculated across cities, models, and regions.
- **Time-Series Inventory Bucket Chaining**:
  - $\text{Prev Inventory}_{t} = \text{Ending Inventory}_{t-1}$
  - $\text{Ending Inventory}_{t} = \text{Prev Inventory}_{t} + \text{Supply}_{t} - \text{Demand}_{t}$
  - Cumulative balance carries forward continuously through the year.
- **Bi-Directional Editing & Top-Down Disaggregation**:
  - Edit leaf cells to trigger reactive bottom-up rollups and forward inventory recalculations.
  - Edit collapsed summary parent cells (e.g. Country or Product Family forecast/price) to proportionally disaggregate down to child records.
- **Comma-Separated CSV Support**:
  - Preloaded sample dataset.
  - Drag-and-drop CSV file upload, text paste import, and CSV export.

---

## 🚀 Quick Start

No installation or build steps required. Simply open `index.html` in any web browser!

Or serve locally:
```bash
npx http-server . -p 8080 -c-1
```
Then visit [http://localhost:8080](http://localhost:8080).

---

## 📁 Project Structure

```
├── index.html        # Main Excel spreadsheet UI & Modals
├── styles.css        # Excel 365 stylesheet with sticky headers & tree nesting
├── js/
│   ├── formula.js    # Dynamic AST formula lexer, parser, and evaluator
│   ├── data.js       # Default CSV data & CSV parser/serializer
│   ├── engine.js     # Multidimensional pivot grouping, inventory & disaggregation engine
│   ├── ui.js         # Table renderer, drag-and-drop zones, in-cell editor
│   └── app.js        # Application bootstrap
└── test_engine.js    # Automated unit test suite
```

---

## 🧪 Testing

Run the automated test suite with Node.js:
```bash
node test_engine.js
```

---

## 📜 License
MIT
