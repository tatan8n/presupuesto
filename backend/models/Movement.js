/**
 * Crea una entidad de Movimiento Real desde datos de Dolibarr.
 * @param {Object} data - Datos de la factura/orden de Dolibarr.
 * @returns {Object} Movimiento normalizado.
 */
function createMovement(data) {
  return {
    id_movimiento: data.id || data.ref || '',
    id_linea_presupuesto: data.id_linea_presupuesto || data.array_options?.options_id_linea_presupuesto || '',
    fecha_documento: data.date || data.datef || '',
    tipo_documento: data.tipo_documento || 'factura_proveedor',
    proveedor: data.socname || data.nom || '',
    monto: parseFloat(data.total_ttc) || parseFloat(data.total_ht) || 0,
    moneda: data.multicurrency_code || 'COP',
    estado_documento: data.statut || data.status || '',
  };
}

module.exports = { createMovement };
