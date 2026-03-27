import { useState, useEffect } from 'react';
import { Pencil, Trash2, RotateCcw, Plus, ChevronLeft, ChevronRight, X, Eye, EyeOff } from 'lucide-react';
import { formatCurrencyFull, formatPercentage } from '../utils/formatters';

export default function BudgetTable({ lines, filters, onEdit, onDelete, onCreate, onRestore, showDeleted, onToggleShowDeleted }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const MONTH_LABELS = {
    enero: 'Enero', febrero: 'Febrero', marzo: 'Marzo', abril: 'Abril',
    mayo: 'Mayo', junio: 'Junio', julio: 'Julio', agosto: 'Agosto',
    septiembre: 'Septiembre', octubre: 'Octubre', noviembre: 'Noviembre', diciembre: 'Diciembre'
  };

  useEffect(() => {
    const totalPages = Math.ceil(lines.length / itemsPerPage) || 1;
    if (currentPage > totalPages) setCurrentPage(1);
  }, [lines, itemsPerPage, currentPage]);

  const totalPages = Math.ceil(lines.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const activeMes = filters?.mes;
  const sortedLines = activeMes && MONTH_LABELS[activeMes]
    ? [...lines].sort((a, b) => (b[activeMes] || 0) - (a[activeMes] || 0))
    : lines;
  const currentLines = sortedLines.slice(startIndex, startIndex + itemsPerPage);

  const activeCount = lines.filter(l => l.estado !== 'eliminada').length;
  const deletedCount = lines.filter(l => l.estado === 'eliminada').length;

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
          {/* Toggle para mostrar líneas eliminadas */}
          {/* Toggle para mostrar líneas eliminadas siempre visible */}
          <button
            className={`btn btn-sm ${showDeleted ? 'btn-warning' : 'btn-outline'}`}
            onClick={onToggleShowDeleted}
            title={showDeleted ? 'Ocultar líneas eliminadas' : 'Mostrar líneas eliminadas'}
            style={{ gap: 6 }}
          >
            {showDeleted ? (
              <><EyeOff style={{ width: 14, height: 14 }} /> Ocultar eliminadas</>
            ) : (
              <><Eye style={{ width: 14, height: 14 }} /> Mostrar eliminadas {deletedCount > 0 ? `(${deletedCount})` : ''}</>
            )}
          </button>
          <button className="btn btn-primary" onClick={onCreate} id="btn-create-line">
            <Plus /> Nueva Línea
          </button>
        </div>
      </div>

      {/* Chip de mes activo */}
      {activeMes && MONTH_LABELS[activeMes] && (
        <div style={{ padding: '8px 20px', background: 'rgba(26, 139, 141, 0.06)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filtrando por mes:</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
            background: '#1A8B8D', color: '#fff', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600
          }}>
            {MONTH_LABELS[activeMes]}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(ordenado por monto de {MONTH_LABELS[activeMes]})</span>
        </div>
      )}

      {/* Tabla */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Nombre del Elemento</th>
              <th>Área</th>
              <th>Línea</th>
              <th>Esc.</th>
              <th>ICGI</th>
              <th style={{ textAlign: 'right' }}>Total Ppto.</th>
              <th style={{ textAlign: 'right' }}>Ejecutado</th>
              <th>% Ejec.</th>
              <th style={{ textAlign: 'right' }}>Saldo</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty-state">
                  No se encontraron líneas de presupuesto
                </td>
              </tr>
            ) : (
              currentLines.map((line) => {
                const isDeleted = line.estado === 'eliminada';
                const pct = line.total > 0 ? (line.ejecutadoAcumulado / line.total) * 100 : 0;
                const diff = line.total - line.ejecutadoAcumulado;
                const barColor = pct > 100 ? 'red' : pct > 75 ? 'yellow' : pct > 0 ? 'teal' : 'green';

                return (
                  <tr
                    key={line.id_linea}
                    style={{
                      opacity: isDeleted ? 0.55 : 1,
                      background: isDeleted ? 'rgba(231, 76, 60, 0.04)' : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 600, color: isDeleted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                      <span style={{ textDecoration: isDeleted ? 'line-through' : 'none' }}>
                        #{line.idConsecutivo}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={line.nombreElemento}>
                      <span style={{ textDecoration: isDeleted ? 'line-through' : 'none', color: isDeleted ? 'var(--text-muted)' : undefined }}>
                        {line.nombreElemento}
                      </span>
                      {isDeleted && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div>
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 700,
                              background: 'rgba(231, 76, 60, 0.15)', color: '#E74C3C',
                              padding: '2px 6px', borderRadius: 6, border: '1px solid rgba(231, 76, 60, 0.3)'
                            }}>
                              ELIMINADA
                            </span>
                          </div>
                          {line.observaciones && line.observaciones.includes('[Motivo Eliminación:') && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontStyle: 'italic' }}>
                              <strong style={{ opacity: 0.8 }}>Motivo: </strong>
                              {line.observaciones.match(/\[Motivo Eliminación:\s*(.*?)\]/)?.[1] || 'Sin especificación'}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td><span className="badge badge-primary">{line.area}</span></td>
                    <td><span className="badge badge-teal">{line.linea}</span></td>
                    <td style={{ textAlign: 'center' }}>{line.escenario}</td>
                    <td>
                      <span className={`badge ${line.icgi === 'Gasto' ? 'badge-danger' : line.icgi === 'Costo' ? 'badge-warning' : line.icgi === 'Inversión' ? 'badge-primary' : 'badge-success'}`}>
                        {line.icgi}
                      </span>
                    </td>
                    <td className="amount-cell">{formatCurrencyFull(line.total)}</td>
                    <td className="amount-cell">{formatCurrencyFull(line.ejecutadoAcumulado)}</td>
                    <td>
                      {!isDeleted ? (
                        <div className="progress-bar-wrapper">
                          <div className="progress-bar">
                            <div className={`progress-bar-fill ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="progress-text">{formatPercentage(pct, 0)}</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                    </td>
                    <td className={`amount-cell ${!isDeleted ? (diff >= 0 ? 'amount-positive' : 'amount-negative') : ''}`}>
                      {!isDeleted ? formatCurrencyFull(diff) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
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

      {/* Pagination */}
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
