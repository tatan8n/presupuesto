/**
 * Utilidades para manejo de fechas y semanas en el año 2026.
 */

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Obtiene el rango de fechas para una semana específica del año 2026.
 * @param {number} weekNo - Número de semana (1-52).
 * @returns {string} Rango formateado "del DD de MMM al DD de MMM".
 */
export function getWeekRange(weekNo) {
  const year = 2026;
  
  // En 2026, el 1 de enero fue jueves.
  // La Semana 1 va del jueves 1 de enero al domingo 4 de enero.
  // A partir de la Semana 2, comienzan los lunes.
  
  let startDate, endDate;
  
  if (weekNo === 1) {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 0, 4);
  } else {
    // La primera semana completa con lunes empieza el 5 de enero (Semana 2)
    const firstMonday = new Date(year, 0, 5);
    startDate = new Date(firstMonday);
    startDate.setDate(firstMonday.getDate() + (weekNo - 2) * 7);
    
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    // Ajuste para fin de año
    if (endDate.getFullYear() > year) {
      endDate = new Date(year, 11, 31);
    }
  }

  const formatDay = (date) => {
    const d = date.getDate();
    const m = MONTH_NAMES[date.getMonth()];
    return `${d} de ${m}`;
  };

  return `del ${formatDay(startDate)} al ${formatDay(endDate)}`;
}

/**
 * Obtiene el número de semana actual para una fecha dada en 2026.
 * @param {Date} date - Fecha de referencia.
 * @returns {number} Número de semana (1-53).
 */
export function getCurrentWeek(date = new Date()) {
  const year = 2026;
  const startOfYear = new Date(year, 0, 1);
  
  // Si la fecha es anterior a 2026, forzamos a inicio de año
  if (date.getFullYear() < year) return 1;
  // Si es posterior, forzamos a fin de año
  if (date.getFullYear() > year) return 52;

  const diffInMs = date - startOfYear;
  const diffInDays = Math.floor(diffInMs / (24 * 60 * 60 * 1000));
  
  // El 1 de enero fue jueves (día 3 de la semana ISO si empezamos lunes index 0? No, let's keep it simple)
  // Semana 1: días 0, 1, 2, 3 (Jue, Vie, Sab, Dom)
  if (diffInDays < 4) return 1;
  
  // Semana 2 empieza en día 4 (Lunes 5 de enero)
  return Math.floor((diffInDays - 4) / 7) + 2;
}
