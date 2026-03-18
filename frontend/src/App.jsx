import { useState, useEffect, useCallback } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import KPICards from './components/KPICards';
import AreaBarChart from './components/AreaBarChart';
import MonthlyLineChart from './components/MonthlyLineChart';
import LineaICGIChart from './components/LineaICGIChart';
import EERRSummary from './components/EERRSummary';
import BudgetTable from './components/BudgetTable';
import BudgetForm from './components/BudgetForm';
import FileUpload from './components/FileUpload';
import WeeklyFlowChart from './components/WeeklyFlowChart';
import DolibarrConfig from './components/DolibarrConfig';
import MultiSelect from './components/MultiSelect';
import ICGIToggle from './components/ICGIToggle';
import {
  loadDefaultBudget, uploadExcel, getKPIs, getMonthlyData,
  getWeeklyFlow, getFilterOptions, getBudgetLines,
  createBudgetLine, updateBudgetLine, deleteBudgetLine,
  exportWeeklyExcel, syncDolibarr
} from './services/api';
import { Save, RefreshCw, Settings } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [kpis, setKpis] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [budgetLines, setBudgetLines] = useState([]);
  const [allBudgetLines, setAllBudgetLines] = useState([]);
  const [eerrLines, setEerrLines] = useState([]);
  const [filters, setFilters] = useState({ escenario: [1] });
  const [weeklyFilters, setWeeklyFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Efecto para el cursor de carga global
  useEffect(() => {
    document.body.classList.toggle('processing', isProcessing);
  }, [isProcessing]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async (currentFilters = {}) => {
    setIsProcessing(true);
    try {
      const [kpiData, monthly, options] = await Promise.all([
        getKPIs(currentFilters),
        getMonthlyData(currentFilters),
        getFilterOptions(),
      ]);
      setKpis(kpiData);
      setMonthlyData(monthly);
      setFilterOptions(options);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const loadLines = useCallback(async (currentFilters = {}) => {
    setIsProcessing(true);
    try {
      const lines = await getBudgetLines(currentFilters);
      setBudgetLines(lines);
    } catch (err) {
      console.error('Error cargando líneas:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const loadAllLines = useCallback(async () => {
    setIsProcessing(true);
    try {
      const lines = await getBudgetLines({});
      setAllBudgetLines(lines);
    } catch (err) {
      console.error('Error cargando todas las líneas:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const loadEerrLines = useCallback(async (escenarioFilter) => {
    setIsProcessing(true);
    try {
      const eerrFilter = {};
      if (escenarioFilter && (Array.isArray(escenarioFilter) ? escenarioFilter.length > 0 : true)) {
        eerrFilter.escenario = escenarioFilter;
      }
      const lines = await getBudgetLines(eerrFilter);
      setEerrLines(lines);
    } catch (err) {
      console.error('Error cargando líneas EERR:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const loadWeekly = useCallback(async (currentFilters = {}) => {
    setIsProcessing(true);
    try {
      const data = await getWeeklyFlow(currentFilters);
      setWeeklyData(data);
    } catch (err) {
      console.error('Error cargando flujo semanal:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Intentar cargar presupuesto base/defecto (puede omitirse si ya hay datos en Supabase)
        await loadDefaultBudget().catch(e => console.warn('Omitiendo carga inicial:', e.message));
        await loadData({});
        await loadLines({});
        await loadAllLines();
        await loadEerrLines([1]); // Default escenario
      } catch (error) {
        console.error('Error inicializando:', error);
        // Solo alertar si falla la carga de datos (loadData)
        if (error.message.includes('servidor')) {
          alert('Error al conectar con el servidor. Por favor verifica tu conexión.');
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadData, loadLines, loadAllLines, loadEerrLines]);

  // Recargar datos al cambiar filtros
  useEffect(() => {
    if (!loading) {
      loadData(filters);
      loadLines(filters);
    }
  }, [filters, loading, loadData, loadLines]);

  // Recargar EERR solo cuando cambia el escenario
  useEffect(() => {
    if (!loading) {
      loadEerrLines(filters.escenario);
    }
  }, [filters.escenario, loading, loadEerrLines]);

  // Cargar flujo semanal cuando se accede a esa vista
  useEffect(() => {
    if (currentView === 'semanal') {
      loadWeekly(weeklyFilters);
    }
  }, [currentView, weeklyFilters, loadWeekly]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleChartClick = (filterType, value) => {
    // Special handling: clicking a month on the chart switches to detail view
    if (filterType === 'mes') {
      setCurrentView('detalle');
      handleFilterChange({ ...filters, mes: value });
      return;
    }

    const currentFilterVal = filters[filterType];
    let newArray = [];
    
    if (Array.isArray(currentFilterVal)) {
      if (currentFilterVal.includes(value)) {
        newArray = currentFilterVal.filter(v => v !== value);
      } else {
        newArray = [...currentFilterVal, value];
      }
    } else if (currentFilterVal) {
      const arr = String(currentFilterVal).split(',');
      if (arr.includes(String(value))) {
        newArray = arr.filter(v => v !== String(value));
      } else {
        newArray = [...arr, value];
      }
    } else {
      newArray = [value];
    }
    
    handleFilterChange({ ...filters, [filterType]: newArray });
  };

  const handleRefresh = async () => {
    setIsProcessing(true);
    try {
      await loadDefaultBudget();
      await loadData(filters);
      await loadLines(filters);
      await loadAllLines();
      showNotification('Datos actualizados desde el Excel');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async (file) => {
    setIsProcessing(true);
    try {
      const result = await uploadExcel(file);
      await loadData({});
      await loadLines({});
      await loadAllLines();
      showNotification(result.message);
      return result;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreate = () => {
    if (allBudgetLines.length === 0) {
      loadAllLines();
    }
    setEditingLine(null);
    setShowForm(true);
  };

  const handleEdit = (line) => {
    if (allBudgetLines.length === 0) {
      loadAllLines();
    }
    setEditingLine(line);
    setShowForm(true);
  };

  const handleDelete = async (line) => {
    // Para depurar si el window.confirm era el causante del bloqueo, lo removemos temporalmente.
    // if (!window.confirm(`¿Eliminar la línea "${line.nombreElemento}"?`)) return;
    setIsProcessing(true);
    try {
      await deleteBudgetLine(line.id_linea);
      showNotification('Línea eliminada correctamente');
      await loadData(filters);
      await loadLines(filters);
      await loadAllLines();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (formData) => {
    setIsProcessing(true);
    try {
      if (editingLine) {
        await updateBudgetLine(editingLine.id_linea, formData);
        showNotification('Línea actualizada correctamente');
      } else {
        await createBudgetLine(formData);
        showNotification('Línea creada correctamente');
      }
      setShowForm(false);
      setEditingLine(null);
      await loadData(filters);
      await loadLines(filters);
      await loadAllLines();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportWeekly = async () => {
    setIsProcessing(true);
    try {
      showNotification('Generando Excel, por favor espera...', 'success');
      await exportWeeklyExcel(filters);
      showNotification('Archivo exportado correctamente.');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSync = async (config) => {
    setIsProcessing(true);
    try {
      const result = await syncDolibarr(config);
      await loadData(filters);
      await loadLines(filters);
      await loadAllLines();
      return result;
    } finally {
      setIsProcessing(false);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <>
            <KPICards kpis={kpis} />
            <div className="charts-grid">
              <AreaBarChart data={kpis?.byArea} onChartClick={handleChartClick} />
              <MonthlyLineChart data={monthlyData} onChartClick={handleChartClick} />
            </div>
            <div className="charts-grid">
              <LineaICGIChart data={kpis?.byLineaICGI} onChartClick={handleChartClick} />
              <EERRSummary 
                lines={eerrLines} 
                onFilterCategory={(accounts) => {
                  if (accounts) {
                    handleFilterChange({ ...filters, cuentaContable: accounts });
                  } else {
                    const { cuentaContable, ...rest } = filters;
                    handleFilterChange(rest);
                  }
                }} 
              />
            </div>

            {/* Tabla resumen por área */}
            {kpis?.byArea && (
              <div className="table-card" style={{ marginTop: 4 }}>
                <div className="table-header">
                  <div className="table-title">Resumen por Área</div>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Área</th>
                        <th style={{ textAlign: 'right' }}>Presupuesto</th>
                        <th style={{ textAlign: 'right' }}>Ejecutado</th>
                        <th style={{ textAlign: 'right' }}>Diferencia</th>
                        <th>% Ejecución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(kpis.byArea)
                        .sort(([, a], [, b]) => b.presupuesto - a.presupuesto)
                        .map(([area, val]) => {
                          const diff = val.presupuesto - val.ejecutado;
                          const pct = val.presupuesto > 0 ? (val.ejecutado / val.presupuesto) * 100 : 0;
                          const barColor = pct > 100 ? 'red' : pct > 75 ? 'yellow' : pct > 0 ? 'teal' : 'green';
                          return (
                            <tr key={area}>
                              <td style={{ fontWeight: 500 }}>{area}</td>
                              <td className="amount-cell">
                                ${(val.presupuesto / 1_000_000).toFixed(1)}M
                              </td>
                              <td className="amount-cell">
                                ${(val.ejecutado / 1_000_000).toFixed(1)}M
                              </td>
                              <td className={`amount-cell ${diff >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                                ${(diff / 1_000_000).toFixed(1)}M
                              </td>
                              <td>
                                <div className="progress-bar-wrapper">
                                  <div className="progress-bar">
                                    <div
                                      className={`progress-bar-fill ${barColor}`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="progress-text">{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );

      case 'detalle':
        return (
          <BudgetTable
            lines={budgetLines}
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={handleFilterChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        );

      case 'semanal':
        return (
          <WeeklyFlowChart
            data={weeklyData}
            filters={weeklyFilters}
            filterOptions={filterOptions}
            onFilterChange={setWeeklyFilters}
          />
        );

      case 'importar':
        return <FileUpload onUpload={handleUpload} />;

      case 'dolibarr':
        return <DolibarrConfig onSync={handleSync} />;

      case 'configuracion':
        return (
          <div className="chart-card">
            <div className="chart-card-title"><span>Configuración</span><Settings /></div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>
              La configuración de la aplicación se maneja mediante variables de entorno en el archivo <code>.env</code>.
            </p>
            <ul style={{ marginTop: 12, paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 2 }}>
              <li><strong>PORT</strong>: Puerto del servidor (default: 3001)</li>
              <li><strong>EXCEL_SHEET_NAME</strong>: Nombre de la hoja maestra (default: Detalle)</li>
              <li><strong>DOLIBARR_URL</strong>: URL base de Dolibarr</li>
              <li><strong>DOLIBARR_API_KEY</strong>: API Key de Dolibarr</li>
              <li><strong>DOLIBARR_YEAR</strong>: Año de filtro (default: 2026)</li>
            </ul>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="Logo" style={{ width: 64, height: 64, marginBottom: 16 }} />
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Cargando presupuesto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />

      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-title">
            <span>Tablero de Presupuesto</span> — Año 2026
          </div>
          <div className="header-actions">
            <button className="btn btn-outline btn-sm" onClick={handleRefresh}>
              <RefreshCw style={{ width: 14, height: 14 }} /> Actualizar
            </button>
            <button className="btn btn-success btn-sm" onClick={handleExportWeekly}>
              <Save style={{ width: 14, height: 14 }} /> Exportar Flujo Semanal
            </button>
          </div>
        </header>

        {/* Contenido */}
        <main className="page-content">
          {/* Notification */}
          {notification && (
            <div className={`alert alert-${notification.type === 'error' ? 'error' : 'success'}`}>
              {notification.message}
            </div>
          )}

          {/* Filtros globales para dashboard */}
          {currentView === 'dashboard' && (
            <div className="filters-bar">
              <MultiSelect
                id="global-filter-area"
                label="Área"
                options={filterOptions?.areas || []}
                value={Array.isArray(filters.area) ? filters.area : (filters.area ? filters.area.split(',') : [])}
                onChange={(val) => handleFilterChange({ ...filters, area: val })}
                placeholder="Todas las Áreas"
              />

              <MultiSelect
                id="global-filter-linea"
                label="Línea"
                options={filterOptions?.lineas || []}
                value={Array.isArray(filters.linea) ? filters.linea : (filters.linea ? filters.linea.split(',') : [])}
                onChange={(val) => handleFilterChange({ ...filters, linea: val })}
                placeholder="Todas las Líneas"
              />

              <MultiSelect
                id="global-filter-escenario"
                label="Escenario"
                options={filterOptions?.escenarios || []}
                value={Array.isArray(filters.escenario) ? filters.escenario : (filters.escenario ? filters.escenario.split(',').map(Number) : [])}
                onChange={(val) => handleFilterChange({ ...filters, escenario: val })}
                placeholder="Todos los Escenarios"
              />

              <ICGIToggle
                options={filterOptions?.tipos || []}
                value={Array.isArray(filters.icgi) ? filters.icgi : (filters.icgi ? filters.icgi.split(',') : [])}
                onChange={(val) => handleFilterChange({ ...filters, icgi: val })}
              />

              <MultiSelect
                id="global-filter-cuenta-contable"
                label="Cuenta Contable"
                options={filterOptions?.cuentasContables || []}
                value={Array.isArray(filters.cuentaContable) ? filters.cuentaContable : (filters.cuentaContable ? filters.cuentaContable.split(',') : [])}
                onChange={(val) => handleFilterChange({ ...filters, cuentaContable: val })}
                placeholder="Todas las Cuentas"
              />

              {Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : Boolean(v)) && (
                <button className="btn btn-ghost btn-sm" onClick={() => setFilters({})}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {renderView()}
        </main>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <BudgetForm
          line={editingLine}
          filterOptions={filterOptions}
          budgetLines={allBudgetLines}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingLine(null); }}
        />
      )}
    </div>
  );
}

export default App;
