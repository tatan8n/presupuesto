/**
 * Crea una entidad de Movimiento Real desde datos de Dolibarr.
 * @param {Object} data - Datos de la factura/orden de Dolibarr.
 * @returns {Object} Movimiento normalizado.
 */
function createMovement(data) {
  // El usuario indica que array_options.options_ppto contiene el #ID consecutivo de la línea
  const budgetLineId = data.array_options?.options_ppto || data.id_linea_presupuesto || '';

  // Referencia legible del documento (ej: FA2026/00123, ND2026/00001)
  // Se prioriza `ref` (referencia humana) sobre `id` (ID numérico interno de Dolibarr).
  const refLegible = data.ref || '';
  // El id_movimiento se usa como clave única interna: usamos el id numérico de Dolibarr
  const idMovimiento = data.id || data.ref || '';

  // Nombre del proveedor / tercero.
  // Dolibarr puede devolver el nombre en varios campos según el endpoint y la versión:
  //   facturas/órdenes  → socname (enriquecido via getThirdpartyMap), thirdparty.name, nom
  //   informes de gastos → user_author_infos (nombre completo, campo más confiable)
  const proveedor =
    data.socname ||
    data.thirdparty?.name ||
    data.thirdparty_name ||
    data.name_alias ||
    data.user_author_infos ||
    data.user_author ||
    data.nom ||
    '';

  return {
    id_movimiento: idMovimiento,
    ref_documento: refLegible,        // referencia legible (FA2026/00123, ER2604-XXXX)
    id_linea_presupuesto: budgetLineId,
    fecha_documento: data.date || data.datef || '',
    tipo_documento: data.tipo_documento || 'factura_proveedor',
    proveedor,
    monto: parseFloat(data.total_ht) || parseFloat(data.total_ttc) || 0,
    moneda: data.multicurrency_code || 'COP',
    // `status` es el campo de estado en expensereports; `statut` en facturas/órdenes
    estado_documento: data.statut || data.status || data.fk_statut || '',
  };
}

module.exports = { createMovement };
