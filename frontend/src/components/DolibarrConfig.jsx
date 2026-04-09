import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Wifi, CheckCircle, AlertCircle, Clock, ToggleLeft, ToggleRight } from 'lucide-react';

const DEFAULTS = {
  url: 'http://www.a-maqerp.com',
  apiKey: '4739JKj46PMqPE9YXbwtn5ji6C7ZgzuK',
  year: '2026',
};

const MIN_INTERVAL_MINS = 15;

/**
 * Formatea un timestamp ISO como texto legible de tiempo transcurrido.
 */
function formatSyncTime(ts) {
  if (!ts) return null;
  const date = new Date(ts);
  return date.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function DolibarrConfig({ onSync, lastSync }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('dolibarr_config');
    if (saved) {
      try { return { ...DEFAULTS, ...JSON.parse(saved) }; } catch (e) { return DEFAULTS; }
    }
    return DEFAULTS;
  });

  const [autoSync, setAutoSync] = useState(() => {
    return localStorage.getItem('dolibarr_autosync') === 'true';
  });
  const [syncInterval, setSyncInterval] = useState(() => {
    return parseInt(localStorage.getItem('dolibarr_sync_interval') || '30');
  });
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const autoSyncRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('dolibarr_config', JSON.stringify(config));
  }, [config]);

  /**
   * Función de sincronización que se usa tanto manualmente como en el auto-sync.
   */
  const performSync = useCallback(async (silent = false) => {
    if (!config.url || !config.apiKey) return;
    if (!silent) { setSyncing(true); setError(null); setResult(null); }

    try {
      const res = await onSync(config);
      if (!silent) setResult(res);
    } catch (err) {
      if (!silent) setError(err.message || 'Error al sincronizar con Dolibarr');
      else console.error('[Auto-sync error]', err.message);
    } finally {
      if (!silent) setSyncing(false);
    }
  }, [config, onSync]);

  /**
   * Configura el intervalo de auto-sync usando setInterval.
   * Se limpia al desactivar o cambiar configuración.
   */
  useEffect(() => {
    if (autoSyncRef.current) clearInterval(autoSyncRef.current);
    localStorage.setItem('dolibarr_autosync', String(autoSync));
    localStorage.setItem('dolibarr_sync_interval', String(syncInterval));

    // Notificar a App.jsx (que maneja el auto-sync global) via storage event
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dolibarr_autosync',
      newValue: String(autoSync),
    }));

    // DolibarrConfig ya NO maneja el setInterval propio;
    // el auto-sync real vive en App.jsx para no depender del montaje de este componente.
  }, [autoSync, syncInterval, config.url, config.apiKey, performSync]);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleManualSync = async () => {
    if (!config.url || !config.apiKey) {
      setError('Complete la URL y API Key antes de sincronizar.');
      return;
    }
    await performSync(false);
  };

  const handleToggleAutoSync = () => {
    setAutoSync(prev => !prev);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
        Sincronización con Dolibarr ERP
      </h2>

      {error && (
        <div className="alert alert-error">
          <AlertCircle /> {error}
        </div>
      )}

      {result && (
        <div className="alert alert-success">
          <CheckCircle /> Sincronización completada exitosamente.
        </div>
      )}

      {/* Última sincronización */}
      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div className="chart-card-title"><span>Estado de sincronización</span><Clock /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Última sincronización</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {lastSync ? formatSyncTime(lastSync) : 'Nunca'}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-sync</div>
            <div style={{
              marginTop: 2, fontSize: '0.85rem', fontWeight: 700,
              color: autoSync ? 'var(--success)' : 'var(--text-muted)'
            }}>
              {autoSync ? `Activo (cada ${syncInterval} min)` : 'Inactivo'}
            </div>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div className="chart-card-title"><span>Configuración de conexión</span><Wifi /></div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-group full-width">
            <label className="form-label">URL base de Dolibarr</label>
            <input className="form-input" type="url" placeholder="https://tu-dolibarr.com" value={config.url} onChange={e => handleChange('url', e.target.value)} id="dolibarr-url" />
          </div>
          <div className="form-group">
            <label className="form-label">API Key</label>
            <input className="form-input" type="password" placeholder="Tu API key segura" value={config.apiKey} onChange={e => handleChange('apiKey', e.target.value)} id="dolibarr-apikey" />
          </div>
          <div className="form-group">
            <label className="form-label">Año de filtro</label>
            <input className="form-input" type="text" value={config.year} onChange={e => handleChange('year', e.target.value)} id="dolibarr-year" />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleManualSync} disabled={syncing} id="btn-sync-dolibarr">
            {syncing ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sincronizando...</>
            ) : (
              <><RefreshCw /> Sincronizar ahora</>
            )}
          </button>
        </div>
      </div>

      {/* Auto-sync */}
      <div className="chart-card">
        <div className="chart-card-title"><span>Auto-sincronización</span></div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Sincronización automática</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Sincroniza automáticamente con Dolibarr en el intervalo configurado
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoSync}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              title={autoSync ? 'Desactivar auto-sync' : 'Activar auto-sync'}
            >
              {autoSync
                ? <ToggleRight style={{ width: 40, height: 40, color: 'var(--primary)' }} />
                : <ToggleLeft style={{ width: 40, height: 40, color: 'var(--text-muted)' }} />
              }
            </button>
          </div>

          {autoSync && (
            <div className="form-group">
              <label className="form-label">Intervalo de sincronización (mínimo {MIN_INTERVAL_MINS} minutos)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="form-input"
                  type="number"
                  min={MIN_INTERVAL_MINS}
                  max={480}
                  value={syncInterval}
                  onChange={e => setSyncInterval(Math.max(MIN_INTERVAL_MINS, parseInt(e.target.value) || MIN_INTERVAL_MINS))}
                  style={{ maxWidth: 120 }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>minutos</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                El auto-sync se activa al iniciar o modificar el intervalo. La próxima ejecución ocurrirá en {syncInterval} minutos.
              </div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="chart-card" style={{ marginTop: 16 }}>
          <div className="chart-card-title">Resultado de sincronización</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facturas leídas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.facturas || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Órdenes leídas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.ordenes || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Informes de gastos</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.informesGastos || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Movimientos vinculados</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--success)' }}>
                {result.movimientosVinculados || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
