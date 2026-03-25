/**
 * Repositorio para la integración con la API REST de Dolibarr.
 * Obtiene facturas de proveedor y órdenes de compra.
 */

/**
 * Obtiene facturas de proveedor desde Dolibarr.
 * @param {Object} config - { url, apiKey, year }
 * @returns {Promise<Array>}
 */
async function fetchInvoices(config) {
  const { url, apiKey, year } = config;
  console.log(`[Dolibarr] fetchInvoices for ${year}`);
  
  if (!url || !apiKey) {
    throw new Error('Configuración de Dolibarr incompleta. Se requiere URL y API key.');
  }

  let baseUrl = url.replace(/\/$/, '');
  if (!baseUrl.endsWith('api/index.php')) {
    baseUrl = `${baseUrl}/api/index.php`;
  }

  const sqlFilters = `((t.datef:>=:'${year}-01-01') AND (t.datef:<=:'${year}-12-31'))`;
  const endpoint = `${baseUrl}/supplierinvoices?sortfield=t.rowid&sortorder=ASC&limit=1000&sqlfilters=${encodeURIComponent(sqlFilters)}`;

  console.log(`[Dolibarr] Endpoint: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'DOLAPIKEY': apiKey,
        'Accept': 'application/json',
      },
    });

    console.log(`[Dolibarr] Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Dolibarr] Error body: ${errorText}`);
      throw new Error(`Error al obtener facturas: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Dolibarr] Is array: ${Array.isArray(data)}, length: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(`[Dolibarr] Exception: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene órdenes de compra desde Dolibarr.
 * @param {Object} config - { url, apiKey, year }
 * @returns {Promise<Array>}
 */
async function fetchPurchaseOrders(config) {
  const { url, apiKey, year } = config;
  console.log(`[Dolibarr] fetchPurchaseOrders for ${year}`);
  
  if (!url || !apiKey) {
    throw new Error('Configuración de Dolibarr incompleta. Se requiere URL y API key.');
  }

  let baseUrl = url.replace(/\/$/, '');
  if (!baseUrl.endsWith('api/index.php')) {
    baseUrl = `${baseUrl}/api/index.php`;
  }

  // En órdenes de compra de proveedor, a veces el campo es t.date_commande
  const sqlFilters = `((t.date_commande:>=:'${year}-01-01') AND (t.date_commande:<=:'${year}-12-31'))`;
  const endpoint = `${baseUrl}/supplierorders?sortfield=t.rowid&sortorder=ASC&limit=1000&sqlfilters=${encodeURIComponent(sqlFilters)}`;

  console.log(`[Dolibarr] Orders Endpoint: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'DOLAPIKEY': apiKey,
        'Accept': 'application/json',
      },
    });

    console.log(`[Dolibarr] Orders Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Dolibarr] Orders Error body: ${errorText}`);
      throw new Error(`Error al obtener órdenes: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Dolibarr] Orders is array: ${Array.isArray(data)}, length: ${Array.isArray(data) ? data.length : 'N/A'}`);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(`[Dolibarr] Orders Exception: ${error.message}`);
    throw error;
  }
}

module.exports = { fetchInvoices, fetchPurchaseOrders };
