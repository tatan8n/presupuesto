/**
 * Formatea un número como moneda colombiana (COP).
 */
export function formatCurrency(value) {
  if (value === null || value === undefined) return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';

  // Para valores grandes, usar abreviaciones
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1).replace('.0', '')}M`;
  }
  if (abs >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
}

/**
 * Formatea un número como moneda completa con separadores.
 */
export function formatCurrencyFull(value) {
  if (value === null || value === undefined) return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Formatea un porcentaje.
 */
export function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined) return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${num.toFixed(decimals)}%`;
}

/**
 * Formatea un número con separadores de miles.
 */
export function formatNumber(value) {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('es-CO').format(num);
}
