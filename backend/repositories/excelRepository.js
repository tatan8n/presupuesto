const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createBudgetLine, budgetLineToExcelRow } = require('../models/BudgetLine');

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
 * Genera un archivo Excel de flujo de caja semanal en memoria y retorna el buffer.
 * @param {Array} lines - Array de líneas de presupuesto.
 * @returns {Buffer}
 */
function generateWeeklyCashFlowExcel(lines) {
  const MONTH_KEYS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const excelRows = lines.filter(l => l.estado === 'activa').map(line => {
    const row = {
      'Área': line.area,
      'Línea': line.linea,
      'Escenario': line.escenario,
      'Tipo (ICGI)': line.icgi,
      'Cuenta Contable': line.cuentaContable,
      'Número de cuenta': line.cuenta,
      'Fecha': line.fecha || '',
    };

    // Calculate weekly distribution for this line
    const weeks = Array(52).fill(0);
    MONTH_KEYS.forEach((month, monthIndex) => {
      const amount = line[month] || 0;
      if (amount === 0) return;

      let weekNumber;
      if (line.fecha && typeof line.fecha === 'number') {
        const date = new Date((line.fecha - 25569) * 86400 * 1000); // Excel date to JS date
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const diff = date - startOfYear;
        weekNumber = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
      } else {
        const lastDay = new Date(2026, monthIndex + 1, 0);
        const startOfYear = new Date(2026, 0, 1);
        const diff = lastDay - startOfYear;
        weekNumber = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
      }

      weekNumber = Math.max(0, Math.min(51, weekNumber)); // 0-indexed
      weeks[weekNumber] += amount;
    });

    weeks.forEach((amount, index) => {
      row[`Semana ${index + 1}`] = amount;
    });

    row['Total Flujo'] = line.total;

    return row;
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Flujo de Caja Semanal');

  // Format header row style if possible or just adjust column widths
  const colWidths = [
    { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }
  ];
  // add 52 columns for weeks
  for (let i = 0; i < 52; i++) {
    colWidths.push({ wch: 15 });
  }
  colWidths.push({ wch: 18 }); // Total
  worksheet['!cols'] = colWidths;

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { readBudgetFromExcel, writeBudgetToExcel, generateWeeklyCashFlowExcel };

