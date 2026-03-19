/**
 * Utilidades para manejo de fechas y semanas en el año 2026 (Versión Backend).
 */

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Obtiene el número de semana actual para una fecha dada en 2026.
 * @param {Date} date - Fecha de referencia.
 * @returns {number} Número de semana (1-53).
 */
function getCurrentWeek(date = new Date()) {
  const year = 2026;
  const startOfYear = new Date(year, 0, 1);
  
  if (date.getFullYear() < year) return 1;
  if (date.getFullYear() > year) return 52;

  const diffInMs = date - startOfYear;
  const diffInDays = Math.floor(diffInMs / (24 * 60 * 60 * 1000));
  
  // Semana 1: Ene 1 - Ene 4 (Jue-Dom)
  if (diffInDays < 4) return 1;
  
  // Semana 2 empieza el Lunes 5 de Enero
  return Math.floor((diffInDays - 4) / 7) + 2;
}

module.exports = { getCurrentWeek };
