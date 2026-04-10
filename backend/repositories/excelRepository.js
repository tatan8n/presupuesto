const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createBudgetLine, budgetLineToExcelRow } = require('../models/BudgetLine');
const { getCurrentWeek } = require('../utils/dateUtils');

/**
 * Lee el presupuesto desde un archivo Excel.
 * @param {string} filePath - Ruta al archivo Excel.
 * @param {string} sheetName - Nombre de la hoja a leer.
 * @returns {{ lines: Array, sheetNames: string[] }}
 */
function readBudgetFromExcel(filePath, sheetName = 'Detalle') {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  if (!workbook.Sheets[sheetName]) {
    throw new Error(`La hoja "${sheetName}" no existe en el archivo. Hojas disponibles: ${sheetNames.join(', ')}`);
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const lines = rawData
    .filter(row => {
      // Filtrar filas vacías o sin cuenta
      const cuenta = (row['Cuenta'] || '').toString().trim();
      return cuenta.length > 0;
    })
    .map((row, index) => createBudgetLine(row, index));

  return { lines, sheetNames };
}

/**
 * Escribe el presupuesto de vuelta al Excel, creando un backup previo.
 * @param {string} filePath - Ruta al archivo Excel.
 * @param {string} sheetName - Nombre de la hoja a escribir.
 * @param {Array} lines - Array de líneas de presupuesto.
 */
function writeBudgetToExcel(filePath, sheetName, lines) {
  // Crear backup
  const backupDir = path.join(path.dirname(filePath), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const backupPath = path.join(backupDir, `${baseName}_backup_${timestamp}${ext}`);
  fs.copyFileSync(filePath, backupPath);

  // Leer workbook existente para preservar otras hojas
  const workbook = XLSX.readFile(filePath);

  // Convertir líneas a formato Excel
  const excelRows = lines
    .filter(l => l.estado === 'activa')
    .map(budgetLineToExcelRow);

  // Reemplazar la hoja
  const newSheet = XLSX.utils.json_to_sheet(excelRows);
  workbook.Sheets[sheetName] = newSheet;

  // Escribir
  XLSX.writeFile(workbook, filePath);

  return { backupPath, rowsWritten: excelRows.length };
}

/**
 * Obtiene los nombres de las hojas del archivo Excel.
 * @param {string} filePath - Ruta al archivo.
 * @returns {string[]}
 */
/**
 * Genera un archivo Excel de flujo de caja semanal simplificado.
 * @param {Array} lines - Array de líneas de presupuesto.
 * @param {Object} options - Opciones de exportación (startWeek, endWeek, simplified).
 * @returns {Buffer}
 */
function generateWeeklyCashFlowExcel(lines, options = {}) {
  const { startWeek = 1, endWeek = 52, simplified = true } = options;
  const MONTH_KEYS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const excelRows = lines.filter(l => l.estado === 'activa').map(line => {
    const row = {
      'Área': line.area,
      'Nombre del elemento': line.nombreElemento,
    };

    if (!simplified) {
      row['Línea'] = line.linea;
      row['Escenario'] = line.escenario;
      row['Tipo (ICGI)'] = line.icgi;
      row['Cuenta Contable'] = line.cuentaContable;
      row['Número de cuenta'] = line.cuenta;
    }

    const weeks = Array(52).fill(0);
    const MONTH_FIELDS = [
      { key: 'enero', dateKey: 'fechaEnero' },
      { key: 'febrero', dateKey: 'fechaFebrero' },
      { key: 'marzo', dateKey: 'fechaMarzo' },
      { key: 'abril', dateKey: 'fechaAbril' },
      { key: 'mayo', dateKey: 'fechaMayo' },
      { key: 'junio', dateKey: 'fechaJunio' },
      { key: 'julio', dateKey: 'fechaJulio' },
      { key: 'agosto', dateKey: 'fechaAgosto' },
      { key: 'septiembre', dateKey: 'fechaSeptiembre' },
      { key: 'octubre', dateKey: 'fechaOctubre' },
      { key: 'noviembre', dateKey: 'fechaNoviembre' },
      { key: 'diciembre', dateKey: 'fechaDiciembre' },
    ];

    MONTH_FIELDS.forEach((m, monthIndex) => {
      const amount = line[m.key] || 0;
      if (amount === 0) return;

      let weekNumber;
      if (line[m.dateKey]) {
        const day = parseInt(line[m.dateKey]);
        const date = new Date(2026, monthIndex, day);
        weekNumber = getCurrentWeek(date) - 1;
      } 
      else if (line.fecha && typeof line.fecha === 'number') {
        const date = new Date((line.fecha - 25569) * 86400 * 1000);
        if (date.getMonth() === monthIndex) {
          weekNumber = getCurrentWeek(date) - 1;
        } else {
          const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
          const defaultDate = new Date(2026, monthIndex, lastDay);
          weekNumber = getCurrentWeek(defaultDate) - 1;
        }
      } 
      else {
        const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
        const defaultDate = new Date(2026, monthIndex, lastDay);
        weekNumber = getCurrentWeek(defaultDate) - 1;
      }

      weekNumber = Math.max(0, Math.min(51, weekNumber));
      weeks[weekNumber] += amount;
    });

    // Only add requested weeks
    for (let i = startWeek - 1; i < endWeek; i++) {
      row[`${i + 1}`] = weeks[i] || 0;
    }

    if (!simplified) {
      row['Total Flujo'] = line.total;
    }

    return row;
  });

  const workbook = XLSX.utils.book_new();

  // Create AoA (Array of Arrays) to have a multi-line header
  const headerRow1 = ['Área', 'Nombre del elemento'];
  if (!simplified) {
    headerRow1.push('Línea', 'Escenario', 'Tipo (ICGI)', 'Cuenta Contable', 'Número de cuenta');
  }
  const headerRow2 = [...headerRow1.map(() => '')]; // empty under static fields

  // Month assignment per week
  for (let i = startWeek - 1; i < endWeek; i++) {
     const approxMonth = Math.floor(i / 4.33); // basic approximation
     const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
     headerRow1.push(monthNames[Math.min(11, approxMonth)]);
     headerRow2.push(`${i + 1}`);
  }
  
  if (!simplified) {
     headerRow1.push('');
     headerRow2.push('Total Flujo');
  }

  const aoa = [headerRow1, headerRow2];
  
  // Data rows
  excelRows.forEach(row => {
     const rowArr = [];
     rowArr.push(row['Área']);
     rowArr.push(row['Nombre del elemento']);
     if (!simplified) {
       rowArr.push(row['Línea'], row['Escenario'], row['Tipo (ICGI)'], row['Cuenta Contable'], row['Número de cuenta']);
     }
     for (let i = startWeek - 1; i < endWeek; i++) {
       rowArr.push(row[`${i + 1}`]);
     }
     if (!simplified) rowArr.push(row['Total Flujo']);
     aoa.push(rowArr);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  // Merge month cells (ejemplo, dejamos así por ahora)

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Flujo Semanal');

  // Adjust column widths
  const colWidths = [
    { wch: 15 }, // Área
    { wch: 35 }, // Nombre
  ];
  if (!simplified) {
    colWidths.push({ wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 });
  }
  for (let i = startWeek - 1; i < endWeek; i++) {
    colWidths.push({ wch: 12 });
  }
  worksheet['!cols'] = colWidths;

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function generateCustomWeeklyCashFlowExcel(customData, options = {}) {
  const { startWeek = 1, endWeek = 52 } = options;
  const workbook = XLSX.utils.book_new();

  // Ordenar: Facturas Pendientes arriba, luego Presupuestado ordenado por Área
  customData.sort((a, b) => {
    const typeA = a.tipificacion || 'Presupuestado';
    const typeB = b.tipificacion || 'Presupuestado';
    if (typeA !== typeB) {
      return typeA === 'Factura Pendiente' ? -1 : 1;
    }
    return (a.area || '').localeCompare(b.area || '');
  });

  const headerRow1 = ['Área', 'Tipificación', 'Nombre del elemento'];
  const headerRow2 = ['', '', '']; 

  for (let i = startWeek - 1; i < endWeek; i++) {
     const approxMonth = Math.floor(i / 4.33); 
     const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
     headerRow1.push(monthNames[Math.min(11, approxMonth)]);
     headerRow2.push(`${i + 1}`);
  }
  
  const aoa = [headerRow1, headerRow2];
  
  customData.forEach(row => {
     const rowArr = [
       row.area || '', 
       row.tipificacion || 'Presupuestado', 
       row.nombreElemento || ''
     ];
     for (let i = startWeek; i <= endWeek; i++) {
       rowArr.push(row[`w${i}`] || 0);
     }
     aoa.push(rowArr);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Adjust column widths
  const colWidths = [ { wch: 15 }, { wch: 20 }, { wch: 35 }, { wch: 15 } ];
  for (let i = startWeek - 1; i < endWeek; i++) { colWidths.push({ wch: 12 }); }
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Flujo Refinado');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { readBudgetFromExcel, writeBudgetToExcel, generateWeeklyCashFlowExcel, generateCustomWeeklyCashFlowExcel };

