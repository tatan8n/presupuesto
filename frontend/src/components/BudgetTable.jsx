import { useState, useEffect } from 'react';
import { Pencil, Trash2, Eye, Search, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatCurrencyFull, formatPercentage } from '../utils/formatters';
import MultiSelect from './MultiSelect';
import ICGIToggle from './ICGIToggle';

export default function BudgetTable({ lines, filters, filterOptions, onFilterChange, onEdit, onDelete, onCreate }) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const MONTH_LABELS = {
    enero: 'Enero', febrero: 'Febrero', marzo: 'Marzo', abril: 'Abril',
    mayo: 'Mayo', junio: 'Junio', julio: 'Julio', agosto: 'Agosto',
    septiembre: 'Septiembre', octubre: 'Octubre', noviembre: 'Noviembre', diciembre: 'Diciembre'
  };

  // Reset to page 1 if items length drops below what the current page can show
  useEffect(() => {
    const totalPages = Math.ceil(lines.length / itemsPerPage) || 1;
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [lines, itemsPerPage, currentPage]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    onFilterChange({ ...filters, search: e.target.value });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(lines.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Sort by month amount if a month filter is active
  const activeMes = filters.mes;
  const sortedLines = activeMes && MONTH_LABELS[activeMes] 
    ? [...lines].sort((a, b) => (b[activeMes] || 0) - (a[activeMes] || 0))
    : lines;
  const currentLines = sortedLines.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="table-card">
      <div className="table-header">
        <div className="table-title">
          Detalle del Presupuesto
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 8 }}>
            ({lines.length} líneas)
          </span>
        </div>
        <div className="table-actions">
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="filter-input"
              placeholder="Buscar por nombre, cuenta..."
              value={search}
              onChange={handleSearch}
              style={{ paddingLeft: 32 }}
              id="search-budget"
            />
          </div>
          <button className="btn btn-primary" onClick={onCreate} id="btn-create-line">
            <Plus /> Nueva Línea
          </button>
        </div>
      </div>

      {/* Month filter chip */}
      {activeMes && MONTH_LABELS[activeMes] && (
        <div style={{ padding: '8px 20px', background: 'rgba(26, 139, 141, 0.06)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filtrando por mes:</span>
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
            background: '#1A8B8D', color: '#fff', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600 
          }}>
            {MONTH_LABELS[activeMes]}
            <X style={{ width: 12, height: 12, cursor: 'pointer' }} onClick={() => onFilterChange({ ...filters, mes: undefined })} />
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(ordenado por monto de {MONTH_LABELS[activeMes]})</span>
        </div>
      )}

      {/* Filtros */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <MultiSelect
          id="filter-area"
          label="Área"
          options={filterOptions?.areas || []}
          value={Array.isArray(filters.area) ? filters.area : (filters.area ? filters.area.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, area: val })}
          placeholder="Todas las Áreas"
        />

        <MultiSelect
          id="filter-linea"
          label="Línea"
          options={filterOptions?.lineas || []}
          value={Array.isArray(filters.linea) ? filters.linea : (filters.linea ? filters.linea.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, linea: val })}
          placeholder="Todas las Líneas"
        />

        <MultiSelect
          id="filter-escenario"
          label="Escenario"
          options={filterOptions?.escenarios || []}
          value={Array.isArray(filters.escenario) ? filters.escenario : (filters.escenario ? filters.escenario.split(',').map(Number) : [])}
          onChange={(val) => onFilterChange({ ...filters, escenario: val })}
          placeholder="Todos los Escenarios"
        />

        <ICGIToggle
          options={filterOptions?.tipos || []}
          value={Array.isArray(filters.icgi) ? filters.icgi : (filters.icgi ? filters.icgi.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, icgi: val })}
        />

        <MultiSelect
          id="filter-cuenta-contable"
          label="Cuenta Contable"
          options={filterOptions?.cuentasContables || []}
          value={Array.isArray(filters.cuentaContable) ? filters.cuentaContable : (filters.cuentaContable ? filters.cuentaContable.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, cuentaContable: val })}
          placeholder="Todas las Cuentas"
        />
      </div>

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
              <th style={{ textAlign: 'right' }}>Total Presupuesto</th>
              <th style={{ textAlign: 'right' }}>Ejecutado</th>
              <th>% Ejec.</th>
              <th style={{ textAlign: 'right' }}>Saldo</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty-state">
                  No se encontraron líneas de presupuesto
                </td>
              </tr>
            ) : (
              currentLines.map((line) => {
                const pct = line.total > 0 ? (line.ejecutadoAcumulado / line.total) * 100 : 0;
                const diff = line.total - line.ejecutadoAcumulado;
                const barColor = pct > 100 ? 'red' : pct > 75 ? 'yellow' : pct > 0 ? 'teal' : 'green';

                return (
                  <tr key={line.id_linea}>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      #{line.idConsecutivo}
                    </td>
                    <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }} title={line.nombreElemento}>
                      {line.nombreElemento}
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
                      <div className="progress-bar-wrapper">
                        <div className="progress-bar">
                          <div className={`progress-bar-fill ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="progress-text">{formatPercentage(pct, 0)}</span>
                      </div>
                    </td>
                    <td className={`amount-cell ${diff >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                      {formatCurrencyFull(diff)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(line)} title="Editar">
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDelete(line)} title="Eliminar" style={{ color: 'var(--danger)' }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Líneas por página:</span>
          <select 
            value={itemsPerPage} 
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
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
            Mostrando {lines.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + itemsPerPage, lines.length)} de {lines.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              disabled={currentPage === totalPages || lines.length === 0}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
