const { readBudgetFromExcel, writeBudgetToExcel, generateWeeklyCashFlowExcel } = require('../repositories/excelRepository');
const { fetchInvoices, fetchPurchaseOrders } = require('../repositories/dolibarrRepository');
const { createBudgetLine, recalculateLine } = require('../models/BudgetLine');
const { createMovement } = require('../models/Movement');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const supabaseRepository = require('../repositories/supabaseRepository');

// Estado en memoria
let movements = [];
let syncLog = [];

const MONTH_KEYS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

async function _getDbLines() {
  const data = await supabaseRepository.getAllBudgetLines();
  return data.map(supabaseRepository.mapSupabaseToApp);
}

/**
 * Carga el presupuesto desde un archivo Excel y efectúa un upsert a Supabase
 */
async function loadBudget(filePath, sheetName = 'Detalle') {
  const result = readBudgetFromExcel(filePath, sheetName);
  
  // Preservar id_linea para las líneas que ya existían pero asegurando unicidad absoluta
  const seenIds = new Set();
  const existingLines = await _getDbLines();
  
  const newLines = result.lines.map(newLine => {
    let existingLine = null;

    // Primero intentar buscar por id_linea si la línea ya lo trae y no ha sido usado
    if (newLine.id_linea && !seenIds.has(newLine.id_linea)) {
      existingLine = existingLines.find(l => l.id_linea === newLine.id_linea);
    }
    
    // Si no tiene id, buscar usando una heurística
    if (!existingLine) {
      existingLine = existingLines.find(l => 
        !seenIds.has(l.id_linea) &&
        l.cuenta === newLine.cuenta && 
        l.nombreElemento === newLine.nombreElemento &&
        l.area === newLine.area
      );
    }

    if (existingLine) {
      newLine.id_linea = existingLine.id_linea;
      newLine.ejecutadoAcumulado = existingLine.ejecutadoAcumulado;
    } else {
      if (!newLine.id_linea || seenIds.has(newLine.id_linea)) {
        newLine.id_linea = uuidv4();
      }
      newLine.ejecutadoAcumulado = newLine.ejecutadoAcumulado || 0;
    }

    seenIds.add(newLine.id_linea);
    
    // Inicializar campos originales si vienen vacíos (primera vez)
    MONTH_KEYS.forEach((month) => {
      const ogKey = `og${month.charAt(0).toUpperCase() + month.slice(1)}`;
      if (!newLine[ogKey] || newLine[ogKey] === 0) {
        newLine[ogKey] = newLine[month];
      }
    });

    return recalculateLine(newLine);
  });
  
  // Enviar las nuevas líneas a Supabase
  await supabaseRepository.upsertBudgetLines(newLines);
  
  return {
    totalLines: newLines.length,
    sheetNames: result.sheetNames,
    summary: await getSummary(),
  };
}

/**
 * Obtiene un resumen general del presupuesto cargado.
 */
async function getSummary() {
  const activeLines = await _getDbLines();
  const totalBudget = activeLines.reduce((sum, l) => sum + l.total, 0);
  const totalExecuted = activeLines.reduce((sum, l) => sum + l.ejecutadoAcumulado, 0);

  const byArea = {};
  const byLinea = {};
  const byEscenario = {};
  const byICGI = {};

  activeLines.forEach(l => {
    if (!byArea[l.area]) byArea[l.area] = { presupuesto: 0, ejecutado: 0, count: 0 };
    byArea[l.area].presupuesto += l.total;
    byArea[l.area].ejecutado += l.ejecutadoAcumulado;
    byArea[l.area].count++;

    if (!byLinea[l.linea]) byLinea[l.linea] = { presupuesto: 0, ejecutado: 0, count: 0 };
    byLinea[l.linea].presupuesto += l.total;
    byLinea[l.linea].ejecutado += l.ejecutadoAcumulado;
    byLinea[l.linea].count++;

    const esc = `Escenario ${l.escenario}`;
    if (!byEscenario[esc]) byEscenario[esc] = { presupuesto: 0, ejecutado: 0, count: 0 };
    byEscenario[esc].presupuesto += l.total;
    byEscenario[esc].ejecutado += l.ejecutadoAcumulado;
    byEscenario[esc].count++;

    if (l.icgi) {
      if (!byICGI[l.icgi]) byICGI[l.icgi] = { presupuesto: 0, ejecutado: 0, count: 0 };
      byICGI[l.icgi].presupuesto += l.total;
      byICGI[l.icgi].ejecutado += l.ejecutadoAcumulado;
      byICGI[l.icgi].count++;
    }
  });

  return { totalBudget, totalExecuted, byArea, byLinea, byEscenario, byICGI, totalLines: activeLines.length };
}

/**
 * Obtiene líneas de presupuesto con filtros opcionales.
 */
async function getBudgetLines(filters = {}) {
  let result = await _getDbLines();
  // Helper: if value is already an array, use it; otherwise split by ||| (safe separator that won't appear in names)
  const toArray = (val) => Array.isArray(val) ? val : String(val).split('|||').filter(Boolean);

  if (filters.area) {
    const arr = toArray(filters.area);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.area));
  }
  if (filters.linea) {
    const arr = toArray(filters.linea);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.linea));
  }
  if (filters.escenario) {
    const arr = toArray(filters.escenario).map(Number);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.escenario));
  }
  if (filters.icgi) {
    const arr = toArray(filters.icgi);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.icgi));
  }
  if (filters.cuentaContable) {
    const arr = toArray(filters.cuentaContable);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.cuentaContable));
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(l =>
      l.nombreElemento.toLowerCase().includes(s) ||
      l.cuenta.toLowerCase().includes(s) ||
      l.cuentaContable.toLowerCase().includes(s)
    );
  }

  return result;
}

/**
 * Obtiene una línea por su ID.
 */
async function getBudgetLineById(id) {
  const lines = await _getDbLines();
  return lines.find(l => l.id_linea === id) || null;
}

/**
 * Crea una nueva línea de presupuesto en Supabase.
 */
async function createLine(data) {
  const line = {
    id_linea: uuidv4(),
    cuenta: data.cuenta || '',
    cuentaContable: data.cuentaContable || '',
    area: data.area || '',
    nombreElemento: data.nombreElemento || '',
    escenario: parseInt(data.escenario) || 1,
    fecha: data.fecha || null,
    enero: parseFloat(data.enero) || 0,
    ogEnero: parseFloat(data.ogEnero) || parseFloat(data.enero) || 0,
    fechaEnero: data.fechaEnero || '',
    lineaEnero: data.lineaEnero || '',
    febrero: parseFloat(data.febrero) || 0,
    ogFebrero: parseFloat(data.ogFebrero) || parseFloat(data.febrero) || 0,
    fechaFebrero: data.fechaFebrero || '',
    lineaFebrero: data.lineaFebrero || '',
    marzo: parseFloat(data.marzo) || 0,
    ogMarzo: parseFloat(data.ogMarzo) || parseFloat(data.marzo) || 0,
    fechaMarzo: data.fechaMarzo || '',
    lineaMarzo: data.lineaMarzo || '',
    abril: parseFloat(data.abril) || 0,
    ogAbril: parseFloat(data.ogAbril) || parseFloat(data.abril) || 0,
    fechaAbril: data.fechaAbril || '',
    lineaAbril: data.lineaAbril || '',
    mayo: parseFloat(data.mayo) || 0,
    ogMayo: parseFloat(data.ogMayo) || parseFloat(data.mayo) || 0,
    fechaMayo: data.fechaMayo || '',
    lineaMayo: data.lineaMayo || '',
    junio: parseFloat(data.junio) || 0,
    ogJunio: parseFloat(data.ogJunio) || parseFloat(data.junio) || 0,
    fechaJunio: data.fechaJunio || '',
    lineaJunio: data.lineaJunio || '',
    julio: parseFloat(data.julio) || 0,
    ogJulio: parseFloat(data.ogJulio) || parseFloat(data.julio) || 0,
    fechaJulio: data.fechaJulio || '',
    lineaJulio: data.lineaJulio || '',
    agosto: parseFloat(data.agosto) || 0,
    ogAgosto: parseFloat(data.ogAgosto) || parseFloat(data.agosto) || 0,
    fechaAgosto: data.fechaAgosto || '',
    lineaAgosto: data.lineaAgosto || '',
    septiembre: parseFloat(data.septiembre) || 0,
    ogSeptiembre: parseFloat(data.ogSeptiembre) || parseFloat(data.septiembre) || 0,
    fechaSeptiembre: data.fechaSeptiembre || '',
    lineaSeptiembre: data.lineaSeptiembre || '',
    octubre: parseFloat(data.octubre) || 0,
    ogOctubre: parseFloat(data.ogOctubre) || parseFloat(data.octubre) || 0,
    fechaOctubre: data.fechaOctubre || '',
    lineaOctubre: data.lineaOctubre || '',
    noviembre: parseFloat(data.noviembre) || 0,
    ogNoviembre: parseFloat(data.ogNoviembre) || parseFloat(data.noviembre) || 0,
    fechaNoviembre: data.fechaNoviembre || '',
    lineaNoviembre: data.lineaNoviembre || '',
    diciembre: parseFloat(data.diciembre) || 0,
    ogDiciembre: parseFloat(data.ogDiciembre) || parseFloat(data.diciembre) || 0,
    fechaDiciembre: data.fechaDiciembre || '',
    lineaDiciembre: data.lineaDiciembre || '',
    total: 0,
    totalOriginal: 0,
    icgi: data.icgi || '',
    porcentaje: data.porcentaje || '',
    linea: data.linea || '',
    ejecutadoAcumulado: 0,
    saldo: 0,
    estado: 'activa',
    observaciones: data.observaciones || '',
  };

  recalculateLine(line);
  await supabaseRepository.upsertBudgetLines([line]);
  return line;
}

/**
 * Actualiza una línea existente en Supabase.
 */
async function updateLine(id, data) {
  const line = await getBudgetLineById(id);
  if (!line) throw new Error(`Línea ${id} no encontrada.`);

  const updatableFields = [
    'cuenta', 'cuentaContable', 'area', 'nombreElemento', 'escenario', 'fecha',
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    'ogEnero', 'ogFebrero', 'ogMarzo', 'ogAbril', 'ogMayo', 'ogJunio',
    'ogJulio', 'ogAgosto', 'ogSeptiembre', 'ogOctubre', 'ogNoviembre', 'ogDiciembre',
    'fechaEnero', 'fechaFebrero', 'fechaMarzo', 'fechaAbril', 'fechaMayo', 'fechaJunio',
    'fechaJulio', 'fechaAgosto', 'fechaSeptiembre', 'fechaOctubre', 'fechaNoviembre', 'fechaDiciembre',
    'lineaEnero', 'lineaFebrero', 'lineaMarzo', 'lineaAbril', 'lineaMayo', 'lineaJunio',
    'lineaJulio', 'lineaAgosto', 'lineaSeptiembre', 'lineaOctubre', 'lineaNoviembre', 'lineaDiciembre',
    'icgi', 'porcentaje', 'linea', 'observaciones'
  ];

  updatableFields.forEach(field => {
    if (data[field] !== undefined) {
      if (MONTH_KEYS.includes(field)) {
        line[field] = parseFloat(data[field]) || 0;
      } else if (field === 'escenario') {
        line[field] = parseInt(data[field]) || 1;
      } else {
        line[field] = data[field];
      }
    }
  });

  recalculateLine(line);
  await supabaseRepository.updateBudgetLine(id, line);
  return line;
}

/**
 * Elimina una línea.
 */
async function deleteLine(id, physical = false) {
  const line = await getBudgetLineById(id);
  if (!line) throw new Error(`Línea ${id} no encontrada.`);

  const hasMovements = movements.some(m => m.id_linea_presupuesto === id);
  if (physical && hasMovements) {
    throw new Error('No se puede eliminar físicamente una línea con movimientos vinculados. Use eliminación lógica.');
  }

  await supabaseRepository.deleteBudgetLine(id, physical);
  return { deleted: true, physical, id };
}

/**
 * Guarda los datos actuales en un archivo Excel.
 */
async function saveToExcel(filePath, sheetName = 'Detalle') {
  if (!filePath) throw new Error('Se requiere una ruta de destino para guardar el Excel.');
  const lines = await _getDbLines();
  return writeBudgetToExcel(filePath, sheetName, lines);
}

/**
 * Exporta el reporte semanal en formato binario.
 */
async function exportWeeklyExcel(filters = {}) {
  const lines = await getBudgetLines(filters);
  return generateWeeklyCashFlowExcel(lines);
}

/**
 * Calcula KPIs globales con filtros opcionales.
 */
async function getKPIs(filters = {}) {
  const lines = await getBudgetLines(filters);

  let totalPresupuesto = 0;
  let totalPresupuestoInicial = 0;
  let totalEjecutado = 0;
  const byArea = {};
  const byLinea = {};
  const byEscenario = {};
  const byICGI = {};

  lines.forEach(line => {
    totalPresupuesto += (line.total || 0);
    totalPresupuestoInicial += (line.totalOriginal || 0);
    totalEjecutado += (line.ejecutadoAcumulado || 0);

    // 1. byArea: stays as is (item-level)
    if (line.area) {
      if (!byArea[line.area]) byArea[line.area] = { presupuesto: 0, presupuestoInicial: 0, ejecutado: 0 };
      byArea[line.area].presupuesto += (line.total || 0);
      byArea[line.area].presupuestoInicial += (line.totalOriginal || 0);
      byArea[line.area].ejecutado += (line.ejecutadoAcumulado || 0);
    }

    // 2. byLinea: must be calculated month-by-month for overrides
    MONTH_KEYS.forEach(m => {
      const lineaKey = `linea${m.charAt(0).toUpperCase() + m.slice(1)}`;
      const activeLinea = line[lineaKey] || line.linea || 'Sin línea';
      const amount = line[m] || 0;
      
      if (!byLinea[activeLinea]) byLinea[activeLinea] = { presupuesto: 0, ejecutado: 0 };
      byLinea[activeLinea].presupuesto += amount;
      // Note: ejecutado is tricky since it's cumulative and not per-month in current schema,
      // but the user asked for "sumatoria por linea de negocio", so we assume the majority
      // of cases use the item-level linea for execution or we'll need to refactor execution too.
      // For now, if we have a monthly amount, we attribute its proportion to the linea.
      // Actually, since execution is not per month in the backend currently (only total_ejecutado), 
      // we'll attribute execution proportionally or just to the item's main linea.
      // Given the prompt, let's focus on the budget (presupuesto).
    });

    // Attribute executed items to the main linea for now (simplified)
    if (line.linea) {
      if (!byLinea[line.linea]) byLinea[line.linea] = { presupuesto: 0, ejecutado: 0 };
      byLinea[line.linea].ejecutado += (line.ejecutadoAcumulado || 0);
    }

    const esc = `${line.escenario}`;
    if (!byEscenario[esc]) byEscenario[esc] = { presupuesto: 0, presupuestoInicial: 0, ejecutado: 0 };
    byEscenario[esc].presupuesto += (line.total || 0);
    byEscenario[esc].presupuestoInicial += (line.totalOriginal || 0);
    byEscenario[esc].ejecutado += (line.ejecutadoAcumulado || 0);

    if (line.icgi) {
      if (!byICGI[line.icgi]) byICGI[line.icgi] = { presupuesto: 0, presupuestoInicial: 0, ejecutado: 0 };
      byICGI[line.icgi].presupuesto += (line.total || 0);
      byICGI[line.icgi].presupuestoInicial += (line.totalOriginal || 0);
      byICGI[line.icgi].ejecutado += (line.ejecutadoAcumulado || 0);
    }
  });

  // Cross-tab: ICGI breakdown per business line (línea de negocio)
  const byLineaICGI = {};
  lines.forEach(line => {
    const icgi = line.icgi || 'Sin tipo';
    
    MONTH_KEYS.forEach(m => {
      const lineaKey = `linea${m.charAt(0).toUpperCase() + m.slice(1)}`;
      const activeLinea = line[lineaKey] || line.linea || 'Sin línea';
      const amount = line[m] || 0;
      
      if (!byLineaICGI[activeLinea]) byLineaICGI[activeLinea] = {};
      if (!byLineaICGI[activeLinea][icgi]) byLineaICGI[activeLinea][icgi] = 0;
      byLineaICGI[activeLinea][icgi] += amount;
    });
  });

  const monthlyBudget = MONTH_KEYS.map(m => lines.reduce((sum, l) => sum + (l[m] || 0), 0));

  return {
    totalPresupuesto,
    totalPresupuestoInicial,
    totalEjecutado,
    saldo: totalPresupuesto - totalEjecutado,
    saldoInicial: totalPresupuestoInicial - totalEjecutado,
    porcentajeEjecucion: totalPresupuesto > 0 ? (totalEjecutado / totalPresupuesto) * 100 : 0,
    monthlyBudget,
    byArea,
    byLinea,
    byEscenario,
    byICGI,
    byLineaICGI,
    totalLines: lines.length,
  };
}

/**
 * Calcula flujo semanal estimado.
 */
async function getWeeklyFlow(filters = {}) {
  const lines = await getBudgetLines(filters);
  const weeks = Array(52).fill(0);

  lines.forEach(line => {
    MONTH_KEYS.forEach((month, monthIndex) => {
      const amount = line[month] || 0;
      if (amount === 0) return;

      let weekNumber;

      if (line.fecha && typeof line.fecha === 'number') {
        const date = new Date((line.fecha - 25569) * 86400 * 1000);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const diff = date - startOfYear;
        weekNumber = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
      } else {
        const lastDay = new Date(2026, monthIndex + 1, 0);
        const startOfYear = new Date(2026, 0, 1);
        const diff = lastDay - startOfYear;
        weekNumber = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
      }

      weekNumber = Math.max(0, Math.min(51, weekNumber));
      weeks[weekNumber] += amount;
    });
  });

  return weeks.map((amount, i) => ({
    semana: i + 1,
    presupuestado: amount,
    ejecutado: 0,
  }));
}

/**
 * Sincroniza movimientos desde Dolibarr y actualiza ejecutado en Supabase.
 */
async function syncDolibarr(dolibarrConfig) {
  const cfg = dolibarrConfig || config.dolibarr;

  const [invoices, orders] = await Promise.all([
    fetchInvoices(cfg),
    fetchPurchaseOrders(cfg),
  ]);

  const newMovements = [];

  invoices.forEach(inv => {
    const mov = createMovement({ ...inv, tipo_documento: 'factura_proveedor' });
    if (mov.id_linea_presupuesto) newMovements.push(mov);
  });

  orders.forEach(ord => {
    const mov = createMovement({ ...ord, tipo_documento: 'orden_compra' });
    if (mov.id_linea_presupuesto) newMovements.push(mov);
  });

  movements = newMovements;

  const ejecutadoPorLinea = {};
  movements.forEach(m => {
    if (!ejecutadoPorLinea[m.id_linea_presupuesto]) ejecutadoPorLinea[m.id_linea_presupuesto] = 0;
    ejecutadoPorLinea[m.id_linea_presupuesto] += m.monto;
  });

  const budgetLines = await _getDbLines();
  const modifiedLines = [];
  budgetLines.forEach(line => {
    const newExec = ejecutadoPorLinea[line.id_linea] || 0;
    if (line.ejecutadoAcumulado !== newExec) {
      line.ejecutadoAcumulado = newExec;
      recalculateLine(line);
      modifiedLines.push(line);
    }
  });

  if (modifiedLines.length > 0) {
    await supabaseRepository.upsertBudgetLines(modifiedLines);
  }

  const logEntry = {
    fecha: new Date().toISOString(),
    facturas: invoices.length,
    ordenes: orders.length,
    movimientosVinculados: newMovements.length,
  };
  syncLog.push(logEntry);

  return logEntry;
}

/**
 * Obtiene los valores únicos de los filtros.
 */
async function getFilterOptions() {
  const activeLines = await _getDbLines();
  
  const cuentasUnicas = {};
  activeLines.forEach(l => {
    if (l.cuentaContable && l.cuenta) {
      cuentasUnicas[l.cuentaContable] = l.cuenta;
    }
  });

  return {
    areas: [...new Set(activeLines.map(l => l.area).filter(Boolean))].sort(),
    lineas: [...new Set(activeLines.map(l => l.linea).filter(Boolean))].sort(),
    escenarios: [...new Set(activeLines.map(l => l.escenario))].sort(),
    tipos: [...new Set(activeLines.map(l => l.icgi).filter(Boolean))].sort(),
    cuentasContables: [...new Set(activeLines.map(l => l.cuentaContable).filter(Boolean))].sort(),
    cuentas: Object.entries(cuentasUnicas).map(([nombre, numero]) => ({ nombre, numero })).sort((a,b) => a.nombre.localeCompare(b.nombre)),
  };
}

async function getSyncLog() {
  return syncLog;
}

/**
 * Obtiene los datos mensuales.
 */
async function getMonthlyData(filters = {}) {
  const lines = await getBudgetLines(filters);

  return MONTH_KEYS.map((month, index) => {
    const ogMonthKey = `og${month.charAt(0).toUpperCase() + month.slice(1)}`;
    const total = lines.reduce((sum, l) => sum + (l[month] || 0), 0);
    const totalOriginal = lines.reduce((sum, l) => sum + (l[ogMonthKey] || 0), 0);
    return {
      mes: config.months ? config.months[index] : month,
      mesKey: month,
      presupuestado: total,
      presupuestadoInicial: totalOriginal,
      ejecutado: 0,
    };
  });
}

module.exports = {
  loadBudget,
  getSummary,
  getBudgetLines,
  getBudgetLineById,
  createLine,
  updateLine,
  deleteLine,
  saveToExcel,
  exportWeeklyExcel,
  getKPIs,
  getWeeklyFlow,
  syncDolibarr,
  getFilterOptions,
  getSyncLog,
  getMonthlyData,
};
