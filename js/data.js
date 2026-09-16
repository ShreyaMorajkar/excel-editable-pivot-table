/**
 * Default CSV Dataset and CSV Parser/Exporter Utilities
 */

const DEFAULT_CSV_DATA = `Region,Country,City,ProductFamily,Item,Year,Quarter,Month,Price,ActualSales,Forecast,Supply,InitialInventory
North America,USA,New York,TV,OLED 65",2024,Q1,Jan,1200,150,160,180,200
North America,USA,New York,TV,OLED 65",2024,Q1,Feb,1200,170,165,170,0
North America,USA,New York,TV,OLED 65",2024,Q1,Mar,1180,180,175,190,0
North America,USA,New York,TV,OLED 65",2024,Q2,Apr,1180,160,170,160,0
North America,USA,New York,TV,OLED 65",2024,Q2,May,1150,190,185,200,0
North America,USA,New York,TV,OLED 65",2024,Q2,Jun,1150,210,200,210,0
North America,USA,New York,TV,4K 55",2024,Q1,Jan,650,280,300,320,350
North America,USA,New York,TV,4K 55",2024,Q1,Feb,650,310,295,300,0
North America,USA,New York,TV,4K 55",2024,Q1,Mar,630,330,320,340,0
North America,USA,New York,TV,4K 55",2024,Q2,Apr,630,300,310,300,0
North America,USA,New York,TV,4K 55",2024,Q2,May,600,350,340,360,0
North America,USA,New York,TV,4K 55",2024,Q2,Jun,600,390,380,400,0
North America,USA,New York,Audio,Soundbar Pro,2024,Q1,Jan,300,200,210,220,150
North America,USA,New York,Audio,Soundbar Pro,2024,Q1,Feb,300,220,215,230,0
North America,USA,New York,Audio,Soundbar Pro,2024,Q1,Mar,290,250,240,260,0
North America,USA,New York,Audio,Soundbar Pro,2024,Q2,Apr,290,230,235,240,0
North America,USA,New York,Audio,Soundbar Pro,2024,Q2,May,280,270,260,280,0
North America,USA,New York,Audio,Soundbar Pro,2024,Q2,Jun,280,300,290,310,0
North America,USA,Los Angeles,TV,OLED 65",2024,Q1,Jan,1220,130,140,150,180
North America,USA,Los Angeles,TV,OLED 65",2024,Q1,Feb,1220,145,140,140,0
North America,USA,Los Angeles,TV,OLED 65",2024,Q1,Mar,1200,160,150,170,0
North America,USA,Los Angeles,TV,OLED 65",2024,Q2,Apr,1200,140,145,150,0
North America,USA,Los Angeles,TV,OLED 65",2024,Q2,May,1180,175,160,180,0
North America,USA,Los Angeles,TV,OLED 65",2024,Q2,Jun,1180,190,180,190,0
North America,USA,Los Angeles,TV,4K 55",2024,Q1,Jan,660,240,250,260,280
North America,USA,Los Angeles,TV,4K 55",2024,Q1,Feb,660,260,255,270,0
North America,USA,Los Angeles,TV,4K 55",2024,Q1,Mar,640,290,280,300,0
North America,USA,Los Angeles,TV,4K 55",2024,Q2,Apr,640,270,275,280,0
North America,USA,Los Angeles,TV,4K 55",2024,Q2,May,620,310,300,320,0
North America,USA,Los Angeles,TV,4K 55",2024,Q2,Jun,620,340,330,350,0
North America,Canada,Toronto,TV,OLED 65",2024,Q1,Jan,1150,90,100,110,120
North America,Canada,Toronto,TV,OLED 65",2024,Q1,Feb,1150,105,100,100,0
North America,Canada,Toronto,TV,OLED 65",2024,Q1,Mar,1120,120,110,125,0
North America,Canada,Toronto,TV,OLED 65",2024,Q2,Apr,1120,100,105,110,0
North America,Canada,Toronto,TV,OLED 65",2024,Q2,May,1100,130,120,135,0
North America,Canada,Toronto,TV,OLED 65",2024,Q2,Jun,1100,140,135,145,0
Europe,Germany,Berlin,TV,OLED 65",2024,Q1,Jan,1300,110,120,130,150
Europe,Germany,Berlin,TV,OLED 65",2024,Q1,Feb,1300,125,120,120,0
Europe,Germany,Berlin,TV,OLED 65",2024,Q1,Mar,1280,140,135,150,0
Europe,Germany,Berlin,TV,OLED 65",2024,Q2,Apr,1280,120,125,130,0
Europe,Germany,Berlin,TV,OLED 65",2024,Q2,May,1250,155,145,160,0
Europe,Germany,Berlin,TV,OLED 65",2024,Q2,Jun,1250,170,160,175,0
Europe,Germany,Berlin,Audio,Soundbar Pro,2024,Q1,Jan,320,140,150,160,110
Europe,Germany,Berlin,Audio,Soundbar Pro,2024,Q1,Feb,320,160,155,160,0
Europe,Germany,Berlin,Audio,Soundbar Pro,2024,Q1,Mar,310,180,170,190,0
Europe,Germany,Berlin,Audio,Soundbar Pro,2024,Q2,Apr,310,165,165,170,0
Europe,Germany,Berlin,Audio,Soundbar Pro,2024,Q2,May,300,195,185,200,0
Europe,Germany,Berlin,Audio,Soundbar Pro,2024,Q2,Jun,300,220,210,230,0
Europe,UK,London,TV,OLED 65",2024,Q1,Jan,1350,120,130,140,160
Europe,UK,London,TV,OLED 65",2024,Q1,Feb,1350,140,135,135,0
Europe,UK,London,TV,OLED 65",2024,Q1,Mar,1320,155,145,160,0
Europe,UK,London,TV,OLED 65",2024,Q2,Apr,1320,135,140,145,0
Europe,UK,London,TV,OLED 65",2024,Q2,May,1290,170,160,175,0
Europe,UK,London,TV,OLED 65",2024,Q2,Jun,1290,185,175,190,0
Asia,Japan,Tokyo,TV,OLED 65",2024,Q1,Jan,1250,200,210,230,250
Asia,Japan,Tokyo,TV,OLED 65",2024,Q1,Feb,1250,220,215,220,0
Asia,Japan,Tokyo,TV,OLED 65",2024,Q1,Mar,1220,250,240,260,0
Asia,Japan,Tokyo,TV,OLED 65",2024,Q2,Apr,1220,230,235,240,0
Asia,Japan,Tokyo,TV,OLED 65",2024,Q2,May,1190,270,260,280,0
Asia,Japan,Tokyo,TV,OLED 65",2024,Q2,Jun,1190,300,290,310,0
Asia,India,Mumbai,TV,4K 55",2024,Q1,Jan,550,320,340,360,400
Asia,India,Mumbai,TV,4K 55",2024,Q1,Feb,550,360,350,360,0
Asia,India,Mumbai,TV,4K 55",2024,Q1,Mar,530,390,380,410,0
Asia,India,Mumbai,TV,4K 55",2024,Q2,Apr,530,350,360,370,0
Asia,India,Mumbai,TV,4K 55",2024,Q2,May,510,410,400,430,0
Asia,India,Mumbai,TV,4K 55",2024,Q2,Jun,510,460,440,470,0`;

class CSVUtils {
  /**
   * Robust CSV parser supporting quotes, commas, and escapes
   */
  static parse(csvText) {
    if (!csvText || typeof csvText !== 'string') return { headers: [], rows: [] };

    const lines = [];
    let currentLine = [];
    let currentField = '';
    let insideQuotes = false;

    const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nextCh = text[i + 1];

      if (ch === '"') {
        if (insideQuotes && nextCh === '"') {
          // Escaped quote
          currentField += '"';
          i++; // skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (ch === ',' && !insideQuotes) {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if (ch === '\n' && !insideQuotes) {
        currentLine.push(currentField.trim());
        if (currentLine.some(cell => cell.length > 0)) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }

    if (currentField.length > 0 || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.some(cell => cell.length > 0)) {
        lines.push(currentLine);
      }
    }

    if (lines.length === 0) return { headers: [], rows: [] };

    const rawHeaders = lines[0].map(h => h.replace(/^["']|["']$/g, '').trim());
    const dataRows = [];

    const numericFields = new Set([
      'price', 'actualsales', 'forecast', 'supply', 'initialinventory', 'sales', 'revenue',
      'demand', 'inventory', 'cost', 'target', 'discount', 'units', 'volume', 'qty'
    ]);

    for (let r = 1; r < lines.length; r++) {
      const rowArr = lines[r];
      const rowObj = {};
      rawHeaders.forEach((header, idx) => {
        let val = rowArr[idx] !== undefined ? rowArr[idx].replace(/^["']|["']$/g, '').trim() : '';
        const normHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (numericFields.has(normHeader) || /^-?\d+(\.\d+)?$/.test(val)) {
          const num = parseFloat(val);
          rowObj[header] = isNaN(num) ? 0 : num;
        } else {
          rowObj[header] = val;
        }
      });
      // Attach an internal unique ID for atomic updates
      rowObj.__row_id = 'row_' + r + '_' + Math.random().toString(36).substr(2, 6);
      dataRows.push(rowObj);
    }

    return {
      headers: rawHeaders,
      rows: dataRows
    };
  }

  /**
   * Exports an array of objects to CSV string
   */
  static stringify(rows, headers) {
    if (!rows || rows.length === 0) return '';
    const actualHeaders = headers || Object.keys(rows[0]).filter(k => !k.startsWith('__'));

    const headerLine = actualHeaders.map(h => CSVUtils.escapeCell(h)).join(',');
    const dataLines = rows.map(row => {
      return actualHeaders.map(h => CSVUtils.escapeCell(row[h] !== undefined ? row[h] : '')).join(',');
    });

    return [headerLine, ...dataLines].join('\r\n');
  }

  static escapeCell(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

window.DEFAULT_CSV_DATA = DEFAULT_CSV_DATA;
window.CSVUtils = CSVUtils;
