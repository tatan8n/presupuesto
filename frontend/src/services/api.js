const API_BASE = '/api';

/**
 * Carga el archivo Excel por defecto en el backend.
 */
export async function loadDefaultBudget() {
  const res = await fetch(`${API_BASE}/budget/load-default`, { method: 'POST' });
  if (!res.ok) throw new Error('Error al cargar presupuesto');
  return res.json();
}

/**
 * Sube un archivo Excel al backend.
 */
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

/**
 * Obtiene los KPIs con filtros opcionales.
 */
export async function getKPIs(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget/kpis?${params}`);
  if (!res.ok) throw new Error('Error al obtener KPIs');
  return res.json();
}

/**
 * Obtiene datos mensuales para gráficos.
 */
export async function getMonthlyData(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget/monthly?${params}`);
  if (!res.ok) throw new Error('Error al obtener datos mensuales');
  return res.json();
}

/**
 * Obtiene el flujo semanal.
 */
export async function getWeeklyFlow(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget/weekly-flow?${params}`);
  if (!res.ok) throw new Error('Error al obtener flujo semanal');
  return res.json();
}

/**
 * Obtiene las opciones de filtros.
 */
export async function getFilterOptions() {
  const res = await fetch(`${API_BASE}/budget/filters`);
  if (!res.ok) throw new Error('Error al obtener filtros');
  return res.json();
}

/**
 * Obtiene las líneas de presupuesto con filtros.
 */
export async function getBudgetLines(filters = {}) {
  const params = buildQueryParams(filters);
  const res = await fetch(`${API_BASE}/budget?${params}`);
  if (!res.ok) throw new Error('Error al obtener líneas');
  return res.json();
}

/**
 * Crea una nueva línea de presupuesto.
 */
export async function createBudgetLine(data) {
  const res = await fetch(`${API_BASE}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear línea');
  return res.json();
}

/**
 * Actualiza una línea de presupuesto.
 */
export async function updateBudgetLine(id, data) {
  const res = await fetch(`${API_BASE}/budget/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar línea');
  return res.json();
}

/**
 * Elimina una línea de presupuesto.
 */
export async function deleteBudgetLine(id, physical = false) {
  const res = await fetch(`${API_BASE}/budget/${id}?physical=${physical}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar línea');
  return res.json();
}

/**
 * Exporta el reporte semanal en Excel.
 */
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

/**
 * Sincroniza movimientos desde Dolibarr.
 */
export async function syncDolibarr(dolibarrConfig) {
  const res = await fetch(`${API_BASE}/budget/sync-dolibarr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dolibarrConfig }),
  });
  if (!res.ok) throw new Error('Error al sincronizar con Dolibarr');
  return res.json();
}
