import { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, Trash2, RotateCcw, Plus, ChevronLeft, ChevronRight, Eye, EyeOff, ChevronUp, ChevronDown, Columns } from 'lucide-react';
import { formatCurrencyFull, formatPercentage } from '../utils/formatters';

// ──────────────────────────────────────────────
// Columnas disponibles con sus configuraciones
// ──────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'idConsecutivo', label: 'ID',          width: 70,  align: 'left',  sortable: true },
  { key: 'nombreElemento', label: 'Nombre',     width: 220, align: 'left',  sortable: true },
  { key: 'area',           label: 'Área',       width: 120, align: 'left',  sortable: true },
  { key: 'linea',          label: 'Línea',      width: 110, align: 'left',  sortable: true },
  { key: 'escenario',      label: 'Esc.',       width: 60,  align: 'center',sortable: true },
  { key: 'icgi',           label: 'ICGI',       width: 90,  align: 'left',  sortable: true },
  { key: 'total',          label: 'Total Ppto.',width: 140, align: 'right', sortable: true },
  { key: 'ejecutadoAcumulado', label: 'Ejecutado', width: 130, align: 'right', sortable: true },
  { key: '_pct',           label: '% Ejec.',   width: 110, align: 'left',  sortable: true },
  { key: '_saldo',         label: 'Saldo',     width: 130, align: 'right', sortable: true },
];
const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key);
const LS_VISIBLE = 'budgetTable_visibleCols';
const LS_WIDTHS  = 'budgetTable_colWidths';
const LS_PER_PAGE = 'budgetTable_itemsPerPage';

const MONTH_LABELS = {
  enero: 'Enero', febrero: 'Febrero', marzo: 'Marzo', abril: 'Abril',
  mayo: 'Mayo', junio: 'Junio', julio: 'Julio', agosto: 'Agosto',
  septiembre: 'Septiembre', octubre: 'Octubre', noviembre: 'Noviembre', diciembre: 'Diciembre'
};

// ──────────────────────────────────────────────
// Helpers para ordenamiento
// ──────────────────────────────────────────────
function getSortValue(line, key) {
  if (key === '_pct') return line.total > 0 ? (line.ejecutadoAcumulado / line.total) * 100 : 0;
  if (key === '_saldo') return line.total - line.ejecutadoAcumulado;
  const v = line[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v.toLowerCase();
  return 0;
}

function sortLines(arr, sortKey, sortDir) {
  if (!sortKey) return arr;
  return [...arr].sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ──────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────
export default function BudgetTable({ lines, filters, onEdit, onDelete, onCreate, onRestore, showDeleted, onToggleShowDeleted }) {
  // ── Paginación persistente ──
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() =>
    parseInt(localStorage.getItem(LS_PER_PAGE) || '10')
  );

  // ── Ordenamiento: por defecto, ID ascendente ──
  const [sortKey, setSortKey] = useState('idConsecutivo');
  const [sortDir, setSortDir] = useState('asc');

  // ── Columnas visibles ──
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_VISIBLE);
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch { return DEFAULT_VISIBLE; }
  });

  // ── Anchos de columna (resize) ──
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_WIDTHS);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.width]));
  });

  // ── Panel de columnas visible/oculto ──
  const [showColPanel, setShowColPanel] = useState(false);
  const colPanelRef = useRef(null);

  // Cerrar panel al hacer click afuera
  useEffect(() => {
    const handler = (e) => {
      if (colPanelRef.current && !colPanelRef.current.contains(e.target)) {
        setShowColPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Persistir preferencias en localStorage
  useEffect(() => {
    localStorage.setItem(LS_VISIBLE, JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    localStorage.setItem(LS_WIDTHS, JSON.stringify(colWidths));
  }, [colWidths]);

  useEffect(() => {
    localStorage.setItem(LS_PER_PAGE, String(itemsPerPage));
  }, [itemsPerPage]);

  // Resetear a página 1 cuando cambian los datos, el ordenamiento o el tamaño
  useEffect(() => {
    const total = Math.ceil(lines.length / itemsPerPage) || 1;
    if (currentPage > total) setCurrentPage(1);
  }, [lines, itemsPerPage, sortKey, sortDir, currentPage]);

  // ── Ordenamiento por clic en cabecera ──
  const handleSort = useCallback((key) => {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (!col?.sortable) return;
    setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortKey(key);
    setCurrentPage(1);
  }, [sortKey]);

  // ── Resize de columnas con drag ──
  const resizeState = useRef({ col: null, startX: 0, startW: 0 });

  const onResizeMouseDown = useCallback((e, colKey) => {
    e.preventDefault();
    resizeState.current = { col: colKey, startX: e.clientX, startW: colWidths[colKey] || 120 };
    const onMove = (mv) => {
      const delta = mv.clientX - resizeState.current.startX;
      const newW = Math.max(60, resizeState.current.startW + delta);
      setColWidths(prev => ({ ...prev, [resizeState.current.col]: newW }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

  // ── Computar líneas a mostrar ──
  const activeMes = filters?.mes;
  let processedLines = lines;

  // Si hay filtro de mes activo, ordenar por ese mes primero
  if (activeMes && MONTH_LABELS[activeMes]) {
    processedLines = [...lines].sort((a, b) => (b[activeMes] || 0) - (a[activeMes] || 0));
  } else {
    processedLines = sortLines(lines, sortKey, sortDir);
  }

  const totalPages = Math.ceil(processedLines.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLines = processedLines.slice(startIndex, startIndex + itemsPerPage);

  const activeCount = lines.filter(l => l.estado !== 'eliminada').length;
  const deletedCount = lines.filter(l => l.estado === 'eliminada').length;

  // ── Columnas actualmente visibles (intersección manteniendo orden) ──
  const displayCols = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));

  // ── Renderizado de cabecera con sort y resize ──
  const renderTh = (col) => {
    const isActive = sortKey === col.key && !activeMes;
    return (
      <th
        key={col.key}
        style={{
          width: colWidths[col.key] || col.width,
          minWidth: 60,
          textAlign: col.align,
          position: 'relative',
          userSelect: 'none',
          cursor: col.sortable ? 'pointer' : 'default',
          background: isActive ? 'rgba(26,139,141,0.08)' : undefined,
          whiteSpace: 'nowrap',
        }}
        onClick={() => col.sortable && handleSort(col.key)}
        title={col.sortable ? `Ordenar por ${col.label}` : col.label}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {col.label}
          {col.sortable && (
            <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 0, opacity: isActive ? 1 : 0.3 }}>
              {isActive && sortDir === 'asc'
                ? <ChevronUp style={{ width: 11, height: 11 }} />
                : isActive && sortDir === 'desc'
                  ? <ChevronDown style={{ width: 11, height: 11 }} />
                  : <ChevronUp style={{ width: 11, height: 11 }} />}
            </span>
          )}
        </span>
        {/* Drag handle de resize */}
        <span
          onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, col.key); }}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: 6, cursor: 'col-resize', zIndex: 2,
            background: 'transparent',
          }}
          title="Arrastrar para redimensionar"
        />
      </th>
    );
  };

  // ── Cell renderers por columna ──
  const renderCell = (col, line) => {
    const isDeleted = line.estado === 'eliminada';
    const pct = line.total > 0 ? (line.ejecutadoAcumulado / line.total) * 100 : 0;
    const diff = line.total - line.ejecutadoAcumulado;
    const barColor = pct > 100 ? 'red' : pct > 75 ? 'yellow' : pct > 0 ? 'teal' : 'green';

    switch (col.key) {
      case 'idConsecutivo':
        return (
          <td key={col.key} style={{ fontWeight: 600, color: isDeleted ? 'var(--text-muted)' : 'var(--text-secondary)', width: colWidths[col.key] }}>
            <span style={{ textDecoration: isDeleted ? 'line-through' : 'none' }}>#{line.idConsecutivo}</span>
          </td>
        );
      case 'nombreElemento':
        return (
          <td key={col.key} style={{ maxWidth: colWidths[col.key] || 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={line.nombreElemento}>
            <span style={{ textDecoration: isDeleted ? 'line-through' : 'none', color: isDeleted ? 'var(--text-muted)' : undefined }}>
              {line.nombreElemento}
            </span>
            {isDeleted && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(231,76,60,0.15)', color: '#E74C3C', padding: '1px 5px', borderRadius: 6, border: '1px solid rgba(231,76,60,0.3)' }}>ELIMINADA</span>
                {line.observaciones?.includes('[Motivo Eliminación:') && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--danger)', fontStyle: 'italic' }}>
                    {line.observaciones.match(/\[Motivo Eliminación:\s*(.*?)\]/)?.[1] || ''}
                  </span>
                )}
              </div>
            )}
          </td>
        );
      case 'area':
        return <td key={col.key}><span className="badge badge-primary">{line.area}</span></td>;
      case 'linea':
        return <td key={col.key}><span className="badge badge-teal">{line.linea}</span></td>;
      case 'escenario':
        return <td key={col.key} style={{ textAlign: 'center' }}>{line.escenario}</td>;
      case 'icgi':
        return (
          <td key={col.key}>
            <span className={`badge ${line.icgi === 'Gasto' ? 'badge-danger' : line.icgi === 'Costo' ? 'badge-warning' : line.icgi === 'Inversión' ? 'badge-primary' : 'badge-success'}`}>
              {line.icgi}
            </span>
          </td>
        );
      case 'total':
        return <td key={col.key} className="amount-cell">{formatCurrencyFull(line.total)}</td>;
      case 'ejecutadoAcumulado':
        return <td key={col.key} className="amount-cell">{formatCurrencyFull(line.ejecutadoAcumulado)}</td>;
      case '_pct':
        return (
          <td key={col.key}>
            {!isDeleted ? (
              <div className="progress-bar-wrapper">
                <div className="progress-bar">
                  <div className={`progress-bar-fill ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <span className="progress-text">{formatPercentage(pct, 0)}</span>
              </div>
            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
          </td>
        );
      case '_saldo':
        return (
          <td key={col.key} className={`amount-cell ${!isDeleted ? (diff >= 0 ? 'amount-positive' : 'amount-negative') : ''}`}>
            {!isDeleted ? formatCurrencyFull(diff) : '—'}
          </td>
        );
      default:
        return <td key={col.key}>—</td>;
    }
  };

  return (
    <div className="table-card">
      <div className="table-header">
        <div className="table-title">
          Detalle del Presupuesto
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 8 }}>
            ({activeCount} activas{deletedCount > 0 ? `, ${deletedCount} eliminadas` : ''})
          </span>
        </div>
        <div className="table-actions">
          {/* Toggle eliminadas */}
          <button
            className={`btn btn-sm ${showDeleted ? 'btn-warning' : 'btn-outline'}`}
            onClick={onToggleShowDeleted}
            title={showDeleted ? 'Ocultar líneas eliminadas' : 'Mostrar líneas eliminadas'}
            style={{ gap: 6 }}
          >
            {showDeleted
              ? <><EyeOff style={{ width: 14, height: 14 }} /> Ocultar eliminadas</>
              : <><Eye style={{ width: 14, height: 14 }} /> Mostrar eliminadas {deletedCount > 0 ? `(${deletedCount})` : ''}</>}
          </button>

          {/* Selector de columnas */}
          <div style={{ position: 'relative' }} ref={colPanelRef}>
            <button
              className={`btn btn-sm btn-outline`}
              onClick={() => setShowColPanel(v => !v)}
              title="Seleccionar columnas visibles"
              style={{ gap: 5 }}
              id="btn-toggle-columns"
            >
              <Columns style={{ width: 14, height: 14 }} />
              Columnas
            </button>
            {showColPanel && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 999,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>COLUMNAS VISIBLES</div>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(col.key)}
                      onChange={(e) => {
                        setVisibleCols(prev =>
                          e.target.checked
                            ? [...prev, col.key]
                            : prev.filter(k => k !== col.key)
                        );
                      }}
                    />
                    {col.label}
                  </label>
                ))}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setVisibleCols(DEFAULT_VISIBLE)}
                  style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}
                >
                  Restablecer predeterminadas
                </button>
              </div>
            )}
          </div>

          <button className="btn btn-primary" onClick={onCreate} id="btn-create-line">
            <Plus /> Nueva Línea
          </button>
        </div>
      </div>

      {/* Chip mes activo */}
      {activeMes && MONTH_LABELS[activeMes] && (
        <div style={{ padding: '8px 20px', background: 'rgba(26,139,141,0.06)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filtrando por mes:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: '#1A8B8D', color: '#fff', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600 }}>
            {MONTH_LABELS[activeMes]}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(ordenado por monto de {MONTH_LABELS[activeMes]})</span>
        </div>
      )}

      {/* Tabla */}
      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            {displayCols.map(col => (
              <col key={col.key} style={{ width: colWidths[col.key] || col.width }} />
            ))}
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr>
              {displayCols.map(col => renderTh(col))}
              <th style={{ textAlign: 'center', width: 80 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={displayCols.length + 1} className="empty-state">
                  No se encontraron líneas de presupuesto
                </td>
              </tr>
            ) : (
              currentLines.map((line) => {
                const isDeleted = line.estado === 'eliminada';
                return (
                  <tr
                    key={line.id_linea}
                    style={{
                      opacity: isDeleted ? 0.55 : 1,
                      background: isDeleted ? 'rgba(231,76,60,0.04)' : undefined,
                    }}
                  >
                    {displayCols.map(col => renderCell(col, line))}
                    <td style={{ textAlign: 'center', width: 80 }}>
                      {isDeleted ? (
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => onRestore && onRestore(line)}
                          title="Restaurar línea"
                          style={{ color: 'var(--success)' }}
                        >
                          <RotateCcw style={{ width: 14, height: 14 }} />
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(line)} title="Editar">
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => onDelete(line)}
                            title="Eliminar (lógico)"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Líneas por página:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.85rem', background: 'var(--bg)' }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Mostrando {lines.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, lines.length)} de {lines.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-ghost btn-icon btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" disabled={currentPage === totalPages || lines.length === 0} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
