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

module.exports = { fetchInvoices, fetchPurchaseOrders };
