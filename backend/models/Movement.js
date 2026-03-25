/**
 * Crea una entidad de Movimiento Real desde datos de Dolibarr.
 * @param {Object} data - Datos de la factura/orden de Dolibarr.
 * @returns {Object} Movimiento normalizado.
 */
function createMovement(data) {
  // El usuario indica que array_options.options_ppto contiene el #ID consecutivo de la línea
  const budgetLineId = data.array_options?.options_ppto || data.id_linea_presupuesto || '';
  
  return {
    id_movimiento: data.id || data.ref || '',
    id_linea_presupuesto: budgetLineId,
    fecha_documento: data.date || data.datef || '',
    tipo_documento: data.tipo_documento || 'factura_proveedor',
    proveedor: data.socname || data.nom || '',
    monto: parseFloat(data.total_ttc) || parseFloat(data.total_ht) || 0,
    moneda: data.multicurrency_code || 'COP',
    estado_documento: data.statut || data.status || '',
  };
}

module.exports = { createMovement };
