import { useState } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Target, ArrowLeftRight, AlertTriangle, X, FileText, Receipt } from 'lucide-react';
import { formatCurrency, formatCurrencyFull, formatPercentage } from '../utils/formatters';

/**
 * KPICards — Tarjetas de indicadores clave del dashboard.
 * Incluye una tarjeta extra para documentos sin asignación de línea de presupuesto.
 */
export default function KPICards({ kpis, unassignedDocs }) {
  // Estado para el modal de detalle de documentos sin asignar
  const [showUnassignedModal, setShowUnassignedModal] = useState(false);

  if (!kpis) return null;

  // Diferencia entre Ppto. Inicial y Actual (cuánto cambió el presupuesto vs lo aprobado)
  const diferencia = (kpis.totalPresupuestoInicial || 0) - (kpis.totalPresupuesto || 0);
  const hasDolibarrConfig = !!localStorage.getItem('dolibarr_config');

  const cards = [
    {
      key: 'budget-combined',
      label: 'Presupuesto Inicial / Actual',
      value: `${formatCurrency(kpis.totalPresupuestoInicial || 0)} / ${formatCurrency(kpis.totalPresupuesto || 0)}`,
      sub: `${kpis.totalLines || 0} líneas activas`,
      icon: DollarSign,
      type: 'budget',
    },
    {
      key: 'expenses',
      label: 'Ejecutado',
      value: formatCurrency(kpis.totalEjecutado || 0),
      sub: 'Total acumulado',
      icon: TrendingDown,
      type: 'expenses',
      valueClass: kpis.totalEjecutado > 0 ? 'danger' : '',
    },
    {
      key: 'difference',
      label: 'Diferencia (Inicial − Actual)',
      value: formatCurrency(Math.abs(diferencia)),
      sub: diferencia > 0 ? '↑ Inicial mayor al actual' : diferencia < 0 ? '↑ Actual mayor al inicial' : 'Sin variación',
      icon: ArrowLeftRight,
      type: 'difference',
      valueClass: diferencia > 0 ? 'success' : diferencia < 0 ? 'danger' : '',
    },
    {
      key: 'compliance',
      label: '% Ejecución',
      value: formatPercentage(kpis.porcentajeEjecucion || 0),
      sub: `Sobre P. Inicial: ${formatPercentage(kpis.porcentajeEjecucionInicial || 0)}`,
      icon: Target,
      type: 'compliance',
    },
  ];

  const TYPE_LABELS = {
    factura_proveedor: 'Factura',
    informe_gastos: 'Informe',
  };

  return (
    <>
      <div className="kpi-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          const isCompliance = card.key === 'compliance';
          const hasUnassigned = isCompliance && hasDolibarrConfig && unassignedDocs?.count > 0;

          return (
            <div 
              key={card.key} 
              className={`kpi-card ${card.type}`}
              style={hasUnassigned ? { cursor: 'pointer', position: 'relative' } : {}}
              onClick={() => hasUnassigned && setShowUnassignedModal(true)}
            >
              <div className="kpi-label">
                <Icon />
                {card.label}
              </div>
              
              {hasUnassigned && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  padding: '4px 10px',
                  background: '#FEF3C7',
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid #FCD34D',
                  fontSize: '0.68rem',
                  color: '#92400E',
                  fontWeight: 800,
                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.1)',
                  zIndex: 1,
                  animation: 'pulse 2s infinite',
                }}>
                  <AlertTriangle size={12} color="#F59E0B" />
                  <span>{unassignedDocs.count} sin asignar</span>
                </div>
              )}

              <div
                className={`kpi-value ${card.valueClass || ''}`}
                style={card.key === 'budget-combined' ? { fontSize: '1.1rem' } : {}}
              >
                {card.value}
              </div>
              <div className="kpi-sub">
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de detalle de documentos sin asignar */}
      {showUnassignedModal && unassignedDocs && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 10002, animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowUnassignedModal(false); }}
        >
          <div style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
            width: '95%',
            maxWidth: 800,
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.25s ease',
          }}>
            {/* Barra amarilla */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #F59E0B, #FCD34D)' }} />

            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <AlertTriangle size={18} color="#F59E0B" />
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1D3B' }}>
                    Documentos Sin Asignación de Línea
                  </span>
                  <span style={{
                    padding: '2px 10px', background: '#FEF3C7', color: '#92400E',
                    borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                    border: '1px solid #FCD34D',
                  }}>
                    {unassignedDocs.count} documentos · {formatCurrency(unassignedDocs.total)}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                  Facturas de proveedor e informes de gastos que no tienen línea de presupuesto asignada en Dolibarr.
                </p>
              </div>
              <button
                onClick={() => setShowUnassignedModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabla */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                    <th style={thStyle}>Referencia</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Proveedor / Autor</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Monto</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedDocs.items.map((doc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#1A1D3B', fontSize: '0.82rem' }}>
                        {doc.ref || '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                          background: doc.tipo === 'informe_gastos' ? '#EDE9FE' : '#DBEAFE',
                          color: doc.tipo === 'informe_gastos' ? '#5B21B6' : '#1E40AF',
                        }}>
                          {TYPE_LABELS[doc.tipo] || doc.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.proveedor}>
                        {doc.proveedor || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {doc.fecha
                          ? (() => {
                              const d = typeof doc.fecha === 'number'
                                ? new Date(doc.fecha * 1000)
                                : new Date(doc.fecha);
                              return isNaN(d) ? doc.fecha : d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            })()
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#1A1D3B', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyFull(doc.monto)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, background: '#F3F4F6', color: '#374151' }}>
                          {doc.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #E5E7EB', background: '#FEF3C7' }}>
                    <td colSpan={4} style={{ padding: '12px 16px', fontWeight: 700, color: '#92400E', fontSize: '0.85rem' }}>
                      Total sin asignar ({unassignedDocs.count} documentos)
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#92400E', fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrencyFull(unassignedDocs.total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUnassignedModal(false)}
                style={{
                  background: 'none', border: '1px solid #D1D5DB', borderRadius: 8,
                  padding: '7px 16px', cursor: 'pointer', color: '#374151',
                  fontSize: '0.85rem', fontWeight: 500,
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const thStyle = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#6B7280',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
