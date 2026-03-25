import { useState, useEffect } from 'react';
import { RefreshCw, Save, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react';

const DEFAULTS = {
  url: 'http://www.a-maqerp.com',
  apiKey: '4739JKj46PMqPE9YXbwtn5ji6C7ZgzuK',
  year: '2026',
};

export default function DolibarrConfig({ onSync }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('dolibarr_config');
    if (saved) {
      try {
        return { ...DEFAULTS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULTS;
      }
    }
    return DEFAULTS;
  });

  useEffect(() => {
    localStorage.setItem('dolibarr_config', JSON.stringify(config));
  }, [config]);

  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSync = async () => {
    if (!config.url || !config.apiKey) {
      setError('Complete la URL y API Key antes de sincronizar.');
      return;
    }

    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      console.log('Syncing with config:', config);
      const res = await onSync(config);
      console.log('Sync result:', res);
      setResult(res);
    } catch (err) {
      console.error('Sync error:', err);
      setError(err.message || 'Error al sincronizar con Dolibarr');
    } finally {
      setSyncing(false);
    }
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
          <CheckCircle /> {result.message}
        </div>
      )}

      <div className="chart-card">
        <div className="chart-card-title">
          <span>Configuración de conexión</span>
          <Wifi />
        </div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-group full-width">
            <label className="form-label">URL base de Dolibarr</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://tu-dolibarr.com"
              value={config.url}
              onChange={e => handleChange('url', e.target.value)}
              id="dolibarr-url"
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              className="form-input"
              type="password"
              placeholder="Tu API key segura"
              value={config.apiKey}
              onChange={e => handleChange('apiKey', e.target.value)}
              id="dolibarr-apikey"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Año de filtro</label>
            <input
              className="form-input"
              type="text"
              value={config.year}
              onChange={e => handleChange('year', e.target.value)}
              id="dolibarr-year"
            />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleSync} disabled={syncing} id="btn-sync-dolibarr">
            {syncing ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sincronizando...</>
            ) : (
              <><RefreshCw /> Sincronizar Movimientos</>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="chart-card" style={{ marginTop: 20 }}>
          <div className="chart-card-title">Resultado de sincronización</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facturas leídas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.facturas || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Órdenes leídas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.ordenes || 0}</div>
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
