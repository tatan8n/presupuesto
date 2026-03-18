const { v4: uuidv4 } = require('uuid');

/**
 * Crea una entidad de Línea de Presupuesto a partir de una fila del Excel.
 * @param {Object} row - Fila del Excel como objeto clave-valor.
 * @param {number} index - Índice de la fila (para generar id si no existe).
 * @returns {Object} Línea de presupuesto normalizada.
 */
function createBudgetLine(row, index) {
  const line = {
    id_linea: row.id_linea || uuidv4(),
    cuenta: (row['Cuenta'] || '').toString().trim(),
    cuentaContable: (row['Cuenta contable'] || '').toString().trim(),
    area: (row['Área'] || '').toString().trim(),
    nombreElemento: (row['Nombre del elemento'] || '').toString().trim(),
    escenario: parseInt(row['Escenario']) || 1,
    fecha: (!row['Fecha'] || isNaN(Number(row['Fecha']))) ? null : Number(row['Fecha']),
    enero: parseFloat(row['Enero']) || 0,
    ogEnero: parseFloat(row['OG Enero']) || 0,
    fechaEnero: row['Fecha Enero'] || '',
    febrero: parseFloat(row['Febrero']) || 0,
    ogFebrero: parseFloat(row['OG Febrero']) || 0,
    fechaFebrero: row['Fecha Febrero'] || '',
    marzo: parseFloat(row['Marzo']) || 0,
    ogMarzo: parseFloat(row['OG Marzo']) || 0,
    fechaMarzo: row['Fecha Marzo'] || '',
    abril: parseFloat(row['Abril']) || 0,
    ogAbril: parseFloat(row['OG Abril']) || 0,
    fechaAbril: row['Fecha Abril'] || '',
    mayo: parseFloat(row['Mayo']) || 0,
    ogMayo: parseFloat(row['OG Mayo']) || 0,
    fechaMayo: row['Fecha Mayo'] || '',
    junio: parseFloat(row['Junio']) || 0,
    ogJunio: parseFloat(row['OG Junio']) || 0,
    fechaJunio: row['Fecha Junio'] || '',
    julio: parseFloat(row['Julio']) || 0,
    ogJulio: parseFloat(row['OG Julio']) || 0,
    fechaJulio: row['Fecha Julio'] || '',
    agosto: parseFloat(row['Agosto']) || 0,
    ogAgosto: parseFloat(row['OG Agosto']) || 0,
    fechaAgosto: row['Fecha Agosto'] || '',
    septiembre: parseFloat(row['Septiembre']) || 0,
    ogSeptiembre: parseFloat(row['OG Septiembre']) || 0,
    fechaSeptiembre: row['Fecha Septiembre'] || '',
    octubre: parseFloat(row['Octubre']) || 0,
    ogOctubre: parseFloat(row['OG Octubre']) || 0,
    fechaOctubre: row['Fecha Octubre'] || '',
    noviembre: parseFloat(row['Noviembre']) || 0,
    ogNoviembre: parseFloat(row['OG Noviembre']) || 0,
    fechaNoviembre: row['Fecha Noviembre'] || '',
    diciembre: parseFloat(row['Diciembre']) || 0,
    ogDiciembre: parseFloat(row['OG Diciembre']) || 0,
    fechaDiciembre: row['Fecha Diciembre'] || '',
    total: parseFloat(row['Total']) || 0,
    totalOriginal: parseFloat(row['Total Original']) || 0,
    icgi: (row['ICGI'] || '').toString().trim(),
    porcentaje: row['% Mat, CIF, com'] || '',
    linea: (row['Línea'] || '').toString().trim(),
    ejecutadoAcumulado: parseFloat(row.ejecutadoAcumulado) || 0,
    saldo: 0,
    estado: row.estado || 'activa',
    observaciones: row.observaciones || '',
  };
  return line;
}

/**
 * Convierte una línea de presupuesto interna al formato de columnas del Excel.
 * @param {Object} line - Línea de presupuesto interna.
 * @returns {Object} Fila para el Excel.
 */
function budgetLineToExcelRow(line) {
  return {
    'Cuenta': line.cuenta,
    'Cuenta contable': line.cuentaContable,
    'Área': line.area,
    'Nombre del elemento': line.nombreElemento,
    'Escenario': line.escenario,
    'Fecha': line.fecha || '',
    'Enero': line.enero,
    'OG Enero': line.ogEnero || 0,
    'Fecha Enero': line.fechaEnero,
    'Febrero': line.febrero,
    'OG Febrero': line.ogFebrero || 0,
    'Fecha Febrero': line.fechaFebrero,
    'Marzo': line.marzo,
    'OG Marzo': line.ogMarzo || 0,
    'Fecha Marzo': line.fechaMarzo,
    'Abril': line.abril,
    'OG Abril': line.ogAbril || 0,
    'Fecha Abril': line.fechaAbril,
    'Mayo': line.mayo,
    'OG Mayo': line.ogMayo || 0,
    'Fecha Mayo': line.fechaMayo,
    'Junio': line.junio,
    'OG Junio': line.ogJunio || 0,
    'Fecha Junio': line.fechaJunio,
    'Julio': line.julio,
    'OG Julio': line.ogJulio || 0,
    'Fecha Julio': line.fechaJulio,
    'Agosto': line.agosto,
    'OG Agosto': line.ogAgosto || 0,
    'Fecha Agosto': line.fechaAgosto,
    'Septiembre': line.septiembre,
    'OG Septiembre': line.ogSeptiembre || 0,
    'Fecha Septiembre': line.fechaSeptiembre,
    'Octubre': line.octubre,
    'OG Octubre': line.ogOctubre || 0,
    'Fecha Octubre': line.fechaOctubre,
    'Noviembre': line.noviembre,
    'OG Noviembre': line.ogNoviembre || 0,
    'Fecha Noviembre': line.fechaNoviembre,
    'Diciembre': line.diciembre,
    'OG Diciembre': line.ogDiciembre || 0,
    'Fecha Diciembre': line.fechaDiciembre,
    'Total': line.total,
    'Total Original': line.totalOriginal || 0,
    'ICGI': line.icgi,
    '% Mat, CIF, com': line.porcentaje,
    'Línea': line.linea,
  };
}

/**
 * Recalcula el total y saldo de una línea.
 * @param {Object} line - Línea de presupuesto.
 * @returns {Object} Línea con total y saldo recalculados.
 */
function recalculateLine(line) {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const ogMonths = [
    'ogEnero', 'ogFebrero', 'ogMarzo', 'ogAbril', 'ogMayo', 'ogJunio',
    'ogJulio', 'ogAgosto', 'ogSeptiembre', 'ogOctubre', 'ogNoviembre', 'ogDiciembre'
  ];
  line.total = months.reduce((sum, m) => sum + (parseFloat(line[m]) || 0), 0);
  line.totalOriginal = ogMonths.reduce((sum, m) => sum + (parseFloat(line[m]) || 0), 0);
  line.saldo = line.total - (line.ejecutadoAcumulado || 0);
  return line;
}

module.exports = { createBudgetLine, budgetLineToExcelRow, recalculateLine };
