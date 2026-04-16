// Fetch está disponible de forma nativa en Node.js 18+

// Caché en memoria para evitar llamadas redundantes a la API por cada factura
const rateCache = new Map();

/**
 * Obtiene la TRM oficial de Colombia (USD a COP) para una fecha dada.
 * Utiliza la API de datos.gov.co (Superintendencia Financiera).
 * @param {string} dateStr Fecha en formato YYYY-MM-DD
 * @returns {number|null} El valor de la TRM o null si falla
 */
async function getOfficialTRM(dateStr) {
  try {
    // Buscamos la TRM vigente para esa fecha (puede que el día exacto sea festivo, por eso <= y DESC)
    const url = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde<='${dateStr}T23:59:59.000'&$order=vigenciadesde DESC&$limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.length > 0 && data[0].valor) {
      return parseFloat(data[0].valor);
    }
  } catch (error) {
    console.error(`Error fetching TRM for ${dateStr}:`, error.message);
  }
  return null;
}

/**
 * Obtiene la tasa de cambio de otras monedas (ej. EUR a COP) usando una API abierta.
 * @param {string} currency Código de moneda (ej. 'eur', 'usd')
 * @param {string} dateStr Fecha en formato YYYY-MM-DD
 * @returns {number|null} Tasa de cambio o null
 */
async function getFallbackExchangeRate(currency, dateStr) {
  try {
    const cur = currency.toLowerCase();
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${cur}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data[cur] && data[cur].cop) {
      return parseFloat(data[cur].cop);
    }
  } catch (error) {
    console.error(`Error fetching fallback rate for ${currency} on ${dateStr}:`, error.message);
  }
  return null;
}

/**
 * Función principal para obtener una tasa de cambio hacia COP, usando caché.
 * Da prioridad a la TRM oficial para USD.
 * @param {string} currencyCode Código de moneda (USD, EUR, etc.)
 * @param {string} dateStr Fecha en formato YYYY-MM-DD
 * @returns {Promise<number|null>} La tasa en COP o null si no se encuentra
 */
async function getExchangeRateToCOP(currencyCode, dateStr) {
  if (!currencyCode || currencyCode.toUpperCase() === 'COP') return 1;
  const currency = currencyCode.toUpperCase();
  const cacheKey = `${currency}_${dateStr}`;

  if (rateCache.has(cacheKey)) {
    return rateCache.get(cacheKey);
  }

  let rate = null;
  if (currency === 'USD') {
    rate = await getOfficialTRM(dateStr);
  }
  
  if (!rate) {
    rate = await getFallbackExchangeRate(currencyCode, dateStr);
  }

  if (rate) {
    rateCache.set(cacheKey, rate);
  }
  
  return rate;
}

/**
 * Convierte un timestamp unix (de Dolibarr) a string YYYY-MM-DD
 */
function unixToDateStr(unixTimestamp) {
  const d = new Date(unixTimestamp * 1000);
  if (isNaN(d.getTime())) return null;
  // Extraemos YYYY-MM-DD en la zona horaria de Colombia (UTC-5) para que coincida con la TRM
  // pero una simple ISO sirve como aproximación
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  getExchangeRateToCOP,
  unixToDateStr
};
