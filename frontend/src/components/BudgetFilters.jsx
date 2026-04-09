import { Search, X, DollarSign } from 'lucide-react';
import MultiSelect from './MultiSelect';
import ICGIToggle from './ICGIToggle';

export default function BudgetFilters({ filters, filterOptions, onFilterChange }) {
  const handleTextChange = (e) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const clearFilters = () => {
    onFilterChange({ escenario: [1] }); // Reset to default scenario
  };

  // Activa/desactiva el filtro rápido "CGI sin Salarios"
  const toggleSinSalarios = () => {
    const active = filters.excludeSalarios === true || filters.excludeSalarios === 'true';
    if (active) {
      // eslint-disable-next-line no-unused-vars
      const { excludeSalarios, ...rest } = filters;
      onFilterChange(rest);
    } else {
      onFilterChange({ ...filters, excludeSalarios: true });
    }
  };

  const sinSalariosActive = filters.excludeSalarios === true || filters.excludeSalarios === 'true';

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'escenario' && Array.isArray(value) && value.length === 1 && value[0] === 1) return false;
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });

  return (
    <div className="filters-bar" style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }}>
      {/* Search Input */}
      <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="filter-input"
          placeholder="Buscar por nombre, cuenta, ID..."
          value={filters.search || ''}
          onChange={handleTextChange}
          style={{ paddingLeft: 36, width: '100%', minWidth: 'auto' }}
        />
        {(filters.search) && (
          <X
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)', cursor: 'pointer' }}
            onClick={() => onFilterChange({ ...filters, search: '' })}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <MultiSelect
          id="global-filter-area"
          label="Área"
          options={filterOptions?.areas || []}
          value={Array.isArray(filters.area) ? filters.area : (filters.area ? filters.area.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, area: val })}
          placeholder="Todas"
        />

        <MultiSelect
          id="global-filter-linea"
          label="Línea"
          options={filterOptions?.lineas || []}
          value={Array.isArray(filters.linea) ? filters.linea : (filters.linea ? filters.linea.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, linea: val })}
          placeholder="Todas"
        />

        <MultiSelect
          id="global-filter-escenario"
          label="Escenario"
          options={filterOptions?.escenarios || []}
          value={Array.isArray(filters.escenario) ? filters.escenario : (filters.escenario ? filters.escenario.split(',').map(Number) : [])}
          onChange={(val) => onFilterChange({ ...filters, escenario: val })}
          placeholder="Todos"
        />

        <ICGIToggle
          options={filterOptions?.tipos || []}
          value={Array.isArray(filters.icgi) ? filters.icgi : (filters.icgi ? filters.icgi.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, icgi: val })}
        />

        <MultiSelect
          id="global-filter-cuenta-contable"
          label="Cuenta"
          options={filterOptions?.cuentasContables || []}
          value={Array.isArray(filters.cuentaContable) ? filters.cuentaContable : (filters.cuentaContable ? filters.cuentaContable.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, cuentaContable: val })}
          placeholder="Todas"
        />

        {/* Botón filtro rápido: CGI sin Salarios */}
        <button
          id="btn-filter-sin-salarios"
          className={`btn btn-sm ${sinSalariosActive ? 'btn-primary' : 'btn-outline'}`}
          onClick={toggleSinSalarios}
          title="Muestra costos, gastos fijos e inversiones excluyendo cuentas de salarios"
          style={{ gap: 5, fontWeight: sinSalariosActive ? 700 : 500 }}
        >
          <DollarSign style={{ width: 13, height: 13 }} />
          CGI sin Salarios
        </button>

        {hasActiveFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearFilters}
            style={{ color: 'var(--danger)', fontWeight: 600 }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
