const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// Initialize the Supabase client
const supabase = createClient(config.supabase.url, config.supabase.key);

/**
 * Get active budget lines from Supabase (excludes 'eliminada').
 * Used for KPI calculations — deleted lines do NOT count.
 */
async function getAllBudgetLines() {
  const { data, error } = await supabase
    .from('budget_items')
    .select('*, budget_allocations(*)')
    .neq('estado', 'eliminada');
    
  if (error) {
    console.error('Error fetching budget lines from Supabase:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get ALL budget lines including deleted ones.
 * Used for the detail table view where deleted lines are shown with a special style.
 */
async function getAllBudgetLinesIncludeDeleted() {
  const { data, error } = await supabase
    .from('budget_items')
    .select('*, budget_allocations(*)');
    
  if (error) {
    console.error('Error fetching all budget lines from Supabase:', error);
    throw error;
  }
  
  return data;
}

/**
 * Upsert multiple budget lines (used for Excel import and sync)
 */
async function upsertBudgetLines(lines) {
  const itemsToUpsert = [];
  const allocationsToUpsert = [];
  
  lines.forEach(line => {
    // Master record (budget_items)
    itemsToUpsert.push({
      id_linea: line.id_linea,
      cuenta: line.cuenta,
      cuenta_contable: line.cuentaContable,
      area: line.area,
      nombre_elemento: line.nombreElemento,
      escenario: line.escenario,
      fecha: line.fecha,
      total: line.total,
      total_original: line.totalOriginal,
      icgi: line.icgi,
      porcentaje: line.porcentaje,
      linea: line.linea,
      ejecutado_acumulado: line.ejecutadoAcumulado,
      saldo: line.saldo,
      estado: line.estado,
      observaciones: line.observaciones
    });

    // Detail records (budget_allocations)
    const months = [
      { num: 1, name: 'enero', ogName: 'ogEnero', dateName: 'fechaEnero', lineaName: 'lineaEnero' },
      { num: 2, name: 'febrero', ogName: 'ogFebrero', dateName: 'fechaFebrero', lineaName: 'lineaFebrero' },
      { num: 3, name: 'marzo', ogName: 'ogMarzo', dateName: 'fechaMarzo', lineaName: 'lineaMarzo' },
      { num: 4, name: 'abril', ogName: 'ogAbril', dateName: 'fechaAbril', lineaName: 'lineaAbril' },
      { num: 5, name: 'mayo', ogName: 'ogMayo', dateName: 'fechaMayo', lineaName: 'lineaMayo' },
      { num: 6, name: 'junio', ogName: 'ogJunio', dateName: 'fechaJunio', lineaName: 'lineaJunio' },
      { num: 7, name: 'julio', ogName: 'ogJulio', dateName: 'fechaJulio', lineaName: 'lineaJulio' },
      { num: 8, name: 'agosto', ogName: 'ogAgosto', dateName: 'fechaAgosto', lineaName: 'lineaAgosto' },
      { num: 9, name: 'septiembre', ogName: 'ogSeptiembre', dateName: 'fechaSeptiembre', lineaName: 'lineaSeptiembre' },
      { num: 10, name: 'octubre', ogName: 'ogOctubre', dateName: 'fechaOctubre', lineaName: 'lineaOctubre' },
      { num: 11, name: 'noviembre', ogName: 'ogNoviembre', dateName: 'fechaNoviembre', lineaName: 'lineaNoviembre' },
      { num: 12, name: 'diciembre', ogName: 'ogDiciembre', dateName: 'fechaDiciembre', lineaName: 'lineaDiciembre' }
    ];

    months.forEach(m => {
      allocationsToUpsert.push({
        id_linea: line.id_linea,
        mes: m.num,
        monto: line[m.name] || 0,
        monto_original: line[m.ogName] || 0,
        fecha_mes: line[m.dateName] || '',
        linea: line[m.lineaName] || ''
      });
    });
  });

  // Upsert Master
  const { data: itemsData, error: itemsError } = await supabase
    .from('budget_items')
    .upsert(itemsToUpsert, { onConflict: 'id_linea' })
    .select();

  if (itemsError) {
    console.error('Error upserting budget items to Supabase:', itemsError);
    throw itemsError;
  }
  
  // Upsert Details (Using id_linea, mes for conflict resolution via the unique constraint)
  // To use onConflict with multiple columns, we pass a comma separated string of the constraint
  // Since we created UNIQUE(id_linea, mes), we must specify it. 
  // Wait, Supabase's `upsert` expects either the constraint name or a comma-separated column string.
  // We'll use 'id_linea, mes'.
  const { data: allocationsData, error: allocError } = await supabase
    .from('budget_allocations')
    .upsert(allocationsToUpsert, { onConflict: 'id_linea, mes' })
    .select();

  if (allocError) {
    console.error('Error upserting budget allocations to Supabase:', allocError);
    // Ideally we should rollback or return mixed results, but throwing is fine for MVP
    throw allocError;
  }
  
  // Re-fetch everything and return in the expected flat format?
  // The service might just be fine without the return data matching line per line if it doesn't use it.
  return itemsData;
}

/**
 * Update a specific budget line
 */
async function updateBudgetLine(idLinea, updates) {
  // We need to separate updates for items vs allocations
  const itemUpdates = {};
  const allocationUpdatesByMonth = {};

  const mapKey = (key) => {
    switch(key) {
      case 'cuentaContable': return 'cuenta_contable';
      case 'nombreElemento': return 'nombre_elemento';
      case 'totalOriginal': return 'total_original';
      case 'ejecutadoAcumulado': return 'ejecutado_acumulado';
      case 'idConsecutivo': return 'id_consecutivo';
      default: return key;
    }
  };

  const monthsMap = {
    enero: { mes: 1, field: 'monto' }, ogEnero: { mes: 1, field: 'monto_original' }, fechaEnero: { mes: 1, field: 'fecha_mes' }, lineaEnero: { mes: 1, field: 'linea' },
    febrero: { mes: 2, field: 'monto' }, ogFebrero: { mes: 2, field: 'monto_original' }, fechaFebrero: { mes: 2, field: 'fecha_mes' }, lineaFebrero: { mes: 2, field: 'linea' },
    marzo: { mes: 3, field: 'monto' }, ogMarzo: { mes: 3, field: 'monto_original' }, fechaMarzo: { mes: 3, field: 'fecha_mes' }, lineaMarzo: { mes: 3, field: 'linea' },
    abril: { mes: 4, field: 'monto' }, ogAbril: { mes: 4, field: 'monto_original' }, fechaAbril: { mes: 4, field: 'fecha_mes' }, lineaAbril: { mes: 4, field: 'linea' },
    mayo: { mes: 5, field: 'monto' }, ogMayo: { mes: 5, field: 'monto_original' }, fechaMayo: { mes: 5, field: 'fecha_mes' }, lineaMayo: { mes: 5, field: 'linea' },
    junio: { mes: 6, field: 'monto' }, ogJunio: { mes: 6, field: 'monto_original' }, fechaJunio: { mes: 6, field: 'fecha_mes' }, lineaJunio: { mes: 6, field: 'linea' },
    julio: { mes: 7, field: 'monto' }, ogJulio: { mes: 7, field: 'monto_original' }, fechaJulio: { mes: 7, field: 'fecha_mes' }, lineaJulio: { mes: 7, field: 'linea' },
    agosto: { mes: 8, field: 'monto' }, ogAgosto: { mes: 8, field: 'monto_original' }, fechaAgosto: { mes: 8, field: 'fecha_mes' }, lineaAgosto: { mes: 8, field: 'linea' },
    septiembre: { mes: 9, field: 'monto' }, ogSeptiembre: { mes: 9, field: 'monto_original' }, fechaSeptiembre: { mes: 9, field: 'fecha_mes' }, lineaSeptiembre: { mes: 9, field: 'linea' },
    octubre: { mes: 10, field: 'monto' }, ogOctubre: { mes: 10, field: 'monto_original' }, fechaOctubre: { mes: 10, field: 'fecha_mes' }, lineaOctubre: { mes: 10, field: 'linea' },
    noviembre: { mes: 11, field: 'monto' }, ogNoviembre: { mes: 11, field: 'monto_original' }, fechaNoviembre: { mes: 11, field: 'fecha_mes' }, lineaNoviembre: { mes: 11, field: 'linea' },
    diciembre: { mes: 12, field: 'monto' }, ogDiciembre: { mes: 12, field: 'monto_original' }, fechaDiciembre: { mes: 12, field: 'fecha_mes' }, lineaDiciembre: { mes: 12, field: 'linea' }
  };

  for (const [key, value] of Object.entries(updates)) {
    if (monthsMap[key]) {
      const { mes, field } = monthsMap[key];
      if (!allocationUpdatesByMonth[mes]) allocationUpdatesByMonth[mes] = { id_linea: idLinea, mes: mes };
      allocationUpdatesByMonth[mes][field] = value;
    } else {
      itemUpdates[mapKey(key)] = value;
    }
  }

  // Prevent updating primary or identity columns
  delete itemUpdates.id_linea;
  delete itemUpdates.id_consecutivo;

  // Update budget_items if there are fields
  if (Object.keys(itemUpdates).length > 0) {
    console.log('UPDATING budget_items for idLinea:', idLinea, 'with:', JSON.stringify(itemUpdates, null, 2));
    const { error: itemError } = await supabase
      .from('budget_items')
      .update(itemUpdates)
      .eq('id_linea', idLinea);

    if (itemError) {
      console.error('Error updating budget item in Supabase:', itemError);
      throw itemError;
    }
  }

  // Upsert the specific allocations
  const allocsToUpsert = Object.values(allocationUpdatesByMonth);
  if (allocsToUpsert.length > 0) {
    console.log('UPDATING budget_allocations for idLinea:', idLinea, 'with:', JSON.stringify(allocsToUpsert, null, 2));
    const { error: allocError } = await supabase
      .from('budget_allocations')
      .upsert(allocsToUpsert, { onConflict: 'id_linea, mes' });
      
    if (allocError) {
      console.error('Error updating budget allocations:', allocError);
      throw allocError;
    }
  }

  // Fetch updated aggregated row to return
  const { data, error } = await supabase
    .from('budget_items')
    .select('*, budget_allocations(*)')
    .eq('id_linea', idLinea)
    .single();

  return data;
}

/**
 * Delete a budget line (logical or physical)
 */
async function deleteBudgetLine(idLinea, physical = false) {
  if (physical) {
    // Relying on ON DELETE CASCADE defined in the schema to wipe allocations
    const { data, error } = await supabase
      .from('budget_items')
      .delete()
      .eq('id_linea', idLinea);
      
    if (error) throw error;
    return data;
  } else {
    return await updateBudgetLine(idLinea, { estado: 'inactiva' });
  }
}

// Helper function to map from Supabase JSON back to the flat camelCase structure expected by the service
function mapSupabaseToApp(row) {
  const result = {
    id_linea: row.id_linea,
    idConsecutivo: row.id_consecutivo || '',
    cuenta: row.cuenta || '',
    cuentaContable: row.cuenta_contable || '',
    area: row.area || '',
    nombreElemento: row.nombre_elemento || '',
    escenario: row.escenario || 1,
    fecha: row.fecha || null,
    total: row.total || 0,
    totalOriginal: row.total_original || 0,
    icgi: row.icgi || '',
    porcentaje: row.porcentaje || '',
    linea: row.linea || '',
    ejecutadoAcumulado: row.ejecutado_acumulado || 0,
    saldo: row.saldo || 0,
    estado: row.estado || 'activa',
    observaciones: row.observaciones || ''
  };

  // Initialize all month keys to defaults
  const defaults = {
    1: ['enero', 'ogEnero', 'fechaEnero', 'lineaEnero'],
    2: ['febrero', 'ogFebrero', 'fechaFebrero', 'lineaFebrero'],
    3: ['marzo', 'ogMarzo', 'fechaMarzo', 'lineaMarzo'],
    4: ['abril', 'ogAbril', 'fechaAbril', 'lineaAbril'],
    5: ['mayo', 'ogMayo', 'fechaMayo', 'lineaMayo'],
    6: ['junio', 'ogJunio', 'fechaJunio', 'lineaJunio'],
    7: ['julio', 'ogJulio', 'fechaJulio', 'lineaJulio'],
    8: ['agosto', 'ogAgosto', 'fechaAgosto', 'lineaAgosto'],
    9: ['septiembre', 'ogSeptiembre', 'fechaSeptiembre', 'lineaSeptiembre'],
    10: ['octubre', 'ogOctubre', 'fechaOctubre', 'lineaOctubre'],
    11: ['noviembre', 'ogNoviembre', 'fechaNoviembre', 'lineaNoviembre'],
    12: ['diciembre', 'ogDiciembre', 'fechaDiciembre', 'lineaDiciembre']
  };

  Object.values(defaults).forEach(([m, ogM, dtM, linM]) => {
    result[m] = 0;
    result[ogM] = 0;
    result[dtM] = '';
    result[linM] = '';
  });

  // Populate from budget_allocations if joined
  if (row.budget_allocations && Array.isArray(row.budget_allocations)) {
    row.budget_allocations.forEach(alloc => {
      if (defaults[alloc.mes]) {
        const [m, ogM, dtM, linM] = defaults[alloc.mes];
        result[m] = alloc.monto || 0;
        result[ogM] = alloc.monto_original || 0;
        result[dtM] = alloc.fecha_mes || '';
        result[linM] = alloc.linea || '';
      }
    });
  }

  return result;
}

module.exports = {
  supabase,
  getAllBudgetLines,
  getAllBudgetLinesIncludeDeleted,
  upsertBudgetLines,
  updateBudgetLine,
  deleteBudgetLine,
  mapSupabaseToApp
};
