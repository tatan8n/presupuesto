import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Copy, Search, Eraser, Calculator, Check, Lock, Unlock } from 'lucide-react';
import CurrencyInput from './CurrencyInput';
import MasterPinUnlock from './MasterPinUnlock';
import { getWeeksInMonth, getWeekForDay, getRepresentativeDayInWeek } from '../utils/dateUtils';

const MONTH_FIELDS = [
  { key: 'enero', dateKey: 'fechaEnero', lineaKey: 'lineaEnero', label: 'Enero' },
  { key: 'febrero', dateKey: 'fechaFebrero', lineaKey: 'lineaFebrero', label: 'Febrero' },
  { key: 'marzo', dateKey: 'fechaMarzo', lineaKey: 'lineaMarzo', label: 'Marzo' },
  { key: 'abril', dateKey: 'fechaAbril', lineaKey: 'lineaAbril', label: 'Abril' },
  { key: 'mayo', dateKey: 'fechaMayo', lineaKey: 'lineaMayo', label: 'Mayo' },
  { key: 'junio', dateKey: 'fechaJunio', lineaKey: 'lineaJunio', label: 'Junio' },
  { key: 'julio', dateKey: 'fechaJulio', lineaKey: 'lineaJulio', label: 'Julio' },
  { key: 'agosto', dateKey: 'fechaAgosto', lineaKey: 'lineaAgosto', label: 'Agosto' },
  { key: 'septiembre', keyL: 'septiembre', dateKey: 'fechaSeptiembre', lineaKey: 'lineaSeptiembre', label: 'Septiembre' },
  { key: 'octubre', dateKey: 'fechaOctubre', lineaKey: 'lineaOctubre', label: 'Octubre' },
  { key: 'noviembre', dateKey: 'fechaNoviembre', lineaKey: 'lineaNoviembre', label: 'Noviembre' },
  { key: 'diciembre', dateKey: 'fechaDiciembre', lineaKey: 'lineaDiciembre', label: 'Diciembre' },
];

const getMaxDays = (monthKey) => {
  const daysInMonth2026 = {
    enero: 31, febrero: 28, marzo: 31, abril: 30, mayo: 31, junio: 30,
    julio: 31, agosto: 31, septiembre: 30, octubre: 31, noviembre: 30, diciembre: 31
  };
  return daysInMonth2026[monthKey] || 31;
};

const EMPTY_FORM = {
  cuenta: '',
  cuentaContable: '',
  area: '',
  nombreElemento: '',
  escenario: 1,
  fecha: '',
  icgi: '',
  porcentaje: '',
  linea: '',
  observaciones: '',
  enero: 0, ogEnero: 0, febrero: 0, ogFebrero: 0, marzo: 0, ogMarzo: 0,
  abril: 0, ogAbril: 0, mayo: 0, ogMayo: 0, junio: 0, ogJunio: 0,
  julio: 0, ogJulio: 0, agosto: 0, ogAgosto: 0, septiembre: 0, ogSeptiembre: 0,
  octubre: 0, ogOctubre: 0, noviembre: 0, ogNoviembre: 0, diciembre: 0, ogDiciembre: 0,
  fechaEnero: '', fechaFebrero: '', fechaMarzo: '', fechaAbril: '', fechaMayo: '', fechaJunio: '',
  fechaJulio: '', fechaAgosto: '', fechaSeptiembre: '', fechaOctubre: '', fechaNoviembre: '', fechaDiciembre: '',
  lineaEnero: '', lineaFebrero: '', lineaMarzo: '', lineaAbril: '', lineaMayo: '', lineaJunio: '',
  lineaJulio: '', lineaAgosto: '', lineaSeptiembre: '', lineaOctubre: '', lineaNoviembre: '', lineaDiciembre: '',
};

export default function BudgetForm({ line, filterOptions, budgetLines, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedBaseLineIds, setSelectedBaseLineIds] = useState([]);
  const [baseLineSearch, setBaseLineSearch] = useState('');
  const [isBaseLineDropdownOpen, setIsBaseLineDropdownOpen] = useState(false);
  const [annualInitialInput, setAnnualInitialInput] = useState('');
  const [annualCurrentInput, setAnnualCurrentInput] = useState('');
  const [weekInputText, setWeekInputText] = useState('');
  // PIN lock para edición del Presupuesto Inicial (estado global de sesión)
  const [initialUnlocked, setInitialUnlocked] = useState(() => sessionStorage.getItem('master_unlocked') === 'true');
  const [showPinModal, setShowPinModal] = useState(false);
  const baseLineDropdownRef = useRef(null);
  const isEditing = !!line;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (baseLineDropdownRef.current && !baseLineDropdownRef.current.contains(event.target)) {
        setIsBaseLineDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Al editar o cargar una línea, respetamos el estado global (no re-bloquear)
  useEffect(() => {
    if (line) {
      const clampedLine = { ...line };
      MONTH_FIELDS.forEach(m => {
        if (clampedLine[m.dateKey]) {
          const parsed = parseInt(clampedLine[m.dateKey]);
          if (!isNaN(parsed)) {
            clampedLine[m.dateKey] = Math.min(Math.max(parsed, 1), getMaxDays(m.key)).toString();
          }
        }
      });
      setForm({ ...EMPTY_FORM, ...clampedLine });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [line]);

  const total = MONTH_FIELDS.reduce((sum, m) => sum + (parseFloat(form[m.key]) || 0), 0);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCuentaContableChange = (value) => {
    handleChange('cuentaContable', value);
    const cuentaObj = filterOptions?.cuentas?.find(c => c.nombre === value);
    if (cuentaObj) {
      handleChange('cuenta', cuentaObj.numero);
    }
  };

  const handleReplicateEnero = () => {
    const val = form.enero;
    const ogVal = form.ogEnero;
    const dateVal = form.fechaEnero;
    const lineaVal = form.lineaEnero;
    setForm(prev => {
      const updated = { ...prev };
      MONTH_FIELDS.forEach(m => {
        if (m.key !== 'enero') {
          updated[m.key] = val;
          const ogKey = `og${m.key.charAt(0).toUpperCase() + m.key.slice(1)}`;
          // Solo replicar original si está vacío o es una nueva línea
          if (!isEditing || !updated[ogKey]) {
            updated[ogKey] = ogVal || val;
          }
          
          if (dateVal) {
             const parsedDate = parseInt(dateVal);
             if (!isNaN(parsedDate)) {
               updated[m.dateKey] = Math.min(parsedDate, getMaxDays(m.key)).toString();
             } else {
               updated[m.dateKey] = dateVal;
             }
          } else {
             updated[m.dateKey] = '';
          }

          // Replicar línea de negocio
          updated[m.lineaKey] = lineaVal;
        }
      });
      return updated;
    });
  };

  const handleClearMonths = () => {
    setForm(prev => {
      const updated = { ...prev };
      MONTH_FIELDS.forEach(m => {
        updated[m.key] = 0;
        const ogKey = `og${m.key.charAt(0).toUpperCase() + m.key.slice(1)}`;
        if (!isEditing || !updated[ogKey]) {
          updated[ogKey] = 0;
        }
      });
      return updated;
    });
  };

  const handleDistributeInitial = () => {
    const totalAnual = parseFloat(annualInitialInput || 0);
    if (isNaN(totalAnual) || totalAnual <= 0) return;
    
    const monthlyMath = Math.round(totalAnual / 12);
    setForm(prev => {
      const updated = { ...prev };
      MONTH_FIELDS.forEach(m => {
        const ogKey = `og${m.key.charAt(0).toUpperCase() + m.key.slice(1)}`;
        updated[ogKey] = monthlyMath;
      });
      return updated;
    });
    setAnnualInitialInput('');
  };

  const handleDistributeCurrent = () => {
    const totalAnual = parseFloat(annualCurrentInput || 0);
    if (isNaN(totalAnual) || totalAnual <= 0) return;
    
    const monthlyMath = Math.round(totalAnual / 12);
    setForm(prev => {
      const updated = { ...prev };
      MONTH_FIELDS.forEach(m => {
        updated[m.key] = monthlyMath;
      });
      return updated;
    });
    setAnnualCurrentInput('');
  };

  const handleDistributeWeek = () => {
    const weekVal = parseInt(weekInputText);
    if (isNaN(weekVal) || weekVal < 1 || weekVal > 53) return;
    
    setForm(prev => {
      const updated = { ...prev };
      MONTH_FIELDS.forEach((m, idx) => {
        updated[m.dateKey] = getRepresentativeDayInWeek(weekVal, idx);
      });
      return updated;
    });
    setWeekInputText('');
  };

  const handleBaseLineToggle = (lineId) => {
    setSelectedBaseLineIds(prev => 
      prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]
    );
  };

  const applyBaseLineCalculation = () => {
    if (selectedBaseLineIds.length === 0) return;
    let pctNum = parseFloat(form.porcentaje?.replace(/[^0-9.]/g, ''));
    if (isNaN(pctNum) || pctNum <= 0) return;

    const selectedLines = budgetLines?.filter(l => selectedBaseLineIds.includes(l.id_linea)) || [];
    if (selectedLines.length === 0) return;

    setForm(prev => {
      const updated = { ...prev };
      MONTH_FIELDS.forEach(m => {
        // Sum across all selected lines for this month
        const sumMonth = selectedLines.reduce((acc, bl) => acc + (parseFloat(bl[m.key]) || 0), 0);
        const monthlyMath = Math.round(sumMonth * (pctNum / 100));
        updated[m.key] = monthlyMath;
        const ogKey = `og${m.key.charAt(0).toUpperCase() + m.key.slice(1)}`;
        if (!isEditing || !updated[ogKey]) {
          updated[ogKey] = monthlyMath;
        }
      });
      return updated;
    });
    setIsBaseLineDropdownOpen(false);
    setBaseLineSearch('');
  };

  const filteredBaseLines = useMemo(() => {
    if (!budgetLines) return [];
    if (!baseLineSearch) return budgetLines;
    const lowerSearch = baseLineSearch.toLowerCase();
    return budgetLines.filter(l => 
      String(l.idConsecutivo).toLowerCase().includes(lowerSearch) || 
      String(l.nombreElemento).toLowerCase().includes(lowerSearch)
    );
  }, [budgetLines, baseLineSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nombreElemento || !form.cuentaContable || !form.area || !form.linea) {
      alert('Por favor complete todos los campos obligatorios (*) antes de guardar.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal-overlay">
      {/* Modal de PIN para desbloquear P. Inicial */}
      {showPinModal && (
        <MasterPinUnlock
          onUnlock={(success) => {
            if (success) {
              setInitialUnlocked(true);
              sessionStorage.setItem('master_unlocked', 'true');
            }
            setShowPinModal(false);
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? 'Editar Línea de Presupuesto' : 'Nueva Línea de Presupuesto'}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {/* Datos principales */}
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Nombre del elemento *</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.nombreElemento}
                  onChange={e => handleChange('nombreElemento', e.target.value)}
                  required
                  id="input-nombre-elemento"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cuenta contable *</label>
                <select
                  className="form-select"
                  value={form.cuentaContable}
                  onChange={e => handleCuentaContableChange(e.target.value)}
                  required
                  id="input-cuenta-contable"
                >
                  <option value="">Seleccionar...</option>
                  {(filterOptions?.cuentas || []).map(c => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cuenta (Automático)</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.cuenta}
                  readOnly
                  disabled
                  id="input-cuenta"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Área *</label>
                <select
                  className="form-select"
                  value={form.area}
                  onChange={e => handleChange('area', e.target.value)}
                  required
                  id="input-area"
                >
                  <option value="">Seleccionar...</option>
                  {(filterOptions?.areas || []).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Línea de negocio *</label>
                <select
                  className="form-select"
                  value={form.linea}
                  onChange={e => handleChange('linea', e.target.value)}
                  required
                  id="input-linea"
                >
                  <option value="">Seleccionar...</option>
                  {(filterOptions?.lineas || []).map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Escenario *</label>
                <select
                  className="form-select"
                  value={form.escenario}
                  onChange={e => handleChange('escenario', parseInt(e.target.value))}
                  id="input-escenario"
                >
                  <option value={1}>1 – Prioridad alta</option>
                  <option value={2}>2 – Prioridad media</option>
                  <option value={3}>3 – Prioridad baja</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ICGI (Tipo)</label>
                <select
                  className="form-select"
                  value={form.icgi}
                  onChange={e => handleChange('icgi', e.target.value)}
                  id="input-icgi"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Gasto">Gasto</option>
                  <option value="Costo">Costo</option>
                  <option value="Inversión">Inversión</option>
                  <option value="Ingreso">Ingreso</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">% Mat, CIF, com</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    className="form-input"
                    type="text"
                    value={form.porcentaje}
                    onChange={e => handleChange('porcentaje', e.target.value)}
                    placeholder="Ej. 5%"
                    id="input-porcentaje"
                  />
                </div>
              </div>

              {/* Conditional Baseline Selector Dropdown if percentage is valid */}
              {!isNaN(parseFloat(form.porcentaje?.replace(/[^0-9.]/g, ''))) && parseFloat(form.porcentaje?.replace(/[^0-9.]/g, '')) > 0 && (
                <div className="form-group full-width" style={{ marginTop: 8, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px dashed var(--border-light)' }}>
                  <label className="form-label" style={{ color: 'var(--primary)' }}>Auto-completar meses según porcentaje de otra línea</label>
                  
                  <div ref={baseLineDropdownRef} style={{ position: 'relative' }}>
                    <div 
                      className="form-input" 
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => setIsBaseLineDropdownOpen(!isBaseLineDropdownOpen)}
                    >
                      <span>
                        {selectedBaseLineIds.length > 0 
                          ? `${selectedBaseLineIds.length} línea(s) seleccionada(s)`
                          : 'Seleccionar líneas base para calcular...'
                        }
                      </span>
                    </div>
                    
                    {isBaseLineDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)', zIndex: 100, display: 'flex', flexDirection: 'column'
                      }}>
                        <div style={{ padding: '8px', borderBottom: '1px solid var(--border-light)' }}>
                          <div style={{ position: 'relative' }}>
                            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                            <input 
                              type="text"
                              placeholder="Buscar por ID o Nombre..."
                              value={baseLineSearch}
                              onChange={e => setBaseLineSearch(e.target.value)}
                              style={{ width: '100%', padding: '6px 8px 6px 28px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.85rem' }}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {filteredBaseLines.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>Sin resultados</div>
                          ) : (
                            filteredBaseLines.map(l => {
                              const isChecked = selectedBaseLineIds.includes(l.id_linea);
                              return (
                                <div
                                  key={l.id_linea}
                                  onClick={() => handleBaseLineToggle(l.id_linea)}
                                  style={{
                                    padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                                    background: isChecked ? 'rgba(46, 49, 146, 0.05)' : 'transparent',
                                    color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8
                                  }}
                                >
                                  <div style={{
                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                    border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                                    background: isChecked ? 'var(--primary)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    {isChecked && <Check style={{ color: '#fff', width: 12, height: 12 }} />}
                                  </div>
                                  <span>#{l.idConsecutivo} - {l.nombreElemento} (${(l.total/1000000).toFixed(1)}M)</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                        {selectedBaseLineIds.length > 0 && (
                          <div style={{ padding: '8px', borderTop: '1px solid var(--border-light)' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ width: '100%' }}
                              onClick={applyBaseLineCalculation}
                            >
                              Aplicar cálculo ({selectedBaseLineIds.length} línea{selectedBaseLineIds.length > 1 ? 's' : ''})
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: 8 }}>
                    Selecciona una o más líneas. Se sumará el valor de cada mes de todas las líneas elegidas y se aplicará el {parseFloat((parseFloat(form.porcentaje?.replace(/[^0-9.]/g, '')) || 0).toFixed(2))}% a cada mes.
                  </span>
                </div>
              )}
            </div>

            {/* Montos mensuales */}
            <div className="form-section-title" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Distribución Mensual — Total: ${total.toLocaleString('es-CO')}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    type="button" 
                    className="btn btn-outline btn-sm" 
                    onClick={handleReplicateEnero}
                    title="Copiar valor y fecha de Enero a todos los meses"
                  >
                    <Copy style={{ width: 14, height: 14, marginRight: 6 }} /> Rellenar todos con Enero
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline btn-sm" 
                    onClick={handleClearMonths}
                    title="Al presionar, todos los meses volverán a 0"
                  >
                    <Eraser style={{ width: 14, height: 14, marginRight: 6 }} /> Limpiar
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: '1 1 30%', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-card)', padding: '12px', borderRadius: 4, border: '1px dashed var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>Repartir en los 12 meses el Presupuesto <strong>Inicial</strong>: </span>
                    {!initialUnlocked ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowPinModal(true)}
                        title="Desbloquear edición de P. Inicial"
                        style={{ gap: 4, fontSize: '0.75rem' }}
                      >
                        <Lock style={{ width: 12, height: 12 }} /> Bloqueado
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Unlock style={{ width: 12, height: 12 }} /> Desbloqueado
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CurrencyInput
                      value={annualInitialInput}
                      onChange={setAnnualInitialInput}
                      placeholder="Total Anual"
                      disabled={!initialUnlocked}
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm" 
                      onClick={handleDistributeInitial}
                      title="Dividir en 12 la columna inicial"
                      disabled={!annualInitialInput || !initialUnlocked}
                    >
                      <Calculator style={{ width: 14, height: 14, marginRight: 6 }} /> Distribuir
                    </button>
                  </div>
                </div>

                <div style={{ flex: '1 1 30%', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-card)', padding: '12px', borderRadius: 4, border: '1px dashed var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Repartir en los 12 meses el Presupuesto <strong>Actual</strong>: </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CurrencyInput
                      value={annualCurrentInput}
                      onChange={setAnnualCurrentInput}
                      placeholder="Total Anual"
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm" 
                      onClick={handleDistributeCurrent}
                      title="Dividir en 12 la columna actual"
                      disabled={!annualCurrentInput}
                    >
                      <Calculator style={{ width: 14, height: 14, marginRight: 6 }} /> Distribuir
                    </button>
                  </div>
                </div>

                <div style={{ flex: '1 1 30%', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-card)', padding: '12px', borderRadius: 4, border: '1px dashed var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fijar la misma <strong>Semana</strong> para todos los meses: </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="53"
                      placeholder="Semana (1-53)"
                      value={weekInputText}
                      onChange={e => setWeekInputText(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm" 
                      onClick={handleDistributeWeek}
                      title="Aplicar semana a todos los meses"
                      disabled={!weekInputText}
                    >
                      <Copy style={{ width: 14, height: 14, marginRight: 6 }} /> Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="table-wrapper" style={{ marginTop: 12, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th style={{ width: '22%' }}>P. Inicial (Referencia)</th>
                    <th style={{ width: '15%' }}>P. Actual (Modificable)</th>
                    <th style={{ width: '25%' }}>Semana Ejec.</th>
                    <th style={{ width: '22%' }}>Línea Negocio</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTH_FIELDS.map((m, monthIndex) => {
                    const ogKey = `og${m.key.charAt(0).toUpperCase() + m.key.slice(1)}`;
                    return (
                      <tr key={m.key}>
                        <td style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{m.label}</td>
                        <td>
                          {/* P. Inicial: bloqueado en líneas nuevas (siempre 0) y en existentes (hasta desbloquear con PIN) */}
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CurrencyInput
                              value={form[ogKey]}
                              onChange={(val) => handleChange(ogKey, val)}
                              id={`input-og-${m.key}`}
                              placeholder="0"
                              disabled={!initialUnlocked}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPinModal(true)}
                              title={initialUnlocked ? 'P. Inicial desbloqueado' : 'Clic para desbloquear edición del P. Inicial'}
                              style={{
                                background: 'none', border: 'none', cursor: initialUnlocked ? 'default' : 'pointer',
                                color: initialUnlocked ? 'var(--success)' : 'var(--text-muted)', padding: 4, flexShrink: 0
                              }}
                            >
                              {initialUnlocked
                                ? <Unlock style={{ width: 13, height: 13 }} />
                                : <Lock style={{ width: 13, height: 13 }} />
                              }
                            </button>
                          </div>
                        </td>
                        <td>
                          <CurrencyInput
                            value={form[m.key]}
                            onChange={(val) => handleChange(m.key, val)}
                            id={`input-${m.key}`}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <select
                            className="form-input"
                            value={getWeekForDay(form[m.dateKey], monthIndex)}
                            onChange={e => {
                              const weekNo = e.target.value;
                              const day = getRepresentativeDayInWeek(weekNo, monthIndex);
                              handleChange(m.dateKey, day);
                            }}
                            id={`input-date-${m.key}`}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            {getWeeksInMonth(monthIndex).map(w => (
                              <option key={w.value} value={w.value}>{w.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-input"
                            value={form[m.lineaKey] || ''}
                            onChange={(e) => handleChange(m.lineaKey, e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          >
                            <option value="">{form.linea ? `(Principal: ${form.linea})` : '(Usa Principal)'}</option>
                            {filterOptions?.lineas?.map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Observaciones */}
            <div className="form-group full-width" style={{ marginTop: 12 }}>
              <label className="form-label">Observaciones</label>
              <input
                className="form-input"
                type="text"
                value={form.observaciones}
                onChange={e => handleChange('observaciones', e.target.value)}
                id="input-observaciones"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" id="btn-save-line">
              {isEditing ? 'Guardar Cambios' : 'Crear Línea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
