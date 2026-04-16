import { useState, useEffect } from 'react';
import { X, FileText, Receipt, AlertCircle, RefreshCw } from 'lucide-react';
import { getLineMovements } from '../services/api';
import { formatCurrencyFull } from '../utils/formatters';

/**
 * Modal que muestra todos los documentos de ejecución (facturas + informes de gastos)
 * vinculados a una línea de presupuesto específica.
 *
 * Props:
 *   - line: objeto de la línea de presupuesto (debe tener id_linea)
 *   - onClose: función para cerrar el modal
 */

// Mapas de estados legibles por tipo de documento
const INVOICE_STATES = {
  '0': 'Borrador',
  '1': 'Validada',
  '2': 'Pagada',
  '3': 'Cancelada',
};

const EXPENSE_STATES = {
  '0': 'Borrador',
  '2': 'Pendiente validación',
  '4': 'Validado',
  '5': 'Pagado',
  '99': 'Rechazado',
};

function getStateLabel(tipo, estado) {
  const map = tipo === 'informe_gastos' ? EXPENSE_STATES : INVOICE_STATES;
  return map[String(estado)] || `Estado ${estado}`;
}

function getStateBadgeStyle(tipo, estado) {
  const s = String(estado);
  if (tipo === 'informe_gastos') {
    if (s === '5') return { background: '#D1FAE5', color: '#065F46' };
    if (s === '4') return { background: '#DBEAFE', color: '#1E40AF' };
    if (s === '99') return { background: '#FEE2E2', color: '#991B1B' };
    return { background: '#F3F4F6', color: '#374151' };
  }
  if (s === '2') return { background: '#D1FAE5', color: '#065F46' };
  if (s === '1') return { background: '#DBEAFE', color: '#1E40AF' };
  if (s === '3') return { background: '#FEE2E2', color: '#991B1B' };
  return { background: '#F3F4F6', color: '#374151' };
}

const TYPE_LABELS = {
  factura_proveedor: 'Factura Proveedor',
  informe_gastos: 'Informe de Gastos',
};

export default function ExecutionModal({ line, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getLineMovements(line.id_linea);
        setData(result);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [line.id_linea]);

  const totalMovements = data?.movements?.reduce((s, m) => s + m.monto, 0) || 0;
  const pct = data?.line?.totalPresupuesto > 0
    ? (totalMovements / data.line.totalPresupuesto) * 100
    : 0;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 10001 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        width: '95%',
        maxWidth: 760,
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Barra superior verde/teal */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, var(--teal), var(--teal-light))' }} />

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Receipt size={18} color="var(--teal)" />
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1D3B' }}>
                Documentos de Ejecución
              </span>
              {line.idConsecutivo && (
                <span style={{
                  fontSize: '0.78rem', fontWeight: 600, padding: '2px 8px',
                  background: 'rgba(26,139,141,0.1)', color: 'var(--teal)',
                  borderRadius: 20, border: '1px solid rgba(26,139,141,0.2)',
                }}>
                  #{line.idConsecutivo}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>
              {line.nombreElemento}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 2 }}>
              {line.area && <span style={{ marginRight: 8 }}>📍 {line.area}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B7280', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* KPIs de la línea */}
        {!loading && data && (
          <div style={{
            padding: '14px 24px',
            background: '#F9FAFB',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presupuesto Total</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1D3B' }}>
                {formatCurrencyFull(data.line.totalPresupuesto)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ejecutado</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: totalMovements > data.line.totalPresupuesto ? '#E74C3C' : '#1A8B8D' }}>
                {formatCurrencyFull(totalMovements)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>% Ejecución</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: pct > 100 ? '#E74C3C' : pct > 75 ? '#F39C12' : '#27AE60' }}>
                {pct.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documentos</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1D3B' }}>
                {data.movements.length}
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, color: '#6B7280' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Cargando documentos...
            </div>
          )}

          {error && (
            <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 10, color: '#991B1B', background: '#FEF2F2', margin: 20, borderRadius: 8 }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data?.movements?.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
              <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontWeight: 500, color: '#374151', marginBottom: 4 }}>Sin documentos de ejecución</p>
              <p style={{ fontSize: '0.85rem' }}>
                Esta línea no tiene facturas ni informes de gastos vinculados.
                Asegúrate de haber sincronizado con Dolibarr.
              </p>
            </div>
          )}

          {!loading && !error && data?.movements?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Referencia</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Proveedor / Autor</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#6B7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monto</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#6B7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map((mov, idx) => (
                  <tr
                    key={mov.id || idx}
                    style={{
                      borderBottom: '1px solid #F3F4F6',
                      background: idx % 2 === 0 ? '#ffffff' : '#FAFAFA',
                    }}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1A1D3B', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {mov.ref || mov.id || '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                        background: mov.tipo === 'informe_gastos' ? '#EDE9FE' : '#DBEAFE',
                        color: mov.tipo === 'informe_gastos' ? '#5B21B6' : '#1E40AF',
                      }}>
                        {TYPE_LABELS[mov.tipo] || mov.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.proveedor}>
                      {mov.proveedor || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {mov.fecha
                        ? new Date(mov.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#1A1D3B', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrencyFull(mov.monto)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                        ...getStateBadgeStyle(mov.tipo, mov.estado),
                      }}>
                        {getStateLabel(mov.tipo, mov.estado)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #E5E7EB', background: '#F9FAFB' }}>
                  <td colSpan={4} style={{ padding: '12px 16px', fontWeight: 700, color: '#374151', fontSize: '0.85rem' }}>
                    Total ejecutado ({data.movements.length} documentos)
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: totalMovements > (data?.line?.totalPresupuesto || 0) ? '#E74C3C' : '#1A8B8D', fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyFull(totalMovements)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            className="btn btn-outline"
            onClick={onClose}
            style={{ color: '#374151', borderColor: '#D1D5DB' }}
          >
            Cerrar
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
