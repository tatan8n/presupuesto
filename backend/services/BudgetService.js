const { readBudgetFromExcel, writeBudgetToExcel, generateWeeklyCashFlowExcel } = require('../repositories/excelRepository');
const { fetchInvoices, fetchPurchaseOrders, fetchExpenseReports } = require('../repositories/dolibarrRepository');
const { createBudgetLine, recalculateLine } = require('../models/BudgetLine');
const { createMovement } = require('../models/Movement');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const config = require('../config');
const supabaseRepository = require('../repositories/supabaseRepository');
const fs = require('fs');
const path = require('path');
const { getExchangeRateToCOP, unixToDateStr } = require('../utils/currencyUtils');

// Estado en memoria
let movements = [];
let syncLog = [];

const MONTH_KEYS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// ============================================================
// Cache en memoria con TTL para reducir peticiones a Supabase
// Las operaciones de escritura invalidan el cache.
// ============================================================
let _cache = null;      // Array de líneas activas
let _cacheTs = 0;       // Timestamp de última carga
const CACHE_TTL_MS = 30_000; // 30 segundos

function _invalidateCache() {
  _cache = null;
  _cacheTs = 0;
}

/**
 * Devuelve líneas de presupuesto activas (excluye 'eliminada').
 * Usa cache con TTL de 30s para evitar múltiples round-trips a Supabase.
 */
async function _getDbLines() {
  const now = Date.now();
  if (_cache && (now - _cacheTs) < CACHE_TTL_MS) {
    return _cache;
  }
  const data = await supabaseRepository.getAllBudgetLines();
  _cache = data.map(supabaseRepository.mapSupabaseToApp);
  _cacheTs = Date.now();
  return _cache;
}

/**
 * Devuelve TODAS las líneas incluyendo las eliminadas (para la vista de tabla).
 * No usa cache ya que es una consulta especial para el panel de administración.
 */
async function _getAllDbLinesIncludeDeleted() {
  const data = await supabaseRepository.getAllBudgetLinesIncludeDeleted();
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
  
  // Enviar las nuevas líneas a Supabase e invalidar cache
  await supabaseRepository.upsertBudgetLines(newLines);
  _invalidateCache();
  
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
 * Si includeDeleted=true, devuelve también las eliminadas (para la tabla de detalle).
 */
async function getBudgetLines(filters = {}) {
  // Decidir si incluir eliminadas
  const includeDeleted = filters.includeDeleted === 'true' || filters.includeDeleted === true;
  const { includeDeleted: _removed, ...cleanFilters } = filters;

  let result = includeDeleted
    ? await _getAllDbLinesIncludeDeleted()
    : await _getDbLines();

  // Helper: if value is already an array, use it; otherwise split by ||| (safe separator)
  const toArray = (val) => Array.isArray(val) ? val : String(val).split('|||').filter(Boolean);

  if (cleanFilters.area) {
    const arr = toArray(cleanFilters.area);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.area));
  }
  if (cleanFilters.linea) {
    const arr = toArray(cleanFilters.linea);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.linea));
  }
  if (cleanFilters.escenario) {
    const arr = toArray(cleanFilters.escenario).map(Number);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.escenario));
  }
  if (cleanFilters.icgi) {
    const arr = toArray(cleanFilters.icgi);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.icgi));
  }
  if (cleanFilters.cuentaContable) {
    const arr = toArray(cleanFilters.cuentaContable);
    if (arr.length > 0) result = result.filter(l => arr.includes(l.cuentaContable));
  }
  if (cleanFilters.search) {
    const s = cleanFilters.search.toLowerCase();
    result = result.filter(l =>
      l.nombreElemento.toLowerCase().includes(s) ||
      l.cuenta.toLowerCase().includes(s) ||
      l.cuentaContable.toLowerCase().includes(s)
    );
  }

  if (cleanFilters.filterEERR === 'true' || cleanFilters.filterEERR === true) {
    result = result.filter(line => {
      const isIngreso = (line.cuenta || '').startsWith('01');
      const cc = (line.cuentaContable || '').toLowerCase();
      const isSalary = cc.includes('salario') || cc.includes('sueldo');
      const isExtra = cc.includes('comision') || cc.includes('bonificacion') || cc.includes('industria y comercio') || cc.includes('compra implemento');
      return !isIngreso && !isSalary && !isExtra;
    });
  }

  // Filtro especial: costos, gastos fijos e inversiones SIN salarios
  if (cleanFilters.excludeSalarios === 'true' || cleanFilters.excludeSalarios === true) {
    result = result.filter(line => {
      const isIngreso = (line.cuenta || '').startsWith('01');
      const cc = (line.cuentaContable || '').toLowerCase();
      const isSalary = cc.includes('salario') || cc.includes('sueldo');
      const isExtra = cc.includes('comision') || cc.includes('bonificacion') || cc.includes('industria y comercio') || cc.includes('compra implemento');
      return !isIngreso && !isSalary && !isExtra;
    });
  }

  return result;
}

/**
 * Obtiene una línea por su ID.
 */
async function getBudgetLineById(id) {
  const lines = await _getAllDbLinesIncludeDeleted();
  return lines.find(l => l.id_linea === id) || null;
}

/**
 * Crea una nueva línea de presupuesto en Supabase.
 * Al crear una línea nueva, el presupuesto inicial (og*) siempre es 0.
 * Solo se puede editar el presupuesto actual.
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
    // Presupuesto actual (editable)
    enero: parseFloat(data.enero) || 0,
    febrero: parseFloat(data.febrero) || 0,
    marzo: parseFloat(data.marzo) || 0,
    abril: parseFloat(data.abril) || 0,
    mayo: parseFloat(data.mayo) || 0,
    junio: parseFloat(data.junio) || 0,
    julio: parseFloat(data.julio) || 0,
    agosto: parseFloat(data.agosto) || 0,
    septiembre: parseFloat(data.septiembre) || 0,
    octubre: parseFloat(data.octubre) || 0,
    noviembre: parseFloat(data.noviembre) || 0,
    diciembre: parseFloat(data.diciembre) || 0,
    // Presupuesto inicial siempre en 0 para líneas nuevas
    ogEnero: 0, ogFebrero: 0, ogMarzo: 0, ogAbril: 0, ogMayo: 0, ogJunio: 0,
    ogJulio: 0, ogAgosto: 0, ogSeptiembre: 0, ogOctubre: 0, ogNoviembre: 0, ogDiciembre: 0,
    // Fechas y líneas por mes
    fechaEnero: data.fechaEnero || '', lineaEnero: data.lineaEnero || '',
    fechaFebrero: data.fechaFebrero || '', lineaFebrero: data.lineaFebrero || '',
    fechaMarzo: data.fechaMarzo || '', lineaMarzo: data.lineaMarzo || '',
    fechaAbril: data.fechaAbril || '', lineaAbril: data.lineaAbril || '',
    fechaMayo: data.fechaMayo || '', lineaMayo: data.lineaMayo || '',
    fechaJunio: data.fechaJunio || '', lineaJunio: data.lineaJunio || '',
    fechaJulio: data.fechaJulio || '', lineaJulio: data.lineaJulio || '',
    fechaAgosto: data.fechaAgosto || '', lineaAgosto: data.lineaAgosto || '',
    fechaSeptiembre: data.fechaSeptiembre || '', lineaSeptiembre: data.lineaSeptiembre || '',
    fechaOctubre: data.fechaOctubre || '', lineaOctubre: data.lineaOctubre || '',
    fechaNoviembre: data.fechaNoviembre || '', lineaNoviembre: data.lineaNoviembre || '',
    fechaDiciembre: data.fechaDiciembre || '', lineaDiciembre: data.lineaDiciembre || '',
    total: 0,
    totalOriginal: 0,
    icgi: data.icgi || '',
    porcentaje: data.porcentaje || '',
    linea: data.linea || '',
    tipoComportamiento: data.tipoComportamiento || 'Normal',
    ejecutadoAcumulado: 0,
    saldo: 0,
    estado: 'activa',
    observaciones: data.observaciones || '',
  };

  recalculateLine(line);
  await supabaseRepository.upsertBudgetLines([line]);
  _invalidateCache();
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
    'icgi', 'porcentaje', 'linea', 'observaciones', 'tipoComportamiento'
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
  _invalidateCache();
  return line;
}

/**
 * Eliminación lógica: marca la línea como 'eliminada'.
 * La línea NO desaparece de la BD, solo deja de contar en KPIs.
 * Si physical=true, elimina físicamente (solo para mantenimiento extremo).
 */
async function deleteLine(id, reason = 'No especificado', physical = false) {
  const line = await getBudgetLineById(id);
  if (!line) throw new Error(`Línea ${id} no encontrada.`);

  const hasMovements = movements.some(m => m.id_linea_presupuesto === id);
  if (physical && hasMovements) {
    throw new Error('No se puede eliminar físicamente una línea con movimientos vinculados. Use eliminación lógica.');
  }

  if (physical) {
    await supabaseRepository.deleteBudgetLine(id, true);
  } else {
    // Eliminación lógica: estado='eliminada', anexar motivo a observaciones
    const tag = `[Motivo Eliminación: ${reason}]`;
    let newObs = line.observaciones || '';
    if (!newObs.includes('[Motivo Eliminación:')) {
      newObs = newObs ? `${newObs}\n${tag}` : tag;
    }
    await supabaseRepository.updateBudgetLine(id, { estado: 'eliminada', observaciones: newObs });
  }
  _invalidateCache();
  return { deleted: true, physical, id };
}

/**
 * Restaura una línea previamente eliminada (estado='activa').
 */
async function restoreLine(id) {
  const lines = await _getAllDbLinesIncludeDeleted();
  const line = lines.find(l => l.id_linea === id);
  if (!line) throw new Error(`Línea ${id} no encontrada.`);
  if (line.estado !== 'eliminada') throw new Error(`La línea ${id} no está en estado eliminada.`);

  let newObs = line.observaciones || '';
  newObs = newObs.replace(/\[Motivo Eliminación:.*?\]/g, '').trim();

  await supabaseRepository.updateBudgetLine(id, { estado: 'activa', observaciones: newObs });
  _invalidateCache();
  return { restored: true, id };
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
 * Exporta el reporte semanal en formato binario con opciones de filtrado.
 */
async function exportWeeklyExcel(filters = {}, options = {}) {
  const lines = await getBudgetLines(filters);
  return generateWeeklyCashFlowExcel(lines, options);
}

async function getKPIs(filters = {}) {
  // Solicitamos TODAS las líneas (incluidas eliminadas) para no perder su Presupuesto Inicial
  const lines = await getBudgetLines({ ...filters, includeDeleted: true });

  let totalPresupuesto = 0;
  let totalPresupuestoInicial = 0;
  let totalEjecutado = 0;
  const byArea = {};
  const byLinea = {};
  const byEscenario = {};
  const byICGI = {};

  lines.forEach(line => {
    const isDeleted = line.estado === 'eliminada';
    const pInicial = line.totalOriginal || 0;
    // Líneas eliminadas pierden su presupuesto actual y ejecutado en el dashboard
    const pActual = isDeleted ? 0 : (line.total || 0);
    const pEjecutado = isDeleted ? 0 : (line.ejecutadoAcumulado || 0);

    totalPresupuesto += pActual;
    totalPresupuestoInicial += pInicial;
    totalEjecutado += pEjecutado;

    // byArea
    if (line.area) {
      if (!byArea[line.area]) byArea[line.area] = { presupuesto: 0, presupuestoInicial: 0, ejecutado: 0 };
      byArea[line.area].presupuesto += pActual;
      byArea[line.area].presupuestoInicial += pInicial;
      byArea[line.area].ejecutado += pEjecutado;
    }

    // byLinea: calculado mes a mes para respetar overrides
    MONTH_KEYS.forEach(m => {
      const lineaKey = `linea${m.charAt(0).toUpperCase() + m.slice(1)}`;
      const activeLinea = line[lineaKey] || line.linea || 'Sin línea';
      const amount = isDeleted ? 0 : (line[m] || 0);
      
      if (!byLinea[activeLinea]) byLinea[activeLinea] = { presupuesto: 0, ejecutado: 0 };
      byLinea[activeLinea].presupuesto += amount;
    });

    // Atribuir ejecutado a la línea principal
    if (line.linea) {
      if (!byLinea[line.linea]) byLinea[line.linea] = { presupuesto: 0, ejecutado: 0 };
      byLinea[line.linea].ejecutado += pEjecutado;
    }

    const esc = `${line.escenario}`;
    if (!byEscenario[esc]) byEscenario[esc] = { presupuesto: 0, presupuestoInicial: 0, ejecutado: 0 };
    byEscenario[esc].presupuesto += pActual;
    byEscenario[esc].presupuestoInicial += pInicial;
    byEscenario[esc].ejecutado += pEjecutado;

    if (line.icgi) {
      if (!byICGI[line.icgi]) byICGI[line.icgi] = { presupuesto: 0, presupuestoInicial: 0, ejecutado: 0 };
      byICGI[line.icgi].presupuesto += pActual;
      byICGI[line.icgi].presupuestoInicial += pInicial;
      byICGI[line.icgi].ejecutado += pEjecutado;
    }
  });

  // Cross-tab: ICGI breakdown per business line
  const byLineaICGI = {};
  lines.forEach(line => {
    const isDeleted = line.estado === 'eliminada';
    const icgi = line.icgi || 'Sin tipo';
    
    MONTH_KEYS.forEach(m => {
      const lineaKey = `linea${m.charAt(0).toUpperCase() + m.slice(1)}`;
      const activeLinea = line[lineaKey] || line.linea || 'Sin línea';
      const amount = isDeleted ? 0 : (line[m] || 0);
      
      if (!byLineaICGI[activeLinea]) byLineaICGI[activeLinea] = {};
      if (!byLineaICGI[activeLinea][icgi]) byLineaICGI[activeLinea][icgi] = 0;
      byLineaICGI[activeLinea][icgi] += amount;
    });
  });

  const monthlyBudget = MONTH_KEYS.map(m => lines.reduce((sum, line) => {
    return sum + (line.estado === 'eliminada' ? 0 : (line[m] || 0));
  }, 0));

  const activeLines = lines.filter(l => l.estado !== 'eliminada');

  return {
    totalPresupuesto,
    totalPresupuestoInicial,
    totalEjecutado,
    saldo: totalPresupuesto - totalEjecutado,
    saldoInicial: totalPresupuestoInicial - totalEjecutado,
    diferencia: totalPresupuestoInicial - totalPresupuesto, // Diferencia inicial vs actual
    porcentajeEjecucion: totalPresupuesto > 0 ? (totalEjecutado / totalPresupuesto) * 100 : 0,
    porcentajeEjecucionInicial: totalPresupuestoInicial > 0 ? (totalEjecutado / totalPresupuestoInicial) * 100 : 0,
    monthlyBudget,
    byArea,
    byLinea,
    byEscenario,
    byICGI,
    byLineaICGI,
    totalLines: activeLines.length,
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
  const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const log = (msg) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${msg}`);
    if (!isVercel) {
      try {
        const logFile = path.join(__dirname, '..', '..', 'dolibarr_sync.log');
        fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
      } catch (e) {}
    }
  };

  const cfg = dolibarrConfig || config.dolibarr;
  log(`[Sync] Starting sync for year: ${cfg.year} with URL: ${cfg.url}`);

  try {
    log('[Sync] Calling fetchInvoices, fetchPurchaseOrders, fetchExpenseReports...');
    const [invoices, orders, expenseReports] = await Promise.all([
      fetchInvoices(cfg),
      fetchPurchaseOrders(cfg),
      fetchExpenseReports(cfg),
    ]);

    log(`[Sync] Invoices fetched: ${invoices.length}`);
    log(`[Sync] Orders fetched: ${orders.length}`);
    log(`[Sync] Expense reports fetched: ${expenseReports.length}`);

    if (invoices.length > 0) {
      log(`[Sync] Sample invoice ref: ${invoices[0].ref}, options: ${JSON.stringify(invoices[0].array_options)}`);
    }

    const budgetLines = await _getDbLines();
    log(`[Sync] Budget lines in DB: ${budgetLines.length}`);

    // Crear mapa de idConsecutivo a id_linea (UUID) para vinculación rápida
    const idMap = {};
    budgetLines.forEach(l => {
      if (l.idConsecutivo) {
        idMap[String(l.idConsecutivo)] = l.id_linea;
      }
    });

    const newMovements = [];

    // Helper: extrae el id_linea_presupuesto de un documento (factura, orden o informe)
    const extractBudgetLineId = (doc) => {
      // Buscar en array_options a nivel de cabecera
      if (doc.array_options?.options_ppto) return String(doc.array_options.options_ppto);
      // Buscar en las líneas del documento
      if (doc.lines) {
        for (const line of doc.lines) {
          if (line.array_options?.options_ppto) return String(line.array_options.options_ppto);
        }
      }
      return '';
    };

    // Enriquecer facturas y órdenes con nombre del tercero (Dolibarr no lo incluye en el listado)
    const allInvOrd = [...invoices, ...orders];
    const tpMap = await getThirdpartyMap(allInvOrd, cfg).catch(() => ({}));

    const enrichVendor = (doc) => {
      const socid = doc.socid || doc.fk_soc || doc.socid_facture || doc.thirdparty?.id;
      return tpMap[socid] || doc.socname || doc.thirdparty?.name || doc.nom || '';
    };

    // --- Facturas de proveedor ---
    for (const inv of invoices) {
      let docData = { ...inv, tipo_documento: 'factura_proveedor', socname: enrichVendor(inv) };
      
      // Conversión rigurosa a TRM oficial si es moneda extranjera
      if (inv.multicurrency_code && inv.multicurrency_code !== 'COP') {
        const rawDate = inv.date_paye || inv.datep || inv.datef || inv.date;
        let dateStr = typeof rawDate === 'number' ? unixToDateStr(rawDate) : (typeof rawDate === 'string' ? rawDate.split(' ')[0] : null);
        if (!dateStr) dateStr = unixToDateStr(Math.floor(Date.now() / 1000));
        
        const rate = await getExchangeRateToCOP(inv.multicurrency_code, dateStr);
        if (rate) {
          docData.total_ht = (parseFloat(inv.multicurrency_total_ht) || 0) * rate;
          docData.total_ttc = (parseFloat(inv.multicurrency_total_ttc) || 0) * rate;
          log(`[Sync] Factura ${inv.ref} en ${inv.multicurrency_code}: Convertida a TRM ${rate} (Fecha: ${dateStr}) -> COP HT: ${docData.total_ht}`);
        } else {
          log(`[Sync] Factura ${inv.ref}: No se pudo obtener TRM para ${inv.multicurrency_code} en ${dateStr}. Usando cálculo de Dolibarr.`);
        }
      }

      const mov = createMovement(docData);
      if (!mov.id_linea_presupuesto) mov.id_linea_presupuesto = extractBudgetLineId(inv);
      if (mov.id_linea_presupuesto && idMap[mov.id_linea_presupuesto]) {
        mov.id_linea_presupuesto_uuid = idMap[mov.id_linea_presupuesto];
        newMovements.push(mov);
      }
    }

    // --- Órdenes de compra ---
    orders.forEach(ord => {
      const mov = createMovement({ ...ord, tipo_documento: 'orden_compra', socname: enrichVendor(ord) });
      if (!mov.id_linea_presupuesto) mov.id_linea_presupuesto = extractBudgetLineId(ord);
      if (mov.id_linea_presupuesto && idMap[mov.id_linea_presupuesto]) {
        mov.id_linea_presupuesto_uuid = idMap[mov.id_linea_presupuesto];
        newMovements.push(mov);
      }
    });

    // --- Informes de gastos (expense reports) ---
    expenseReports.forEach(rep => {
      // REGLA DE NEGOCIO: Solo informes en estado Validado (4) o Pagado (5).
      // IMPORTANTE: el campo de estado en Dolibarr expensereports es `status` (string),
      // NO `fk_statut` ni `statut` (estos son undefined en la API de expense reports).
      const statut = parseInt(rep.status || rep.fk_statut || rep.statut || 0);
      if (statut < 4) {
        log(`[Sync] Informe de gastos ignorado (estado ${statut} < 4): ${rep.ref || rep.id}`);
        return; // skip: estado no aprobado
      }

      // Los informes de gastos usan date_create como fecha y total_ttc como monto.
      // El campo "Consignar a" / autor se obtiene de `user_author_infos` (nombre completo).
      // Si no existe, se usa `user_validator_infos` o `user_valid_infos` como fallback.
      const autorNombre =
        rep.user_author_infos ||
        rep.user_validator_infos ||
        rep.user_valid_infos ||
        rep.user_author ||
        rep.nom ||
        '';

      const mov = createMovement({
        ...rep,
        tipo_documento: 'informe_gastos',
        // Mapear campos específicos de expense reports
        datef: rep.date_create || rep.datef || '',
        date: rep.date_create || rep.datef || '',
        total_ht: rep.total_ht || rep.total_ttc || rep.total || 0,
        total_ttc: rep.total_ttc || rep.total || 0,
        // Usar el nombre resuelto del autor; socname es lo que toma createMovement
        socname: autorNombre,
        statut: statut,
      });
      if (!mov.id_linea_presupuesto) mov.id_linea_presupuesto = extractBudgetLineId(rep);
      if (mov.id_linea_presupuesto && idMap[mov.id_linea_presupuesto]) {
        mov.id_linea_presupuesto_uuid = idMap[mov.id_linea_presupuesto];
        newMovements.push(mov);
      }
    });

    movements = newMovements;

    // Persistir movimientos en Supabase para que la gráfica mensual use fechas reales
    try {
      const movsParaSupabase = newMovements.map(m => {
        // La fecha puede ser un Unix timestamp (segundos) o una cadena 'YYYY-MM-DD'
        let fechaDoc = null;
        if (m.fecha_documento) {
          const raw = m.fecha_documento;
          if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
            // Unix timestamp en segundos
            const d = new Date(Number(raw) * 1000);
            fechaDoc = isNaN(d) ? null : d.toISOString().slice(0, 10);
          } else {
            // Cadena tipo '2026-03-15' o similar
            const d = new Date(raw);
            fechaDoc = isNaN(d) ? null : d.toISOString().slice(0, 10);
          }
        }
        return {
          id: `${m.tipo_documento}_${m.id_movimiento}`,
          id_linea_presupuesto_uuid: m.id_linea_presupuesto_uuid,
          fecha_documento: fechaDoc,
          tipo_documento: m.tipo_documento,
          proveedor: m.proveedor || '',
          monto: m.monto,
          moneda: m.moneda,
          estado_documento: String(m.estado_documento || ''),
          ref: m.ref_documento || m.id_movimiento, // referencia legible del documento
        };
      });
      await supabaseRepository.upsertMovements(movsParaSupabase);
      log(`[Sync] ${movsParaSupabase.length} movimientos persistidos en Supabase.`);
    } catch (e) {
      log(`[Sync] Advertencia: no se pudo persistir movimientos en Supabase: ${e.message}`);
    }

    const ejecutadoPorLinea = {};
    movements.forEach(m => {
      if (m.tipo_documento === 'orden_compra') return; // Avoid double counting
      const targetId = m.id_linea_presupuesto_uuid;
      if (!ejecutadoPorLinea[targetId]) ejecutadoPorLinea[targetId] = 0;
      ejecutadoPorLinea[targetId] += m.monto;
    });

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
      _invalidateCache(); // Invalidar cache post-sync
    }

    const logEntry = {
      fecha: new Date().toISOString(),
      facturas: invoices.length,
      ordenes: orders.length,
      informesGastos: expenseReports.length,
      movimientosVinculados: newMovements.length,
    };
    syncLog.push(logEntry);

    return logEntry;
  } catch (error) {
    log(`[Sync] Error during sync: ${error.message}`);
    throw error;
  }
}

async function getThirdpartyMap(invoices, cfg) {
  const socIds = [...new Set(invoices.map(i => i.socid || i.fk_soc || i.socid_facture || i.thirdparty?.id).filter(Boolean))];
  let baseUrl = cfg.url.replace(/\/$/, '');
  if (!baseUrl.endsWith('api/index.php')) baseUrl = `${baseUrl}/api/index.php`;
  
  const headers = { 'DOLAPIKEY': cfg.apiKey, 'Accept': 'application/json' };
  const tpMap = {};
  
  for (let i = 0; i < socIds.length; i += 5) {
     const batch = socIds.slice(i, i + 5);
     await Promise.all(batch.map(async id => {
        try {
           const res = await fetch(`${baseUrl}/thirdparties/${id}`, { headers });
           if (res.ok) {
              const data = await res.json();
              tpMap[id] = data.name || data.nom || data.name_alias || data.company || '';
           }
        } catch (e) {
           console.log(`[Dolibarr] Error fetch thirdparty ${id}:`, e.message);
        }
     }));
  }
  return tpMap;
}

/**
 * Obtiene las facturas pendientes de pago desde Dolibarr hasta una semana en particular.
 */
async function getUnpaidInvoices(endWeek, dolibarrConfig) {
  const cfg = dolibarrConfig || config.dolibarr;
  if (!cfg || !cfg.url || !cfg.apiKey) return [];
  
  const invoices = await fetchInvoices(cfg);
  
  // Filtrar pendientes de pago (statut=1 o paye=0)
  const unpaidInvoices = invoices.filter(inv => {
     return String(inv.statut) === '1';
  });

  // Mapear Nombres de Terceros
  const tpMap = await getThirdpartyMap(unpaidInvoices, cfg);
  
  // Mapear al modelo
  return unpaidInvoices.map(inv => {
     const socid = inv.socid || inv.fk_soc || inv.socid_facture || inv.thirdparty?.id;
     const fetchedName = socid ? tpMap[socid] : '';
     
     // Construcción robusta del nombre del proveedor
     let proveedorCandidate = inv.socname || 
                       inv.nom || 
                       fetchedName || 
                       inv.thirdparty?.name || 
                       inv.thirdparty?.nom || 
                       inv.name || 
                       inv.display_name;

     const proveedor = proveedorCandidate || (socid ? `ID_TERCERO:${socid}` : 'DESCONOCIDO_POR_API');

     if (String(inv.ref).includes('7035') || String(inv.id) === '7035') {
         console.log('--- DEBUG INVOICE 7035 ---');
         console.log('IDs found:', { socid: inv.socid, fk_soc: inv.fk_soc, socid_facture: inv.socid_facture });
         console.log('Names found:', { socname: inv.socname, nom: inv.nom, fetchedName });
         console.log('Final proveedor result:', proveedor);
         console.log('--------------------------');
     }

     return {
       id_movimiento: inv.id || inv.ref || '',
       proveedor: proveedor,
       fecha_limite: inv.date_lim_reglement || inv.datep || inv.date || '',
       monto: parseFloat(inv.total_ht) || parseFloat(inv.total_ttc) || 0, // Importe sin IVA
       moneda: inv.multicurrency_code || 'COP',
       // Extraemos si ya tiene linea de ppto vinculada
       id_linea_presupuesto: inv.array_options?.options_ppto || '',
       ref: inv.ref || '',
     }
  }).filter(inv => {
     if (!endWeek) return true;
     if (!inv.fecha_limite) return true;
     // Filtrar facturas que venzan dentro de las semanas seleccionadas
     const date = new Date(inv.fecha_limite * 1000);
     const startOfYear = new Date(2026, 0, 1);
     const diff = date - startOfYear;
     const weekNumber = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
     return weekNumber <= parseInt(endWeek);
  });
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
 * Obtiene los movimientos de ejecución de una línea de presupuesto específica.
 * Consulta budget_movements por id_linea_presupuesto_uuid y enriquece con la línea.
 * Solo incluye facturas y informes de gastos (NO órdenes de compra).
 * @param {string} idLinea - UUID de la línea de presupuesto
 * @returns {Promise<Array>} Lista de movimientos con detalle
 */
async function getLineMovements(idLinea) {
  const line = await getBudgetLineById(idLinea);
  if (!line) throw new Error(`Línea ${idLinea} no encontrada.`);

  // Obtener los movimientos persistidos en Supabase para esta línea
  let { data, error } = await supabaseRepository.supabase
    .from('budget_movements')
    .select('*')
    .eq('id_linea_presupuesto_uuid', idLinea)
    .neq('tipo_documento', 'orden_compra') // Órdenes de compra no cuentan en ejecución
    .order('fecha_documento', { ascending: false });

  if (error) throw error;

  // Filtrar informes de gastos: solo permitimos Validado (4) o Pagado (5)
  // Se excluyen borradores (<4) y rechazados (99)
  if (data) {
    data = data.filter(mov => {
      if (mov.tipo_documento === 'informe_gastos') {
        const statut = parseInt(mov.estado_documento || 0);
        return statut >= 4 && statut <= 5;
      }
      return true;
    });
  }

  return {
    line: {
      id: line.id_linea,
      idConsecutivo: line.idConsecutivo,
      nombre: line.nombreElemento,
      area: line.area,
      totalPresupuesto: line.total,
      ejecutadoAcumulado: line.ejecutadoAcumulado,
    },
    movements: (data || []).map(m => ({
      id: m.id,
      ref: m.ref,
      tipo: m.tipo_documento,
      proveedor: m.proveedor,
      fecha: m.fecha_documento,
      monto: parseFloat(m.monto) || 0,
      estado: m.estado_documento,
    })),
  };
}

/**
 * Obtiene los documentos sin asignación de línea de presupuesto.
 * Solo considera facturas de proveedor e informes de gastos (no órdenes de compra).
 * Sincroniza directamente con Dolibarr para obtener datos frescos.
 * @param {Object} dolibarrConfig - Configuración de Dolibarr
 * @returns {Promise<Object>} Total de documentos y monto sin asignar
 */
async function getUnassignedDocuments(dolibarrConfig) {
  const cfg = dolibarrConfig || config.dolibarr;
  if (!cfg || !cfg.url || !cfg.apiKey) {
    return { count: 0, total: 0, items: [] };
  }

  try {
    const [invoices, expenseReports] = await Promise.all([
      fetchInvoices(cfg),
      fetchExpenseReports(cfg),
    ]);

    const extractBudgetRef = (doc) => {
      if (doc.array_options?.options_ppto) return String(doc.array_options.options_ppto).trim();
      if (doc.lines) {
        for (const line of doc.lines) {
          if (line.array_options?.options_ppto) return String(line.array_options.options_ppto).trim();
        }
      }
      return '';
    };

    const unassigned = [];

    // Enriquecer facturas con nombre del tercero
    const tpMap = await getThirdpartyMap(invoices, cfg).catch(() => ({}));
    const enrichVendor = (doc) => {
      const socid = doc.socid || doc.fk_soc || doc.thirdparty?.id;
      return tpMap[socid] || doc.socname || doc.thirdparty?.name || doc.nom || '';
    };

    // Facturas de proveedor sin asignación
    for (const inv of invoices) {
      const ref = extractBudgetRef(inv);
      if (!ref) {
        let monto = parseFloat(inv.total_ht) || parseFloat(inv.total_ttc) || 0;
        
        // Conversión rigurosa a TRM oficial si es moneda extranjera
        if (inv.multicurrency_code && inv.multicurrency_code !== 'COP') {
          const rawDate = inv.date_paye || inv.datep || inv.datef || inv.date;
          let dateStr = typeof rawDate === 'number' ? unixToDateStr(rawDate) : (typeof rawDate === 'string' ? rawDate.split(' ')[0] : null);
          if (!dateStr) dateStr = unixToDateStr(Math.floor(Date.now() / 1000));
          
          const rate = await getExchangeRateToCOP(inv.multicurrency_code, dateStr);
          if (rate) {
            monto = (parseFloat(inv.multicurrency_total_ht) || 0) * rate;
          }
        }

        unassigned.push({
          tipo: 'factura_proveedor',
          ref: inv.ref || String(inv.id),
          proveedor: enrichVendor(inv),
          monto: monto,
          estado: String(inv.statut || inv.status || ''),
          fecha: inv.datef || inv.date || '',
        });
      }
    }

    // Informes de gastos sin asignación — solo Validado (4) o Pagado (5)
    // El campo de estado es `status` (string), no `fk_statut`/`statut` (undefined en la API).
    expenseReports.forEach(rep => {
      const statut = parseInt(rep.status || rep.fk_statut || rep.statut || 0);
      if (statut < 4) return;
      const ref = extractBudgetRef(rep);
      if (!ref) {
        // Nombre del autor: Dolibarr devuelve `user_author_infos` con el nombre completo
        const autorNombre =
          rep.user_author_infos ||
          rep.user_validator_infos ||
          rep.user_valid_infos ||
          rep.user_author ||
          rep.nom ||
          '';
        unassigned.push({
          tipo: 'informe_gastos',
          ref: rep.ref || String(rep.id),
          proveedor: autorNombre,
          monto: parseFloat(rep.total_ht) || parseFloat(rep.total_ttc) || parseFloat(rep.total) || 0,
          estado: String(rep.status || rep.fk_statut || rep.statut || ''),
          fecha: rep.date_create || rep.datef || '',
        });
      }
    });

    const totalMonto = unassigned.reduce((sum, d) => sum + d.monto, 0);
    return {
      count: unassigned.length,
      total: totalMonto,
      items: unassigned,
    };
  } catch (error) {
    console.error('[getUnassignedDocuments] Error:', error.message);
    return { count: 0, total: 0, items: [] };
  }
}

/**
 * Obtiene los datos mensuales.
 */
async function getMonthlyData(filters = {}) {
  const lines = await getBudgetLines({ ...filters, includeDeleted: true });

  // Obtener movimientos persistidos en Supabase para calcular ejecutado real por mes
  let movimientosPorMes = {};
  try {
    const year = config.dolibarr?.year || '2026';
    const movs = await supabaseRepository.getMovements(year);
    movs.forEach(mov => {
      if (mov.tipo_documento === 'orden_compra') return; // Exclude orders from executed amount
      if (!mov.fecha_documento) return;
      const mesNum = new Date(mov.fecha_documento).getMonth(); // 0-based
      movimientosPorMes[mesNum] = (movimientosPorMes[mesNum] || 0) + (parseFloat(mov.monto) || 0);
    });
  } catch (e) {
    // Si falla, el ejecutado queda en 0 (no interrumpe el flujo)
    console.warn('[getMonthlyData] No se pudo leer movimientos:', e.message);
  }

  return MONTH_KEYS.map((month, index) => {
    const ogMonthKey = `og${month.charAt(0).toUpperCase() + month.slice(1)}`;
    
    // Líneas eliminadas aportan 0 al presupuestado actual
    const total = lines.reduce((sum, l) => sum + (l.estado === 'eliminada' ? 0 : (l[month] || 0)), 0);
    // Pero SÍ aportan su presupuesto inicial
    const totalOriginal = lines.reduce((sum, l) => sum + (l[ogMonthKey] || 0), 0);
    
    return {
      mes: config.months ? config.months[index] : month,
      mesKey: month,
      presupuestado: total,
      presupuestadoInicial: totalOriginal,
      // Ejecutado real por mes según fecha de documento (facturas + informes de gastos)
      ejecutado: movimientosPorMes[index] || 0,
    };
  });
}

// ============================================================
// TRASLADOS DE PRESUPUESTO
// ============================================================

/**
 * Crea una solicitud de traslado de presupuesto entre dos líneas.
 * El traslado queda en estado 'pendiente' hasta ser aprobado.
 * @param {string} fromId - ID de la línea origen
 * @param {string} toId - ID de la línea destino
 * @param {Object} amounts - Montos por mes {enero: X, ...}
 * @param {string} motivo - Justificación del traslado
 */
async function createTransfer(fromId, toId, amounts, motivo, solicitante) {
  if (fromId === toId) throw new Error('La línea origen y destino deben ser diferentes.');
  if (!motivo || !motivo.trim()) throw new Error('El motivo del traslado es obligatorio.');
  if (!solicitante || !solicitante.trim()) throw new Error('El nombre del solicitante es obligatorio.');

  const fromLine = await getBudgetLineById(fromId);
  const toLine = await getBudgetLineById(toId);
  if (!fromLine) throw new Error(`Línea origen ${fromId} no encontrada.`);
  if (!toLine) throw new Error(`Línea destino ${toId} no encontrada.`);

  // Validar que hay montos
  let totalAmount = 0;
  if (Array.isArray(amounts.rows)) {
    totalAmount = amounts.rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  } else {
    totalAmount = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }
  if (totalAmount <= 0) throw new Error('El traslado debe tener al menos un monto mayor a cero.');

  const transfer = {
    from_id_linea: fromId,
    to_id_linea: toId,
    amounts,
    motivo: motivo.trim(),
    solicitante: solicitante.trim(),
    estado: 'pendiente',
  };

  const { data, error } = await supabaseRepository.supabase
    .from('budget_transfers')
    .insert(transfer)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Lista todos los traslados con información de las líneas origen y destino.
 */
async function listTransfers() {
  const { data, error } = await supabaseRepository.supabase
    .from('budget_transfers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Enriquecer con nombres de líneas
  const allLines = await _getAllDbLinesIncludeDeleted();
  const lineMap = {};
  allLines.forEach(l => { lineMap[l.id_linea] = l; });

  return (data || []).map(t => ({
    ...t,
    fromLine: lineMap[t.from_id_linea] ? {
      id: t.from_id_linea,
      nombre: lineMap[t.from_id_linea].nombreElemento,
      area: lineMap[t.from_id_linea].area,
    } : { id: t.from_id_linea, nombre: 'Desconocida', area: '' },
    toLine: lineMap[t.to_id_linea] ? {
      id: t.to_id_linea,
      nombre: lineMap[t.to_id_linea].nombreElemento,
      area: lineMap[t.to_id_linea].area,
    } : { id: t.to_id_linea, nombre: 'Desconocida', area: '' },
  }));
}

/**
 * Aprueba un traslado pendiente: aplica los montos a las líneas y registra la aprobación.
 * @param {string} transferId - UUID del traslado
 * @param {string} approvedBy - Nombre del aprobador
 */
async function approveTransfer(transferId, approvedBy = 'Jhonatan Mejía') {
  const { data: transfer, error } = await supabaseRepository.supabase
    .from('budget_transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (error || !transfer) throw new Error('Traslado no encontrado.');
  if (transfer.estado !== 'pendiente') throw new Error('Solo se pueden aprobar traslados en estado pendiente.');

  const fromLine = await getBudgetLineById(transfer.from_id_linea);
  const toLine = await getBudgetLineById(transfer.to_id_linea);
  if (!fromLine || !toLine) throw new Error('Líneas del traslado no encontradas.');

  const amounts = transfer.amounts || {};

  // Soporte para formato cross-mes: amounts puede tener un array 'rows'
  // con { fromMonth, toMonth, amount }.  Si no existe, usa el formato
  // legado { enero: X, febrero: Y, ... } (mismo mes en origen y destino).
  if (Array.isArray(amounts.rows)) {
    for (const row of amounts.rows) {
      const amt = parseFloat(row.amount) || 0;
      if (amt <= 0) continue;
      const fm = row.fromMonth;
      const tm = row.toMonth;
      if (!MONTH_KEYS.includes(fm) || !MONTH_KEYS.includes(tm)) continue;
      fromLine[fm] = Math.max(0, (fromLine[fm] || 0) - amt);
      toLine[tm]   = (toLine[tm] || 0) + amt;
    }
  } else {
    // Formato legado: mismo mes en origen y destino
    MONTH_KEYS.forEach(month => {
      const amount = parseFloat(amounts[month]) || 0;
      if (amount > 0) {
        fromLine[month] = Math.max(0, (fromLine[month] || 0) - amount);
        toLine[month]   = (toLine[month] || 0) + amount;
      }
    });
  }

  recalculateLine(fromLine);
  recalculateLine(toLine);

  // Guardar ambas líneas y marcar aprobado
  await Promise.all([
    supabaseRepository.updateBudgetLine(fromLine.id_linea, fromLine),
    supabaseRepository.updateBudgetLine(toLine.id_linea, toLine),
    supabaseRepository.supabase
      .from('budget_transfers')
      .update({ estado: 'aprobado', approved_at: new Date().toISOString(), approved_by: approvedBy })
      .eq('id', transferId),
  ]);

  _invalidateCache();
  return { approved: true, transferId };
}

/**
 * Rechaza un traslado pendiente.
 */
async function rejectTransfer(transferId, reason = '') {
  const { data: transfer, error } = await supabaseRepository.supabase
    .from('budget_transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (error || !transfer) throw new Error('Traslado no encontrado.');
  if (transfer.estado !== 'pendiente') throw new Error('Solo se pueden rechazar traslados en estado pendiente.');

  const { error: updateError } = await supabaseRepository.supabase
    .from('budget_transfers')
    .update({ estado: 'rechazado', rejected_reason: reason })
    .eq('id', transferId);

  if (updateError) throw updateError;
  return { rejected: true, transferId };
}

/**
 * Elimina un traslado solo si está en estado 'pendiente' o 'rechazado'.
 * Los traslados aprobados no se pueden borrar porque ya fueron aplicados.
 */
async function deleteTransfer(transferId) {
  const { data: transfer, error } = await supabaseRepository.supabase
    .from('budget_transfers')
    .select('estado')
    .eq('id', transferId)
    .single();

  if (error || !transfer) throw new Error('Traslado no encontrado.');
  if (!['pendiente', 'rechazado'].includes(transfer.estado)) {
    throw new Error('Solo se pueden borrar traslados en estado pendiente o rechazado.');
  }

  const { error: delError } = await supabaseRepository.supabase
    .from('budget_transfers')
    .delete()
    .eq('id', transferId);

  if (delError) throw delError;
  return { deleted: true, transferId };
}

/**
 * Modifica un traslado en estado 'pendiente'.
 * Permite actualizar fromId, toId, amounts, motivo y solicitante.
 */
async function updateTransfer(transferId, { fromId, toId, amounts, motivo, solicitante }) {
  const { data: transfer, error } = await supabaseRepository.supabase
    .from('budget_transfers')
    .select('*')
    .eq('id', transferId)
    .single();

  if (error || !transfer) throw new Error('Traslado no encontrado.');
  if (transfer.estado !== 'pendiente') throw new Error('Solo se pueden modificar traslados en estado pendiente.');

  if (fromId && toId && fromId === toId) throw new Error('La línea origen y destino deben ser diferentes.');

  const fieldsToUpdate = {};
  if (fromId) fieldsToUpdate.from_id_linea = fromId;
  if (toId) fieldsToUpdate.to_id_linea = toId;
  if (amounts) {
    // Validar montos
    let totalAmount = 0;
    if (Array.isArray(amounts.rows)) {
      totalAmount = amounts.rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    } else {
      totalAmount = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    }
    if (totalAmount <= 0) throw new Error('El traslado debe tener al menos un monto mayor a cero.');
    fieldsToUpdate.amounts = amounts;
  }
  if (motivo !== undefined) fieldsToUpdate.motivo = motivo;
  if (solicitante !== undefined) fieldsToUpdate.solicitante = solicitante;

  const { data: updated, error: updErr } = await supabaseRepository.supabase
    .from('budget_transfers')
    .update(fieldsToUpdate)
    .eq('id', transferId)
    .select()
    .single();

  if (updErr) throw updErr;
  return updated;
}

module.exports = {
  loadBudget,
  getSummary,
  getBudgetLines,
  getBudgetLineById,
  createLine,
  updateLine,
  deleteLine,
  restoreLine,
  saveToExcel,
  exportWeeklyExcel,
  getKPIs,
  getWeeklyFlow,
  syncDolibarr,
  getFilterOptions,
  getSyncLog,
  getMonthlyData,
  getLineMovements,
  getUnassignedDocuments,
  // Traslados
  createTransfer,
  listTransfers,
  approveTransfer,
  rejectTransfer,
  deleteTransfer,
  updateTransfer,
  getUnpaidInvoices,
};
