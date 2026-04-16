import { useState, useEffect, useCallback, useRef } from 'react';
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
import ICGIToggle from './components/ICGIToggle';
import BudgetFilters from './components/BudgetFilters';
import BudgetTransfers from './components/BudgetTransfers';
import ExecutionModal from './components/ExecutionModal';
import {
  loadDefaultBudget, uploadExcel, getKPIs, getMonthlyData,
  getWeeklyFlow, getFilterOptions, getBudgetLines,
  createBudgetLine, updateBudgetLine, deleteBudgetLine, restoreBudgetLine,
  exportWeeklyExcel, syncDolibarr, getUnassignedDocuments
} from './services/api';
import { getCurrentWeek } from './utils/dateUtils';
import { Save, RefreshCw, Settings, Download, Clock, Menu } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [kpis, setKpis] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [budgetLines, setBudgetLines] = useState([]);       // Líneas activas (filtradas)
  const [allBudgetLines, setAllBudgetLines] = useState([]); // Todas las líneas (para form)
  const [eerrLines, setEerrLines] = useState([]);
  const [filters, setFilters] = useState({ escenario: [1] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [lineToDelete, setLineToDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [notification, setNotification] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [weeklyOptions, setWeeklyOptions] = useState({ displayWeeks: 12, filterEERR: false });
  // Estado para mostrar líneas eliminadas en la tabla de detalle
  const [showDeleted, setShowDeleted] = useState(false);
  // Estado para la modal de ejecución
  const [executionModalLine, setExecutionModalLine] = useState(null);
  // Documentos sin asignación de línea de presupuesto
  const [unassignedDocs, setUnassignedDocs] = useState(null);
  // Timestamp de última sincronización con Dolibarr
  const [lastSync, setLastSync] = useState(() => localStorage.getItem('lastDolibarrSync') || null);
  // Ref para el intervalo de auto-sync (persiste entre renders y navegación de vistas)
  const autoSyncIntervalRef = useRef(null);

  // Estados visuales para layout responsive
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMenuOpen]);

  /**
   * Configura el auto-sync de Dolibarr a nivel de App para que funcione
   * independientemente de la vista activa. Lee la configuración desde localStorage
   * cada vez que dispara para respetar cambios recientes.
   */
  useEffect(() => {
    const setupAutoSync = () => {
      // Limpiar intervalo previo si existe
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }

      const autoSyncEnabled = localStorage.getItem('dolibarr_autosync') === 'true';
      if (!autoSyncEnabled) return;

      const syncIntervalMins = parseInt(localStorage.getItem('dolibarr_sync_interval') || '30');
      const intervalMs = Math.max(15, syncIntervalMins) * 60 * 1000;

      autoSyncIntervalRef.current = setInterval(async () => {
        const savedConfig = localStorage.getItem('dolibarr_config');
        if (!savedConfig) return;
        try {
          const cfg = JSON.parse(savedConfig);
          if (!cfg.url || !cfg.apiKey) return;
          console.log(`[App Auto-sync] Disparando sincronización automática (cada ${syncIntervalMins} min)`);
          const result = await syncDolibarr(cfg);
          const now = new Date().toISOString();
          setLastSync(now);
          localStorage.setItem('lastDolibarrSync', now);
          // Refrescar KPIs y tendencia mensual tras sync silencioso
          await Promise.all([loadData(filters), loadLines(filters, showDeleted)]);
          console.log('[App Auto-sync] Completado:', result);
        } catch (e) {
          console.error('[App Auto-sync] Error:', e.message);
        }
      }, intervalMs);

      console.log(`[App Auto-sync] Configurado: cada ${syncIntervalMins} min`);
    };

    setupAutoSync();

    // Escuchar cambios en localStorage para reconfigurar si el usuario cambia el intervalo
    const handleStorageChange = (e) => {
      if (e.key === 'dolibarr_autosync' || e.key === 'dolibarr_sync_interval') {
        setupAutoSync();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (autoSyncIntervalRef.current) clearInterval(autoSyncIntervalRef.current);
      window.removeEventListener('storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo se ejecuta una vez al montar

  useEffect(() => {
    document.body.classList.toggle('processing', isProcessing);
  }, [isProcessing]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  /**
   * Carga principal de dashboard: KPIs, datos mensuales y opciones de filtro en paralelo.
   * Reducción de round-trips agrupando llamadas en Promise.all.
   */
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

  /**
   * Carga documentos sin asignación desde Dolibarr.
   * Se dispara tras sync o al cargar el dashboard si hay configuración guardada.
   */
  const loadUnassignedDocs = useCallback(async () => {
    const savedConfig = localStorage.getItem('dolibarr_config');
    if (!savedConfig) return;
    try {
      const cfg = JSON.parse(savedConfig);
      if (!cfg.url || !cfg.apiKey) return;
      const result = await getUnassignedDocuments(cfg);
      setUnassignedDocs(result);
    } catch (e) {
      console.warn('[loadUnassignedDocs] Error:', e.message);
    }
  }, []);

  /**
   * Carga líneas para la tabla de detalle.
   * Si showDeleted es true, incluye líneas eliminadas.
   */
  const loadLines = useCallback(async (currentFilters = {}, includeDeleted = false) => {
    setIsProcessing(true);
    try {
      const lines = await getBudgetLines(currentFilters, includeDeleted);
      setBudgetLines(lines);
    } catch (err) {
      console.error('Error cargando líneas:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Carga TODAS las líneas activas (sin filtros) para el formulario de selección.
   * No incluye eliminadas para no contaminar el selector de líneas base.
   */
  const loadAllLines = useCallback(async () => {
    try {
      const lines = await getBudgetLines({}, false);
      setAllBudgetLines(lines);
    } catch (err) {
      console.error('Error cargando todas las líneas:', err);
    }
  }, []);

  const loadEerrLines = useCallback(async (escenarioFilter) => {
    try {
      const eerrFilter = {};
      if (escenarioFilter && (Array.isArray(escenarioFilter) ? escenarioFilter.length > 0 : true)) {
        eerrFilter.escenario = escenarioFilter;
      }
      // SOLICITAR líneas eliminadas para que EERRSummary recupere su P. Inicial
      const lines = await getBudgetLines(eerrFilter, true);
      setEerrLines(lines);
    } catch (err) {
      console.error('Error cargando líneas EERR:', err);
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
        await loadDefaultBudget().catch(e => console.warn('Omitiendo carga inicial:', e.message));
        // Cargar todo en paralelo para mayor velocidad
        await Promise.all([
          loadData({}),
          loadLines({}, false),
          loadAllLines(),
          loadEerrLines([1]),
        ]);
        // Cargar docs sin asignar (no bloquea el init)
        loadUnassignedDocs();
      } catch (error) {
        console.error('Error inicializando:', error);
        if (error.message.includes('servidor')) {
          alert('Error al conectar con el servidor. Por favor verifica tu conexión.');
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadData, loadLines, loadAllLines, loadEerrLines, loadUnassignedDocs]);

  // Recargar datos al cambiar filtros
  useEffect(() => {
    if (!loading) {
      // Cargar datos del dashboard y líneas en paralelo
      Promise.all([
        loadData(filters),
        loadLines(filters, showDeleted),
      ]);
    }
  }, [filters, loading, loadData, loadLines, showDeleted]);

  // Recargar EERR solo cuando cambia el escenario
  useEffect(() => {
    if (!loading) {
      loadEerrLines(filters.escenario);
    }
  }, [filters.escenario, loading, loadEerrLines]);

  // Cargar flujo semanal cuando se accede a esa vista o cambian filtros
  useEffect(() => {
    if (currentView === 'semanal' && !loading) {
      loadWeekly(filters);
    }
  }, [currentView, filters, loading, loadWeekly]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleChartClick = (filterType, value) => {
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
      await Promise.all([
        loadData(filters),
        loadLines(filters, showDeleted),
        loadAllLines(),
      ]);
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
      await Promise.all([loadData({}), loadLines({}, false), loadAllLines()]);
      showNotification(result.message);
      return result;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreate = () => {
    if (allBudgetLines.length === 0) loadAllLines();
    setEditingLine(null);
    setShowForm(true);
  };

  const handleEdit = (line) => {
    if (allBudgetLines.length === 0) loadAllLines();
    setEditingLine(line);
    setShowForm(true);
  };

  /**
   * Dispara el modal de confirmación de eliminación lógica.
   */
  const handleDelete = (line) => {
    setLineToDelete(line);
    setDeleteReason('');
  };

  /**
   * Ejecuta la eliminación lógica con un motivo.
   */
  const confirmDelete = async () => {
    if (!deleteReason.trim()) {
      showNotification('El motivo de eliminación es obligatorio', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await deleteBudgetLine(lineToDelete.id_linea, deleteReason.trim());
      showNotification(`Línea "${lineToDelete.nombreElemento}" marcada como eliminada.`);
      setLineToDelete(null);
      await Promise.all([loadData(filters), loadLines(filters, showDeleted), loadAllLines()]);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Restaura una línea previamente eliminada.
   */
  const handleRestore = async (line) => {
    setIsProcessing(true);
    try {
      await restoreBudgetLine(line.id_linea);
      showNotification(`Línea "${line.nombreElemento}" restaurada correctamente.`);
      await Promise.all([loadData(filters), loadLines(filters, showDeleted), loadAllLines()]);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleShowDeleted = () => {
    const newShowDeleted = !showDeleted;
    setShowDeleted(newShowDeleted);
    loadLines(filters, newShowDeleted);
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
      await Promise.all([loadData(filters), loadLines(filters, showDeleted), loadAllLines()]);
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
      const currentWeek = getCurrentWeek();
      const effectiveStartWeek = weeklyOptions.startWeek === 'current' ? currentWeek : parseInt(weeklyOptions.startWeek);
      const options = {
        startWeek: effectiveStartWeek,
        endWeek: Math.min(52, effectiveStartWeek + weeklyOptions.displayWeeks - 1),
        simplified: true,
        filterEERR: weeklyOptions.filterEERR
      };
      await exportWeeklyExcel({ ...filters, ...options });
      showNotification('Archivo exportado correctamente.');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportLines = () => {
    try {
      const activeLines = budgetLines.filter(l => l.estado !== 'eliminada');
      if (activeLines.length === 0) { showNotification('No hay líneas para exportar', 'error'); return; }
      
      const headers = ['ID', 'Nombre del Elemento', 'Total Presupuesto'];
      const rows = activeLines.map(line => [
        `#${line.idConsecutivo}`,
        line.nombreElemento,
        line.total.toLocaleString('es-CL', { minimumFractionDigits: 0 })
      ]);
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
      ].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Presupuesto_Detalle_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Líneas exportadas correctamente');
    } catch (err) {
      console.error(err);
      showNotification('Error al exportar líneas', 'error');
    }
  };

  /**
   * Sincroniza con Dolibarr y guarda el timestamp de última sincronización.
   */
  const handleSync = async (config) => {
    setIsProcessing(true);
    try {
      const result = await syncDolibarr(config);
      const now = new Date().toISOString();
      setLastSync(now);
      localStorage.setItem('lastDolibarrSync', now);
      await Promise.all([loadData(filters), loadLines(filters, showDeleted), loadAllLines()]);
      // Recargar docs sin asignar tras sync
      loadUnassignedDocs();
      return result;
    } finally {
      setIsProcessing(false);
    }
  };

  const formatLastSync = (ts) => {
    if (!ts) return null;
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'hace menos de 1 min';
    if (diffMins < 60) return `hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `hace ${diffHours} h`;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <>
            <KPICards kpis={kpis} unassignedDocs={unassignedDocs} />
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

            {/* Tabla resumen por área con columnas Inicial / Actual */}
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
                        <th style={{ textAlign: 'right' }}>P. Inicial</th>
                        <th style={{ textAlign: 'right' }}>P. Actual</th>
                        <th style={{ textAlign: 'right' }}>Diferencia</th>
                        <th style={{ textAlign: 'right' }}>Ejecutado</th>
                        <th>% Ejec. Actual</th>
                        <th>% Ejec. Inicial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(kpis.byArea)
                        .sort(([, a], [, b]) => b.presupuesto - a.presupuesto)
                        .map(([area, val]) => {
                          const diff = (val.presupuestoInicial || 0) - (val.presupuesto || 0);
                          const pctActual = val.presupuesto > 0 ? (val.ejecutado / val.presupuesto) * 100 : 0;
                          const pctInicial = (val.presupuestoInicial || 0) > 0 ? (val.ejecutado / (val.presupuestoInicial || 0)) * 100 : 0;
                          const barColorActual = pctActual > 100 ? 'red' : pctActual > 75 ? 'yellow' : pctActual > 0 ? 'teal' : 'green';
                          const barColorInicial = pctInicial > 100 ? 'red' : pctInicial > 75 ? 'yellow' : pctInicial > 0 ? 'teal' : 'green';
                          return (
                            <tr key={area}>
                              <td style={{ fontWeight: 500 }}>{area}</td>
                              <td className="amount-cell" style={{ color: 'var(--text-muted)' }}>
                                ${((val.presupuestoInicial || 0) / 1_000_000).toFixed(1)}M
                              </td>
                              <td className="amount-cell">
                                ${(val.presupuesto / 1_000_000).toFixed(1)}M
                              </td>
                              <td className={`amount-cell ${diff >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                                {diff >= 0 ? '' : '-'}${(Math.abs(diff) / 1_000_000).toFixed(1)}M
                              </td>
                              <td className="amount-cell">
                                ${(val.ejecutado / 1_000_000).toFixed(1)}M
                              </td>
                              <td>
                                <div className="progress-bar-wrapper">
                                  <div className="progress-bar">
                                    <div className={`progress-bar-fill ${barColorActual}`} style={{ width: `${Math.min(pctActual, 100)}%` }} />
                                  </div>
                                  <span className="progress-text">{pctActual.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td>
                                <div className="progress-bar-wrapper">
                                  <div className="progress-bar">
                                    <div className={`progress-bar-fill ${barColorInicial}`} style={{ width: `${Math.min(pctInicial, 100)}%` }} />
                                  </div>
                                  <span className="progress-text">{pctInicial.toFixed(0)}%</span>
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
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onRestore={handleRestore}
            showDeleted={showDeleted}
            onToggleShowDeleted={handleToggleShowDeleted}
            onViewExecution={(line) => setExecutionModalLine(line)}
          />
        );

      case 'semanal':
        return (
          <WeeklyFlowChart
            lines={budgetLines}
            filters={filters}
            options={weeklyOptions}
            onOptionsChange={setWeeklyOptions}
            onEdit={handleEdit}
          />
        );

      case 'traslados':
        return (
          <BudgetTransfers
            budgetLines={allBudgetLines}
            onTransferComplete={async () => {
              await Promise.all([loadData(filters), loadLines(filters, showDeleted), loadAllLines()]);
              showNotification('Traslados actualizados');
            }}
          />
        );

      case 'importar':
        return <FileUpload onUpload={handleUpload} />;

      case 'dolibarr':
        return <DolibarrConfig onSync={handleSync} lastSync={lastSync} />;

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
              <li><strong>VITE_MASTER_PIN</strong>: PIN para desbloquear edición del Presupuesto Inicial</li>
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
          <img src="/logo.png" alt="Logo" style={{ width: 128, height: 128, marginBottom: 16 }} />
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Cargando presupuesto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar 
        currentView={currentView} 
        onNavigate={setCurrentView} 
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className={`main-content ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <header className={`header ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="header-title">
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                } else {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                }
              }}
              style={{ marginRight: 8, padding: 4 }}
            >
              <Menu style={{ width: 22, height: 22 }} />
            </button>
            <span style={{ whiteSpace: 'nowrap' }}>Tablero de Presupuesto</span> <span className="hide-on-mobile" style={{ marginLeft: 6 }}>— Año 2026</span>
          </div>
          <div className="header-actions">
            {/* Última sincronización con Dolibarr */}
            {lastSync && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock style={{ width: 12, height: 12 }} />
                Sync: {formatLastSync(lastSync)}
              </span>
            )}
            <button className="btn btn-outline btn-sm" onClick={handleRefresh}>
              <RefreshCw style={{ width: 14, height: 14 }} /> Actualizar
            </button>
            {currentView === 'detalle' && (
              <button className="btn btn-success btn-sm" onClick={handleExportLines}>
                <Download style={{ width: 14, height: 14 }} /> Exportar Líneas
              </button>
            )}
            {currentView === 'semanal' && (
              <button className="btn btn-success btn-sm" onClick={handleExportWeekly}>
                <Save style={{ width: 14, height: 14 }} /> Exportar Flujo Semanal
              </button>
            )}
          </div>
        </header>

        <main className="page-content">
          {notification && (
            <div className={`alert alert-${notification.type === 'error' ? 'error' : 'success'}`}>
              {notification.message}
            </div>
          )}

          {['dashboard', 'detalle', 'semanal'].includes(currentView) && (
            <BudgetFilters 
              filters={filters} 
              filterOptions={filterOptions} 
              onFilterChange={handleFilterChange} 
            />
          )}

          {renderView()}
        </main>
      </div>

      {showForm && (
        <BudgetForm
          line={editingLine}
          filterOptions={filterOptions}
          budgetLines={allBudgetLines}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingLine(null); }}
        />
      )}

      {lineToDelete && (
        <div
          className="modal-overlay"
          style={{ zIndex: 10000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setLineToDelete(null); }}
        >
          <div style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            width: '95%',
            maxWidth: 440,
            padding: 0,
            overflow: 'hidden',
            animation: 'slideUp 0.25s ease',
          }}>
            {/* Franja de acento rojo superior */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #E74C3C, #FF6B6B)' }} />
            <div style={{ padding: '24px 28px' }}>
              <h3 style={{
                marginBottom: 8,
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#1A1D3B',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                ⚠️ Confirmar Eliminación
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#4B5563', lineHeight: 1.6, marginBottom: 4 }}>
                ¿Deseas eliminar la línea
                {' '}<strong style={{ color: '#1A1D3B' }}>{lineToDelete.nombreElemento}</strong>?
                {' '}Esta acción es reversible.
              </p>
              <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: 16 }}>
                Por favor ingresa el motivo de la eliminación:
              </p>
              <textarea
                className="form-input"
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="Ej: Cancelación de evento, error de digitación..."
                rows={3}
                style={{ width: '100%', marginBottom: 20, resize: 'vertical', minHeight: 80 }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setLineToDelete(null)}
                  style={{ color: '#374151', borderColor: '#D1D5DB' }}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-danger"
                  onClick={confirmDelete}
                  disabled={!deleteReason.trim()}
                  style={{ opacity: deleteReason.trim() ? 1 : 0.5 }}
                >
                  Eliminar Línea
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de ejecución por línea */}
      {executionModalLine && (
        <ExecutionModal
          line={executionModalLine}
          onClose={() => setExecutionModalLine(null)}
        />
      )}
    </div>
  );
}

export default App;
