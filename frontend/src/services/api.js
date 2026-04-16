const API_BASE = '/api';

/** Carga el archivo Excel por defecto en el backend. */
export async function loadDefaultBudget() {
  const res = await fetch(`${API_BASE}/budget/load-default`, { method: 'POST' });
  if (!res.ok) throw new Error('Error al cargar presupuesto');
  return res.json();
}

/** Sube un archivo Excel al backend. */
export async function uploadExcel(file, sheetName = 'Detalle') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sheetName', sheetName);
  const res = await fetch(`${API_BASE}/budget/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Error al subir archivo');
  return res.json();
}

function buildQueryParams(filters) {
  const params = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    const val = filters[key];
    if (Array.isArray(val)) {
      if (val.length > 0) params.append(key, val.join('|||'));
    } else if (val !== undefined && val !== null && val !== '') {
      params.append(key, val);
    }
  });
  return params;
}

/** Obtiene los KPIs con filtros opcionales. */
export async function getKPIs(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget/kpis?${params}`);
  if (!res.ok) throw new Error('Error al obtener KPIs');
  return res.json();
}

/** Obtiene datos mensuales para gráficos. */
export async function getMonthlyData(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget/monthly?${params}`);
  if (!res.ok) throw new Error('Error al obtener datos mensuales');
  return res.json();
}

/** Obtiene el flujo semanal. */
export async function getWeeklyFlow(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget/weekly-flow?${params}`);
  if (!res.ok) throw new Error('Error al obtener flujo semanal');
  return res.json();
}

/** Obtiene las opciones de filtros. */
export async function getFilterOptions() {
  const res = await fetch(`${API_BASE}/budget/filters`);
  if (!res.ok) throw new Error('Error al obtener filtros');
  return res.json();
}

/**
 * Obtiene las líneas de presupuesto con filtros.
 * @param {Object} filters - Filtros a aplicar
 * @param {boolean} includeDeleted - Si true, incluye líneas eliminadas
 */
export async function getBudgetLines(filters = {}, includeDeleted = false) {
  const params = buildQueryParams({ ...filters, ...(includeDeleted ? { includeDeleted: true } : {}) });
  const res = await fetch(`${API_BASE}/budget?${params}`);
  if (!res.ok) throw new Error('Error al obtener líneas');
  return res.json();
}

/** Crea una nueva línea de presupuesto. */
export async function createBudgetLine(data) {
  const res = await fetch(`${API_BASE}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear línea');
  return res.json();
}

/** Actualiza una línea de presupuesto. */
export async function updateBudgetLine(id, data) {
  const res = await fetch(`${API_BASE}/budget/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar línea');
  return res.json();
}

/** Eliminación lógica de una línea (estado='eliminada'). */
export async function deleteBudgetLine(id, reason = '', physical = false) {
  const res = await fetch(`${API_BASE}/budget/${id}?physical=${physical}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  if (!res.ok) throw new Error('Error al eliminar línea');
  return res.json();
}

/** Restaura una línea previamente eliminada. */
export async function restoreBudgetLine(id) {
  const res = await fetch(`${API_BASE}/budget/${id}/restore`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error al restaurar línea');
  return res.json();
}

/** Exporta el reporte semanal en Excel. */
export async function exportWeeklyExcel(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget/export-weekly?${params}`, { method: 'GET' });
  if (!res.ok) throw new Error('Error al generar Excel');
  
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FlujoSemanal_Presupuesto_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Exporta el reporte semanal modificado (facturas deduplicadas). */
export async function exportCustomWeeklyExcel(customData, options) {
  const res = await fetch(`${API_BASE}/budget/export-weekly-custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customData, options }),
  });
  if (!res.ok) throw new Error('Error al generar Excel custom');
  
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FlujoSemanal_Refinado_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Fetch unpaid invoices matching up to the given endWeek. */
export async function getUnpaidInvoices(endWeek, dolibarrConfig) {
  const res = await fetch(`${API_BASE}/budget/unpaid-invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endWeek, dolibarrConfig })
  });
  if (!res.ok) throw new Error('Error al obtener facturas no pagadas');
  return res.json();
}

/** Sincroniza movimientos desde Dolibarr. */
export async function syncDolibarr(dolibarrConfig) {
  const res = await fetch(`${API_BASE}/budget/sync-dolibarr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dolibarrConfig }),
  });
  if (!res.ok) throw new Error('Error al sincronizar con Dolibarr');
  return res.json();
}

/** Obtiene los movimientos de ejecución de una línea de presupuesto. */
export async function getLineMovements(lineId) {
  const res = await fetch(`${API_BASE}/budget/${lineId}/movements`);
  if (!res.ok) throw new Error('Error al obtener movimientos de la línea');
  return res.json();
}

/** Obtiene documentos sin asignación de línea de presupuesto. */
export async function getUnassignedDocuments(dolibarrConfig) {
  const params = new URLSearchParams();
  if (dolibarrConfig) {
    params.append('dolibarrConfig', JSON.stringify(dolibarrConfig));
  }
  const res = await fetch(`${API_BASE}/budget/unassigned-docs?${params}`);
  if (!res.ok) throw new Error('Error al obtener documentos sin asignación');
  return res.json();
}

// ==========================================
// TRASLADOS DE PRESUPUESTO
// ==========================================

/** Lista todos los traslados de presupuesto. */
export async function listTransfers() {
  const res = await fetch(`${API_BASE}/budget/transfers/list`);
  if (!res.ok) throw new Error('Error al obtener traslados');
  return res.json();
}

/** Solicita un nuevo traslado (queda en estado 'pendiente'). */
export async function createTransfer(fromId, toId, amounts, motivo, solicitante) {
  const res = await fetch(`${API_BASE}/budget/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromId, toId, amounts, motivo, solicitante }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al solicitar traslado');
  }
  return res.json();
}

/** Aprueba un traslado pendiente (requiere autenticación por PIN en el frontend). */
export async function approveTransfer(transferId, approvedBy = 'Jhonatan Mejía') {
  const res = await fetch(`${API_BASE}/budget/transfers/${transferId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvedBy }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al aprobar traslado');
  }
  return res.json();
}

/** Rechaza un traslado pendiente. */
export async function rejectTransfer(transferId, reason = '') {
  const res = await fetch(`${API_BASE}/budget/transfers/${transferId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al rechazar traslado');
  }
  return res.json();
}

/** Elimina un traslado en estado pendiente o rechazado. */
export async function deleteTransfer(transferId) {
  const res = await fetch(`${API_BASE}/budget/transfers/${transferId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al eliminar traslado');
  }
  return res.json();
}

/** Modifica un traslado en estado pendiente. */
export async function updateTransfer(transferId, data) {
  const res = await fetch(`${API_BASE}/budget/transfers/${transferId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al modificar traslado');
  }
  return res.json();
}
