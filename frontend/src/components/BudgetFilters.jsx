import { useMemo } from 'react';
import { Search, X, DollarSign } from 'lucide-react';
import MultiSelect from './MultiSelect';
import ICGIToggle from './ICGIToggle';

/**
 * Determina si una cuenta contable pertenece a las categorías excluidas por "CGI sin Salarios".
 * Replica la lógica del backend (BudgetService.js L209-228) en el frontend para sincronizar
 * el MultiSelect de cuentas con el toggle.
 */
function isCuentaExcludedByCGI(cuentaContable, cuenta) {
  const isIngreso = (cuenta || '').startsWith('01');
  const cc = (cuentaContable || '').toLowerCase();
  const isSalary = cc.includes('salario') || cc.includes('sueldo');
  const isExtra = cc.includes('comision') || cc.includes('bonificacion')
    || cc.includes('industria y comercio') || cc.includes('compra implemento');
  return isIngreso || isSalary || isExtra;
}

export default function BudgetFilters({ filters, filterOptions, onFilterChange, budgetLines = [] }) {
  const handleTextChange = (e) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const clearFilters = () => {
    onFilterChange({ escenario: [1] }); // Reset to default scenario
  };

  /**
   * Mapa de cuentaContable → cuenta (código numérico) derivado de las líneas activas.
   * Se usa para replicar en frontend la misma lógica de exclusión del backend.
   */
  const cuentaMap = useMemo(() => {
    const map = {};
    budgetLines.forEach(l => {
      if (l.cuentaContable) map[l.cuentaContable] = l.cuenta || '';
    });
    return map;
  }, [budgetLines]);

  // Activa/desactiva el filtro rápido "CGI sin Salarios"
  const toggleSinSalarios = () => {
    const active = filters.excludeSalarios === true || filters.excludeSalarios === 'true';
    if (active) {
      // Desactivar: quitar tanto excludeSalarios como la selección de cuentas derivada
      // eslint-disable-next-line no-unused-vars
      const { excludeSalarios, cuentaContable, ...rest } = filters;
      onFilterChange(rest);
    } else {
      // Activar: calcular las cuentas que NO son excluidas y setearlas en el filtro
      const allCuentas = filterOptions?.cuentasContables || [];
      const cuentasFiltradas = allCuentas.filter(
        cc => !isCuentaExcludedByCGI(cc, cuentaMap[cc])
      );
      onFilterChange({ ...filters, excludeSalarios: true, cuentaContable: cuentasFiltradas });
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
