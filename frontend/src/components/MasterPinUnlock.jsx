import { useState, useRef, useEffect } from 'react';
import { Lock, Unlock, X } from 'lucide-react';

/**
 * Mini-modal de PIN maestro para desbloquear la edición del Presupuesto Inicial.
 * El PIN se configura via la variable de entorno VITE_MASTER_PIN.
 * Si no está configurada, usa un valor por defecto de seguridad básica.
 */
const MASTER_PIN = import.meta.env.VITE_MASTER_PIN || 'amaq2026';

export default function MasterPinUnlock({ onUnlock, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-foco al abrir el modal
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === MASTER_PIN) {
      setError('');
      onUnlock(true);
    } else {
      setError('PIN incorrecto. Intente de nuevo.');
      setPin('');
      if (inputRef.current) inputRef.current.focus();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.60)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          width: 340,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(46, 49, 146, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock style={{ width: 18, height: 18, color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Desbloquear Ppto. Inicial
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Se requiere contraseña maestra
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ padding: 6 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              Contraseña maestra
            </label>
            <input
              ref={inputRef}
              type="password"
              className="form-input"
              value={pin}
              onChange={e => { setPin(e.target.value); setError(''); }}
              placeholder="Ingrese la contraseña..."
              autoComplete="off"
              style={{ width: '100%' }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 12, padding: '8px 12px', borderRadius: 6,
              background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)',
              color: '#E74C3C', fontSize: '0.8rem',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!pin}>
              <Unlock style={{ width: 14, height: 14 }} />
              Desbloquear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
