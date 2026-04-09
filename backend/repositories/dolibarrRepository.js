/**
 * Repositorio para la integración con la API REST de Dolibarr.
 * Obtiene facturas de proveedor y órdenes de compra.
 */

/**
 * Obtiene facturas de proveedor desde Dolibarr con paginación automática.
 * @param {Object} config - { url, apiKey, year }
 * @returns {Promise<Array>}
 */
async function fetchInvoices(config) {
  const { url, apiKey, year } = config;
  console.log(`[Dolibarr] fetchInvoices for ${year} (Paginated)`);
  
  if (!url || !apiKey) {
    throw new Error('Configuración de Dolibarr incompleta. Se requiere URL y API key.');
  }

  let baseUrl = url.replace(/\/$/, '');
  if (!baseUrl.endsWith('api/index.php')) {
    baseUrl = `${baseUrl}/api/index.php`;
  }

  const sqlFilters = `((t.datef:>=:'${year}-01-01') AND (t.datef:<=:'${year}-12-31'))`;
  
  let allInvoices = [];
  let page = 0;
  const limit = 100;
  let hasMore = true;

  try {
    while (hasMore) {
      const endpoint = `${baseUrl}/supplierinvoices?sortfield=t.rowid&sortorder=ASC&limit=${limit}&page=${page}&sqlfilters=${encodeURIComponent(sqlFilters)}`;
      console.log(`[Dolibarr] Fetching Invoices Page ${page}...`);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'DOLAPIKEY': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          hasMore = false;
          continue;
        }
        const errorText = await response.text();
        throw new Error(`Error al obtener facturas (Pág ${page}): ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        allInvoices = allInvoices.concat(data);
        if (data.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[Dolibarr] Total invoices fetched: ${allInvoices.length}`);
    return allInvoices;
  } catch (error) {
    console.log(`[Dolibarr] Invoices Exception: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene órdenes de compra desde Dolibarr con paginación automática.
 * @param {Object} config - { url, apiKey, year }
 * @returns {Promise<Array>}
 */
async function fetchPurchaseOrders(config) {
  const { url, apiKey, year } = config;
  console.log(`[Dolibarr] fetchPurchaseOrders for ${year} (Paginated)`);
  
  if (!url || !apiKey) {
    throw new Error('Configuración de Dolibarr incompleta. Se requiere URL y API key.');
  }

  let baseUrl = url.replace(/\/$/, '');
  if (!baseUrl.endsWith('api/index.php')) {
    baseUrl = `${baseUrl}/api/index.php`;
  }

  const sqlFilters = `((t.date_commande:>=:'${year}-01-01') AND (t.date_commande:<=:'${year}-12-31'))`;
  
  let allOrders = [];
  let page = 0;
  const limit = 100;
  let hasMore = true;

  try {
    while (hasMore) {
      const endpoint = `${baseUrl}/supplierorders?sortfield=t.rowid&sortorder=ASC&limit=${limit}&page=${page}&sqlfilters=${encodeURIComponent(sqlFilters)}`;
      console.log(`[Dolibarr] Fetching Orders Page ${page}...`);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'DOLAPIKEY': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          hasMore = false;
          continue;
        }
        const errorText = await response.text();
        throw new Error(`Error al obtener órdenes (Pág ${page}): ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        allOrders = allOrders.concat(data);
        if (data.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[Dolibarr] Total orders fetched: ${allOrders.length}`);
    return allOrders;
  } catch (error) {
    console.log(`[Dolibarr] Orders Exception: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene informes de gastos (expense reports) de tipo "Ejecutado" desde Dolibarr.
 * Se consideran ejecutados los que tienen status >= 4 (aprobado/validado/pagado).
 * @param {Object} config - { url, apiKey, year }
 * @returns {Promise<Array>}
 */
async function fetchExpenseReports(config) {
  const { url, apiKey, year } = config;
  console.log(`[Dolibarr] fetchExpenseReports for ${year} (Paginated)`);

  if (!url || !apiKey) {
    throw new Error('Configuración de Dolibarr incompleta. Se requiere URL y API key.');
  }

  let baseUrl = url.replace(/\/$/, '');
  if (!baseUrl.endsWith('api/index.php')) {
    baseUrl = `${baseUrl}/api/index.php`;
  }

  // Filtramos por año de creación y status >= 4 (aprobado o superior)
  const sqlFilters = `((t.date_create:>=:'${year}-01-01') AND (t.date_create:<=:'${year}-12-31') AND (t.fk_statut:>=:4))`;

  let allReports = [];
  let page = 0;
  const limit = 100;
  let hasMore = true;

  try {
    while (hasMore) {
      const endpoint = `${baseUrl}/expensereports?sortfield=t.rowid&sortorder=ASC&limit=${limit}&page=${page}&sqlfilters=${encodeURIComponent(sqlFilters)}`;
      console.log(`[Dolibarr] Fetching Expense Reports Page ${page}...`);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'DOLAPIKEY': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) { hasMore = false; continue; }
        throw new Error(`Error al obtener informes de gastos (Pág ${page}): ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        allReports = allReports.concat(data);
        if (data.length < limit) { hasMore = false; } else { page++; }
      } else {
        hasMore = false;
      }
    }

    console.log(`[Dolibarr] Total expense reports fetched: ${allReports.length}`);
    return allReports;
  } catch (error) {
    console.log(`[Dolibarr] ExpenseReports Exception: ${error.message}`);
    // No lanzamos error: si el endpoint no existe en la versión de Dolibarr, retornamos vacío
    return [];
  }
}

module.exports = { fetchInvoices, fetchPurchaseOrders, fetchExpenseReports };
