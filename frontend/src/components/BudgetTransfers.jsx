import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeftRight, Check, X, Plus, Clock, ChevronDown, ChevronUp, AlertTriangle, Lock, Trash2, Search } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { listTransfers, createTransfer, approveTransfer, rejectTransfer } from '../services/api';
import MasterPinUnlock from './MasterPinUnlock';
import CurrencyInput from './CurrencyInput';

const MONTH_KEYS = [
  { key: 'enero', label: 'Enero' }, { key: 'febrero', label: 'Febrero' },
  { key: 'marzo', label: 'Marzo' }, { key: 'abril', label: 'Abril' },
  { key: 'mayo', label: 'Mayo' }, { key: 'junio', label: 'Junio' },
  { key: 'julio', label: 'Julio' }, { key: 'agosto', label: 'Agosto' },
  { key: 'septiembre', label: 'Septiembre' }, { key: 'octubre', label: 'Octubre' },
  { key: 'noviembre', label: 'Noviembre' }, { key: 'diciembre', label: 'Diciembre' },
];

const MONTH_MAP = Object.fromEntries(MONTH_KEYS.map(m => [m.key, m.label]));

const STATUS_LABELS = {
  pendiente: { label: 'Pendiente', color: '#E67E22', bg: 'rgba(230, 126, 34, 0.1)', border: 'rgba(230, 126, 34, 0.3)' },
  aprobado:  { label: 'Aprobado',  color: '#27AE60', bg: 'rgba(39, 174, 96, 0.1)',  border: 'rgba(39, 174, 96, 0.3)' },
  rechazado: { label: 'Rechazado', color: '#E74C3C', bg: 'rgba(231, 76, 60, 0.1)',  border: 'rgba(231, 76, 60, 0.3)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// SearchableLineSelect – combobox con búsqueda por #, nombre y área
// ─────────────────────────────────────────────────────────────────────────────
function SearchableLineSelect({ lines, value, onChange, placeholder, excludeId }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef(null);

  const selected = useMemo(() => lines.find(l => l.id_linea === value) || null, [lines, value]);
  const displayText = open ? query : (selected ? `#${selected.idConsecutivo} — ${selected.nombreElemento}` : '');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = excludeId ? lines.filter(l => l.id_linea !== excludeId) : lines;
    if (!q) return base.slice(0, 80);
    return base.filter(l =>
      String(l.idConsecutivo).includes(q) ||
      (l.nombreElemento || '').toLowerCase().includes(q) ||
      (l.area || '').toLowerCase().includes(q) ||
      (l.cuenta || '').toLowerCase().includes(q)
    ).slice(0, 80);
  }, [lines, query, excludeId]);

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (line) => { onChange(line.id_linea); setQuery(''); setOpen(false); };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          className="form-input"
          style={{ paddingLeft: 32, paddingRight: 32 }}
          value={displayText}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          placeholder={placeholder || 'Buscar línea...'}
          autoComplete="off"
        />
        <ChevronDown style={{ position: 'absolute', right: 10, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none', transition: 'transform 0.2s' }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 1000, width: '100%', top: 'calc(100% + 4px)', background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-lg)', maxHeight: 260, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin resultados</div>
            : filtered.map(l => (
              <div key={l.id_linea} onMouseDown={() => handleSelect(l)}
                style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid var(--border-light)', background: l.id_linea === value ? 'rgba(46,49,146,0.08)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = l.id_linea === value ? 'rgba(46,49,146,0.08)' : 'transparent'}
              >
                <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: 6 }}>#{l.idConsecutivo}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{l.nombreElemento}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.75rem' }}>({l.area})</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function truncate(str, max) { return str && str.length > max ? str.slice(0, max) + '…' : str; }

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de 12 meses fijos con selector de mes destino por fila
// ─────────────────────────────────────────────────────────────────────────────
function CrossMonthTable({ fromLine, toLine, rows, onRowChange }) {
  // rows es un array de 12 entradas (una por mes), indexado por MONTH_KEYS
  // rows[i] = { toMonth: string, amount: number }
  const totalTraslado = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 640 }}>
        <thead>
          {/* Grupo headers */}
          <tr style={{ background: 'var(--bg)' }}>
            <th colSpan={3}
              style={{ padding: '6px 10px', textAlign: 'center', background: 'rgba(231,76,60,0.06)',
                       borderBottom: '1px solid rgba(231,76,60,0.2)', color: '#E74C3C', fontWeight: 700,
                       fontSize: '0.75rem', borderRight: '2px solid rgba(0,0,0,0.07)' }}>
              📤 Origen: {fromLine?.nombreElemento ? truncate(fromLine.nombreElemento, 35) : '—'}
            </th>
            <th colSpan={3}
              style={{ padding: '6px 10px', textAlign: 'center', background: 'rgba(39,174,96,0.06)',
                       borderBottom: '1px solid rgba(39,174,96,0.2)', color: '#27AE60', fontWeight: 700,
                       fontSize: '0.75rem' }}>
              📥 Destino: {toLine?.nombreElemento ? truncate(toLine.nombreElemento, 35) : 'selecciona una línea destino'}
            </th>
          </tr>
          <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left',  color: '#E74C3C', fontWeight: 600, background: 'rgba(231,76,60,0.04)', width: '14%' }}>Mes</th>
            <th style={{ padding: '6px 10px', textAlign: 'right', color: '#E74C3C', fontWeight: 600, background: 'rgba(231,76,60,0.04)', width: '14%' }}>P. Actual</th>
            <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--primary)', fontWeight: 700, background: 'rgba(231,76,60,0.02)', width: '16%', borderRight: '2px solid rgba(0,0,0,0.07)' }}>Monto a trasladar</th>
            <th style={{ padding: '6px 10px', textAlign: 'left',  color: '#27AE60', fontWeight: 600, background: 'rgba(39,174,96,0.04)', width: '18%' }}>Mes destino</th>
            <th style={{ padding: '6px 10px', textAlign: 'right', color: '#27AE60', fontWeight: 600, background: 'rgba(39,174,96,0.04)', width: '14%' }}>P. Actual</th>
            <th style={{ padding: '6px 10px', textAlign: 'right', color: '#27AE60', fontWeight: 700, background: 'rgba(39,174,96,0.08)', width: '14%' }}>Nuevo destino</th>
          </tr>
        </thead>
        <tbody>
          {MONTH_KEYS.map((m, i) => {
            const row         = rows[i] ?? { toMonth: m.key, amount: 0 }; // guard defensivo
            const actualFrom  = parseFloat(fromLine?.[m.key])     || 0;
            const amt         = parseFloat(row.amount)             || 0;
            const newFrom     = actualFrom - amt;
            const actualTo    = parseFloat(toLine?.[row.toMonth])       || 0;
            const newTo       = actualTo + amt;
            const overLimit   = amt > 0 && amt > actualFrom;
            const hasAmount   = amt > 0;
            const rowBg       = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)';

            return (
              <tr key={m.key} style={{ borderBottom: '1px solid var(--border-light)', background: rowBg }}>
                {/* Mes origen — fijo */}
                <td style={{ padding: '5px 10px', fontWeight: 600, color: 'var(--text-primary)', background: 'rgba(231,76,60,0.04)', whiteSpace: 'nowrap' }}>
                  {m.label}
                </td>
                {/* P. Actual origen */}
                <td style={{ padding: '5px 10px', textAlign: 'right', color: actualFrom > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', background: 'rgba(231,76,60,0.04)', whiteSpace: 'nowrap' }}>
                  {formatCurrency(actualFrom)}
                </td>
                {/* Monto a trasladar */}
                <td style={{ padding: '4px 6px', background: overLimit ? 'rgba(231,76,60,0.06)' : 'rgba(231,76,60,0.02)', borderRight: '2px solid rgba(0,0,0,0.07)' }}>
                  <CurrencyInput
                    value={row.amount}
                    onChange={val => onRowChange(i, 'amount', val)}
                    placeholder="0"
                    style={{ width: '100%', textAlign: 'right',
                             border: overLimit ? '1.5px solid #E74C3C' : undefined,
                             background: hasAmount && !overLimit ? 'rgba(46,49,146,0.03)' : undefined }}
                  />
                  {overLimit && (
                    <div style={{ fontSize: '0.65rem', color: '#E74C3C', textAlign: 'right', marginTop: 2 }}>⚠ excede</div>
                  )}
                </td>
                {/* Mes destino — dropdown */}
                <td style={{ padding: '4px 8px', background: hasAmount ? 'rgba(39,174,96,0.04)' : 'transparent' }}>
                  {hasAmount ? (
                    <select
                      className="form-input"
                      value={row.toMonth}
                      onChange={e => onRowChange(i, 'toMonth', e.target.value)}
                      style={{ width: '100%', fontSize: '0.78rem' }}
                    >
                      {MONTH_KEYS.map(mk => (
                        <option key={mk.key} value={mk.key}>{mk.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0 4px' }}>—</span>
                  )}
                </td>
                {/* P. Actual destino */}
                <td style={{ padding: '5px 10px', textAlign: 'right', color: hasAmount ? 'var(--text-secondary)' : 'var(--text-muted)', background: hasAmount ? 'rgba(39,174,96,0.04)' : 'transparent', whiteSpace: 'nowrap' }}>
                  {hasAmount && toLine ? formatCurrency(actualTo) : '—'}
                </td>
                {/* Nuevo destino */}
                <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: hasAmount ? 700 : 400,
                             color: hasAmount ? '#27AE60' : 'var(--text-muted)',
                             background: hasAmount ? 'rgba(39,174,96,0.08)' : 'transparent', whiteSpace: 'nowrap' }}>
                  {hasAmount && toLine ? formatCurrency(newTo) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--border)' }}>
            <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--text-primary)', background: 'rgba(231,76,60,0.04)' }}>
              Total
            </td>
            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', background: 'rgba(231,76,60,0.04)', whiteSpace: 'nowrap' }}>
              {formatCurrency(MONTH_KEYS.reduce((s, m) => s + (parseFloat(fromLine?.[m.key]) || 0), 0))}
            </td>
            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: totalTraslado > 0 ? 'var(--primary)' : 'var(--text-muted)', background: 'rgba(231,76,60,0.02)', borderRight: '2px solid rgba(0,0,0,0.07)', whiteSpace: 'nowrap' }}>
              {formatCurrency(totalTraslado)}
            </td>
            <td colSpan={2} style={{ background: rows.some(r => parseFloat(r.amount) > 0) ? 'rgba(39,174,96,0.04)' : 'transparent' }} />
            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#27AE60', background: rows.some(r => parseFloat(r.amount) > 0) ? 'rgba(39,174,96,0.08)' : 'transparent', whiteSpace: 'nowrap' }}>
              {toLine && totalTraslado > 0
                ? formatCurrency(
                    MONTH_KEYS.reduce((s, m, i) => {
                      const r   = rows[i] ?? { toMonth: m.key, amount: 0 };
                      const amt = parseFloat(r.amount) || 0;
                      return s + (parseFloat(toLine?.[r.toMonth]) || 0) + amt;
                    }, 0) -
                    // restar las bases ya contadas de los meses destino que tienen traslado
                    MONTH_KEYS.reduce((s, m, i) => {
                      const r   = rows[i] ?? { toMonth: m.key, amount: 0 };
                      const amt = parseFloat(r.amount) || 0;
                      if (amt <= 0) return s;
                      return s + (parseFloat(toLine?.[r.toMonth]) || 0);
                    }, 0)
                  )
                : '—'}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Vista previa del impacto */}
      {rows.some(r => parseFloat(r.amount) > 0) && (
        <ImpactPreview fromLine={fromLine} toLine={toLine} rows={MONTH_KEYS.map((m, i) => {
          const r = rows[i] ?? { toMonth: m.key, amount: 0 };
          return { fromMonth: m.key, toMonth: r.toMonth, amount: r.amount };
        })} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista previa del impacto (resumen por mes)
// ─────────────────────────────────────────────────────────────────────────────
function ImpactPreview({ fromLine, toLine, rows }) {
  // Calcular impacto acumulado por mes
  const impact = {};
  rows.forEach(r => {
    const amt = parseFloat(r.amount) || 0;
    if (amt <= 0) return;
    if (!impact[r.fromMonth]) impact[r.fromMonth] = { fromDelta: 0, toDelta: 0 };
    if (!impact[r.toMonth])   impact[r.toMonth]   = { fromDelta: 0, toDelta: 0 };
    impact[r.fromMonth].fromDelta -= amt;
    impact[r.toMonth].toDelta     += amt;
  });

  const affectedMonths = MONTH_KEYS.filter(m => impact[m.key]);
  if (affectedMonths.length === 0) return null;

  return (
    <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Vista previa del impacto por mes
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: 500 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
              <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Mes</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', color: '#E74C3C', fontWeight: 600 }}>Origen actual</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', color: '#E74C3C', fontWeight: 600 }}>Δ Origen</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', color: '#E74C3C', fontWeight: 700 }}>Nuevo origen</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', color: '#27AE60', fontWeight: 600 }}>Destino actual</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', color: '#27AE60', fontWeight: 600 }}>Δ Destino</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', color: '#27AE60', fontWeight: 700 }}>Nuevo destino</th>
            </tr>
          </thead>
          <tbody>
            {affectedMonths.map((m, i) => {
              const imp = impact[m.key] || { fromDelta: 0, toDelta: 0 };
              const actualFrom = parseFloat(fromLine?.[m.key]) || 0;
              const actualTo   = parseFloat(toLine?.[m.key])   || 0;
              const newFrom = actualFrom + imp.fromDelta;
              const newTo   = actualTo   + imp.toDelta;
              return (
                <tr key={m.key} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                  <td style={{ padding: '3px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(actualFrom)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: imp.fromDelta < 0 ? '#E74C3C' : 'var(--text-muted)', fontWeight: imp.fromDelta !== 0 ? 700 : 400 }}>
                    {imp.fromDelta !== 0 ? (imp.fromDelta > 0 ? `+${formatCurrency(imp.fromDelta)}` : `−${formatCurrency(-imp.fromDelta)}`) : '—'}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 700, color: newFrom < 0 ? '#E74C3C' : 'var(--text-primary)' }}>{formatCurrency(newFrom)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(actualTo)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: imp.toDelta > 0 ? '#27AE60' : 'var(--text-muted)', fontWeight: imp.toDelta !== 0 ? 700 : 400 }}>
                    {imp.toDelta !== 0 ? `+${formatCurrency(imp.toDelta)}` : '—'}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 700, color: imp.toDelta > 0 ? '#27AE60' : 'var(--text-primary)' }}>{formatCurrency(newTo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista de detalle de un traslado aprobado/pendiente
// ─────────────────────────────────────────────────────────────────────────────
function TransferDetailTable({ transfer }) {
  const amounts = transfer.amounts || {};
  if (Array.isArray(amounts.rows)) {
    // Formato cross-mes
    const validRows = amounts.rows.filter(r => parseFloat(r.amount) > 0);
    if (validRows.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin detalle</div>;
    const total = validRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', maxWidth: 420, borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1.5px solid var(--border)' }}>
              <th style={{ padding: '5px 8px', color: '#E74C3C', fontWeight: 600 }}>Mes origen</th>
              <th style={{ padding: '5px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>→</th>
              <th style={{ padding: '5px 8px', color: '#27AE60', fontWeight: 600 }}>Mes destino</th>
              <th style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {validRows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>{MONTH_MAP[r.fromMonth] || r.fromMonth}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>→</td>
                <td style={{ padding: '4px 8px', fontWeight: 600 }}>{MONTH_MAP[r.toMonth] || r.toMonth}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(parseFloat(r.amount))}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td colSpan={3} style={{ padding: '5px 8px', fontWeight: 700 }}>Total</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Formato legado (mismo mes)
  const legacyRows = MONTH_KEYS.map(m => ({ label: m.label, key: m.key, amt: parseFloat(amounts[m.key]) || 0 })).filter(r => r.amt > 0);
  if (legacyRows.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin detalle mensual</div>;
  const total = legacyRows.reduce((s, r) => s + r.amt, 0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', maxWidth: 320, borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr style={{ background: 'var(--bg)', borderBottom: '1.5px solid var(--border)' }}>
            <th style={{ padding: '5px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Mes</th>
            <th style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>Monto</th>
          </tr>
        </thead>
        <tbody>
          {legacyRows.map((r, i) => (
            <tr key={r.key} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
              <td style={{ padding: '4px 8px', fontWeight: 500 }}>{r.label}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(r.amt)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid var(--border)' }}>
            <td style={{ padding: '5px 8px', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial de 12 filas fijas: una por mes. el fromMonth se deduce del índice (MONTH_KEYS[i].key).
const INIT_ROWS = () => MONTH_KEYS.map(m => ({ toMonth: m.key, amount: 0 }));

export default function BudgetTransfers({ budgetLines = [], onTransferComplete }) {
  const [transfers, setTransfers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [fromId, setFromId]   = useState('');
  const [toId, setToId]       = useState('');
  const [rows, setRows]       = useState(INIT_ROWS());
  const [motivo, setMotivo]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pinAction, setPinAction] = useState(null);
  const [showPin, setShowPin]     = useState(false);
  const [filterEstado, setFilterEstado] = useState('all');

  const notify = (msg, type = 'success') => {
    if (type === 'error') setError(msg);
    else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4500);
  };

  const loadTransfers = async () => {
    try { const data = await listTransfers(); setTransfers(data); }
    catch (e) { notify(e.message, 'error'); }
    finally   { setLoading(false); }
  };
  useEffect(() => { loadTransfers(); }, []);

  const activeLines = useMemo(() => budgetLines.filter(l => l.estado !== 'eliminada'), [budgetLines]);
  const fromLine    = useMemo(() => activeLines.find(l => l.id_linea === fromId) || null, [activeLines, fromId]);
  const toLine      = useMemo(() => activeLines.find(l => l.id_linea === toId)   || null, [activeLines, toId]);
  const totalTraslado = useMemo(() => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0), [rows]);

  const handleFromChange = (id) => { setFromId(id); setRows(INIT_ROWS()); };

  const handleRowChange = (idx, field, val) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromId || !toId)   { notify('Selecciona línea origen y destino', 'error'); return; }
    if (fromId === toId)    { notify('Origen y destino deben ser diferentes', 'error'); return; }
    if (totalTraslado <= 0) { notify('Ingresa al menos un monto mayor a cero', 'error'); return; }

    // Validar excesos por mes origen. Cada fila i corresponde a MONTH_KEYS[i].
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const fromMonth = MONTH_KEYS[i].key;
      const amt       = parseFloat(rows[i]?.amount) || 0;
      if (amt <= 0) continue;
      const available = parseFloat(fromLine?.[fromMonth]) || 0;
      if (amt > available) {
        notify(`${MONTH_KEYS[i].label}: el traslado (${formatCurrency(amt)}) supera el P. Actual origen (${formatCurrency(available)})`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Serializar: cada fila i → fromMonth = MONTH_KEYS[i].key, toMonth = rows[i].toMonth
      const serializedRows = rows
        .map((r, i) => ({ fromMonth: MONTH_KEYS[i].key, toMonth: r.toMonth, amount: r.amount }))
        .filter(r => parseFloat(r.amount) > 0);
      const amounts = { rows: serializedRows };
      await createTransfer(fromId, toId, amounts, motivo);
      notify('Traslado solicitado correctamente. Queda pendiente de aprobación.');
      setShowForm(false); setFromId(''); setToId(''); setRows(INIT_ROWS()); setMotivo('');
      await loadTransfers();
      if (onTransferComplete) onTransferComplete();
    } catch (e) { notify(e.message, 'error'); }
    finally     { setSubmitting(false); }
  };

  const handleApproveClick = (id) => { setPinAction({ type: 'approve', transferId: id }); setShowPin(true); };
  const handleRejectClick  = (id) => { setPinAction({ type: 'reject',  transferId: id }); setShowPin(true); };

  const handlePinUnlock = async (ok) => {
    setShowPin(false);
    if (!ok || !pinAction) return;
    try {
      if (pinAction.type === 'approve') { await approveTransfer(pinAction.transferId); notify('Traslado aprobado y aplicado al P. Actual.'); }
      else                              { await rejectTransfer(pinAction.transferId, 'Rechazado manualmente'); notify('Traslado rechazado.'); }
      await loadTransfers();
      if (onTransferComplete) onTransferComplete();
    } catch (e) { notify(e.message, 'error'); }
    finally     { setPinAction(null); }
  };

  const filteredTransfers = filterEstado === 'all' ? transfers : transfers.filter(t => t.estado === filterEstado);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      {showPin && <MasterPinUnlock onUnlock={handlePinUnlock} onClose={() => { setShowPin(false); setPinAction(null); }} />}

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <ArrowLeftRight style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            Traslados de Presupuesto
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, marginLeft: 32 }}>
            Los traslados operan sobre el P. Actual. El P. Inicial no se modifica. Puedes mapear meses distintos entre origen y destino.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          <Plus style={{ width: 14, height: 14 }} /> Nuevo Traslado
        </button>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}><AlertTriangle style={{ width: 14, height: 14 }} /> {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}><Check style={{ width: 14, height: 14 }} /> {success}</div>}

      {/* ── Formulario ── */}
      {showForm && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-card-title">Solicitar Traslado</div>
          <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
            {/* Selectores buscables */}
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label"><span style={{ color: '#E74C3C' }}>📤</span> Línea origen</label>
                <SearchableLineSelect lines={activeLines} value={fromId} onChange={handleFromChange} excludeId={toId} placeholder="Buscar por #, nombre o área..." />
                {fromLine && <div style={{ marginTop: 5, fontSize: '0.73rem', color: 'var(--text-muted)' }}>Total P. Actual: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(fromLine.total)}</strong> · {fromLine.area}</div>}
              </div>
              <div className="form-group">
                <label className="form-label"><span style={{ color: '#27AE60' }}>📥</span> Línea destino</label>
                <SearchableLineSelect lines={activeLines} value={toId} onChange={setToId} excludeId={fromId} placeholder="Buscar por #, nombre o área..." />
                {toLine && <div style={{ marginTop: 5, fontSize: '0.73rem', color: 'var(--text-muted)' }}>Total P. Actual: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(toLine.total)}</strong> · {toLine.area}</div>}
              </div>
            </div>

            {/* Tabla cross-mes */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Mapeo de meses y montos</label>
              {fromId ? (
                <CrossMonthTable fromLine={fromLine} toLine={toLine} rows={rows} onRowChange={handleRowChange} />
              ) : (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: 'var(--bg)', borderRadius: 8, border: '1.5px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Selecciona primero la línea origen para configurar el traslado
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Motivo / Justificación</label>
              <textarea className="form-input" value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Describe el motivo del traslado..." style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || totalTraslado <= 0}>
                {submitting ? 'Solicitando...' : `Solicitar traslado${totalTraslado > 0 ? ` de ${formatCurrency(totalTraslado)}` : ''}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'Todos'], ['pendiente', 'Pendientes'], ['aprobado', 'Aprobados'], ['rechazado', 'Rechazados']].map(([val, lab]) => (
          <button key={val} className={`btn btn-sm ${filterEstado === val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilterEstado(val)}>
            {lab} {val !== 'all' && <span style={{ opacity: 0.7, marginLeft: 4 }}>({transfers.filter(t => t.estado === val).length})</span>}
          </button>
        ))}
      </div>

      {/* ── Lista de traslados ── */}
      {filteredTransfers.length === 0 ? (
        <div className="chart-card" style={{ textAlign: 'center', padding: 48 }}>
          <ArrowLeftRight style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            No hay traslados{filterEstado !== 'all' ? ` en estado "${filterEstado}"` : ''}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTransfers.map(t => {
            const status = STATUS_LABELS[t.estado] || STATUS_LABELS.pendiente;
            const isExpanded = expandedId === t.id;
            const amts = t.amounts || {};
            const totalAmount = Array.isArray(amts.rows)
              ? amts.rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
              : Object.values(amts).reduce((s, v) => s + (parseFloat(v) || 0), 0);

            return (
              <div key={t.id} className="chart-card" style={{ padding: '14px 18px', border: `1.5px solid ${isExpanded ? status.border : 'var(--border)'}`, transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : t.id)}>
                  <div style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, color: status.color, background: status.bg, flexShrink: 0 }}>
                    {status.label}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.fromLine?.nombre ?? '—'} → {t.toLine?.nombre ?? '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {t.fromLine?.area} → {t.toLine?.area} &nbsp;•&nbsp; {new Date(t.created_at).toLocaleDateString('es-CO')} &nbsp;•&nbsp; Total: <strong>{formatCurrency(totalAmount)}</strong>
                    </div>
                  </div>
                  {t.estado === 'pendiente' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-success btn-sm" onClick={e => { e.stopPropagation(); handleApproveClick(t.id); }}>
                        <Lock style={{ width: 11, height: 11 }} /><Check style={{ width: 11, height: 11 }} /> Aprobar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleRejectClick(t.id); }}>
                        <X style={{ width: 11, height: 11 }} /> Rechazar
                      </button>
                    </div>
                  )}
                  {isExpanded ? <ChevronUp style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronDown style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />}
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
                    <TransferDetailTable transfer={t} />
                    {t.motivo && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 12, fontStyle: 'italic' }}>
                        <strong>Motivo:</strong> {t.motivo}
                      </div>
                    )}
                    {t.approved_at && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                        <Clock style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                        {t.estado === 'aprobado' ? 'Aprobado' : 'Procesado'} el {new Date(t.approved_at).toLocaleDateString('es-CO')}
                        {t.approved_by && ` por ${t.approved_by}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
