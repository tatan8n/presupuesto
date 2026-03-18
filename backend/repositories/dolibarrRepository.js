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
  if (!url || !apiKey) {
    throw new Error('Configuración de Dolibarr incompleta. Se requiere URL y API key.');
  }

  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/index.php/supplierinvoices`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'DOLAPIKEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener facturas: ${response.status} ${response.statusText}`);
    }

    const invoices = await response.json();

    // Filtrar por año
    return invoices.filter(inv => {
      const date = inv.datef || inv.date || '';
      return date.toString().includes(year);
    });
  } catch (error) {
    console.error('Error conectándose a Dolibarr (facturas):', error.message);
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
  if (!url || !apiKey) {
    throw new Error('Configuración de Dolibarr incompleta. Se requiere URL y API key.');
  }

  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/index.php/supplierorders`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'DOLAPIKEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener órdenes: ${response.status} ${response.statusText}`);
    }

    const orders = await response.json();

    return orders.filter(ord => {
      const date = ord.date || ord.date_commande || '';
      return date.toString().includes(year);
    });
  } catch (error) {
    console.error('Error conectándose a Dolibarr (órdenes):', error.message);
    throw error;
  }
}

module.exports = { fetchInvoices, fetchPurchaseOrders };
