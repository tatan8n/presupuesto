import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ComposedChart, Line
} from 'recharts';
import { formatCurrency } from '../utils/formatters';
import { getWeekRange, getCurrentWeek } from '../utils/dateUtils';
import { Filter, Calendar, Info, ChevronDown, ChevronRight, Edit2, Download, AlertCircle, Check, X } from 'lucide-react';
import SingleSelect from './SingleSelect';
import { getUnpaidInvoices, exportCustomWeeklyExcel, exportWeeklyExcel } from '../services/api';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const weekNo = parseInt(label);
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontSize: '0.82rem'
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>Semana {label}</div>
      <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 6 }}>{getWeekRange(weekNo)}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const MONTH_FIELDS = [
  { key: 'enero', dateKey: 'fechaEnero', label: 'Enero' },
  { key: 'febrero', dateKey: 'fechaFebrero', label: 'Febrero' },
  { key: 'marzo', dateKey: 'fechaMarzo', label: 'Marzo' },
  { key: 'abril', dateKey: 'fechaAbril', label: 'Abril' },
  { key: 'mayo', dateKey: 'fechaMayo', label: 'Mayo' },
  { key: 'junio', dateKey: 'fechaJunio', label: 'Junio' },
  { key: 'julio', dateKey: 'fechaJulio', label: 'Julio' },
  { key: 'agosto', dateKey: 'fechaAgosto', label: 'Agosto' },
  { key: 'septiembre', dateKey: 'fechaSeptiembre', label: 'Septiembre' },
  { key: 'octubre', dateKey: 'fechaOctubre', label: 'Octubre' },
  { key: 'noviembre', dateKey: 'fechaNoviembre', label: 'Noviembre' },
  { key: 'diciembre', dateKey: 'fechaDiciembre', label: 'Diciembre' },
];

export default function WeeklyFlowChart({ lines = [], options, onOptionsChange, onEdit }) {
  const { displayWeeks = 12, startWeek = 'current' } = options || {};
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const currentWeek = getCurrentWeek();

  // Modo de Vista: 'presupuesto' | 'facturas'
  const [viewMode, setViewMode] = useState('presupuesto');
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [excludedInvoices, setExcludedInvoices] = useState(new Set());

  const toggleExclude = (idMovimiento) => {
    setExcludedInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idMovimiento)) {
         newSet.delete(idMovimiento);
      } else {
         newSet.add(idMovimiento);
      }
      return newSet;
    });
  };
  const effectiveStartWeek = startWeek === 'current' ? currentWeek : parseInt(startWeek);

  const loadUnpaidInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const endWeek = effectiveStartWeek + displayWeeks;
      const savedConfig = localStorage.getItem('dolibarr_config');
      const dolibarrConfig = savedConfig ? JSON.parse(savedConfig) : null;
      
      const data = await getUnpaidInvoices(endWeek, dolibarrConfig);
      console.log('[DEBUG] Invoices received from API:', data);
      setUnpaidInvoices(data || []);
      setViewMode('facturas'); // Switch to invoices view automatically
    } catch (e) {
      alert("Error al cargar facturas pendientes: " + e.message);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleExport = async () => {
    const linesMap = new Map();
    const endWeek = effectiveStartWeek + displayWeeks;

    // Helper para procesar grupos de datos
    const processItems = (items, isInvoice) => {
      items.forEach(item => {
        // Lógica similar a useMemo pero para TODOS los datos
        if (isInvoice) {
          if (excludedInvoices.has(item.id_movimiento)) return;
          const date = new Date(item.fecha_limite * 1000);
          const wk = getCurrentWeek(date);
          
          const key = `inv_${item.id_movimiento}`;
          if (!linesMap.has(key)) {
            linesMap.set(key, {
              area: 'Factura Dolibarr',
              tipificacion: 'Factura Pendiente',
              nombreElemento: `${item.ref || 'Factura'} - ${item.proveedor}`,
            });
          }
          const entry = linesMap.get(key);
          entry[`w${wk}`] = (entry[`w${wk}`] || 0) + (parseFloat(item.monto) || 0);
        } else {
          MONTH_FIELDS.forEach((m, monthIndex) => {
            const amount = item[m.key] || 0;
            if (amount <= 0) return;
            
            let wk;
            if (item[m.dateKey]) {
              wk = getCurrentWeek(new Date(2026, monthIndex, parseInt(item[m.dateKey])));
            } else {
              wk = getCurrentWeek(new Date(2026, monthIndex + 1, 0));
            }
            
            const key = `line_${item.id_linea}`;
            if (!linesMap.has(key)) {
              linesMap.set(key, {
                area: item.area || 'Compras',
                tipificacion: 'Presupuestado',
                nombreElemento: item.nombreElemento,
              });
            }
            const entry = linesMap.get(key);
            entry[`w${wk}`] = (entry[`w${wk}`] || 0) + amount;
          });
        }
      });
    };

    processItems(lines, false);
    processItems(unpaidInvoices, true);
    
    try {
       await exportCustomWeeklyExcel(Array.from(linesMap.values()), { 
         startWeek: effectiveStartWeek, 
         endWeek: effectiveStartWeek + displayWeeks - 1 
       });
    } catch(e) { alert(e.message); }
  };


  // Generar opciones de semanas para el selector de inicio
  const weekOptions = useMemo(() => {
    const opts = [{ value: 'current', label: `Semana Actual (Semana ${currentWeek})` }];
    // Añadimos todas las semanas del año
    for (let i = 1; i <= 52; i++) {
      opts.push({ 
        value: i.toString(), 
        label: `Semana ${i}: ${getWeekRange(i)}` 
      });
    }
    return opts;
  }, [currentWeek]);

  const setDisplayWeeks = (val) => onOptionsChange({ ...options, displayWeeks: val });
  const setStartWeek = (val) => onOptionsChange({ ...options, startWeek: val });

  const toggleWeek = (week) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(week)) {
      newExpanded.delete(week);
    } else {
      newExpanded.add(week);
    }
    setExpandedWeeks(newExpanded);
  };

  const { aggregatedData } = useMemo(() => {
    // 1. Inicializar semanas
    const weeksMap = Array(52).fill(0).map((_, i) => ({
      semana: i + 1,
      monto: 0,
      lines: []
    }));

    if (viewMode === 'presupuesto') {
      // PROCESAR PRESUPUESTO
      lines.forEach(line => {
        MONTH_FIELDS.forEach((m, monthIndex) => {
          const amount = line[m.key] || 0;
          if (amount <= 0) return;

          let weekNumber;
          if (line[m.dateKey]) {
            const day = parseInt(line[m.dateKey]);
            const date = new Date(2026, monthIndex, day);
            weekNumber = getCurrentWeek(date) - 1;
          } else if (line.fecha && typeof line.fecha === 'number') {
            const date = new Date((line.fecha - 25569) * 86400 * 1000);
            if (date.getMonth() === monthIndex) {
              weekNumber = getCurrentWeek(date) - 1;
            } else {
              const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
              const defaultDate = new Date(2026, monthIndex, lastDay);
              weekNumber = getCurrentWeek(defaultDate) - 1;
            }
          } else {
            const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
            const defaultDate = new Date(2026, monthIndex, lastDay);
            weekNumber = getCurrentWeek(defaultDate) - 1;
          }

          weekNumber = Math.max(0, Math.min(51, weekNumber));
          weeksMap[weekNumber].monto += amount;
          weeksMap[weekNumber].lines.push({
            ...line,
            allocatedAmount: amount,
            isInvoice: false
          });
        });
      });
    } else {
      // PROCESAR FACTURAS PENDIENTES
      unpaidInvoices.forEach(inv => {
         if (excludedInvoices.has(inv.id_movimiento)) return;
         
         const invAmt = parseFloat(inv.monto) || 0;
         const date = new Date(inv.fecha_limite * 1000);
         const weekNumber = Math.max(0, Math.min(51, getCurrentWeek(date) - 1));
         
         weeksMap[weekNumber].monto += invAmt;
         weeksMap[weekNumber].lines.push({
            id_movimiento: inv.id_movimiento,
            proveedor: inv.proveedor,
            ref: inv.ref,
            area: 'Factura Dolibarr',
            nombreElemento: `${inv.ref || 'Factura'} - ${inv.proveedor}`,
            cuenta: inv.ref,
            allocatedAmount: invAmt,
            isInvoice: true
         });
      });
    }

    return { 
      aggregatedData: weeksMap.filter(w => w.semana >= effectiveStartWeek && w.semana < effectiveStartWeek + displayWeeks)
    };
  }, [lines, displayWeeks, effectiveStartWeek, viewMode, unpaidInvoices, excludedInvoices]);


  return (
    <div className="fade-in">
      {/* Header and Filters (Mismo código anterior) */}
      <div className="view-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 className="view-title">Flujo de Caja Semanal</h2>
          <p className="view-subtitle">Análisis detallado de desembolsos estimados por semana para el año 2026</p>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', marginLeft: 4 }}>Semana de inicio</span>
            <SingleSelect
              options={weekOptions}
              value={startWeek}
              onChange={setStartWeek}
              placeholder="Seleccionar inicio..."
              width={280}
            />
          </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', marginLeft: 4 }}>Semanas a ver</span>
            <SingleSelect
              options={[
                { value: '4', label: '4 semanas' },
                { value: '8', label: '8 semanas' },
                { value: '12', label: '12 semanas' },
                { value: '16', label: '16 semanas' },
                { value: '24', label: '24 semanas' },
                { value: '52', label: 'Todo el año' },
              ]}
              value={displayWeeks.toString()}
              onChange={(val) => setDisplayWeeks(parseInt(val))}
              placeholder="Ver..."
              width={160}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <div className="segmented-control" style={{ background: '#f1f5f9', padding: 4, borderRadius: 8, display: 'flex', gap: 4 }}>
               <button 
                 className={`btn btn-sm ${viewMode === 'presupuesto' ? 'btn-primary' : ''}`} 
                 style={viewMode !== 'presupuesto' ? { background: 'transparent', border: 'none', color: '#64748b' } : {}}
                 onClick={() => setViewMode('presupuesto')}
               >
                 Presupuesto
               </button>
               <button 
                 className={`btn btn-sm ${viewMode === 'facturas' ? 'btn-primary' : ''}`}
                 style={viewMode !== 'facturas' ? { background: 'transparent', border: 'none', color: '#64748b' } : {}}
                 onClick={() => setViewMode('facturas')}
               >
                 Facturas Dolibarr
               </button>
            </div>
            
            {viewMode === 'facturas' && unpaidInvoices.length === 0 && (
               <button className="btn btn-outline" onClick={loadUnpaidInvoices} disabled={loadingInvoices}>
                 {loadingInvoices ? 'Cargando...' : 'Cargar de Dolibarr'}
               </button>
            )}
            
            <button className="btn btn-primary btn-icon" onClick={handleExport}>
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>
      </div>


      {/* Gráfico (Mismo código anterior) */}
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={aggregatedData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="semana" tickFormatter={(v) => `Sem ${v}`} tick={{ fontSize: 10 }} axisLine={false} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="monto" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla con Expansión */}
      <div className="table-card" style={{ marginTop: 24 }}>
        <div className="table-header">
          <div className="table-title">Cronología y Detalle de Líneas</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Semana / Rango</th>
                <th style={{ textAlign: 'right' }}>Monto {viewMode === 'presupuesto' ? 'Presupuestado' : 'Pendiente'}</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.map(d => (
                <React.Fragment key={d.semana}>
                  <tr 
                    className={`row-clickable ${d.semana === currentWeek ? 'row-highlight' : ''}`}
                    onClick={() => toggleWeek(d.semana)}
                  >
                    <td>
                      {expandedWeeks.has(d.semana) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>Semana {d.semana}</div>
                      <div className="text-xs text-muted">{getWeekRange(d.semana)}</div>
                    </td>
                    <td className="amount-cell" style={{ fontWeight: 600 }}>{formatCurrency(d.monto)}</td>
                  </tr>
                  
                  {expandedWeeks.has(d.semana) && (
                    <tr>
                      <td colSpan="4" style={{ padding: '0 0 15px 40px', background: '#f8fafc' }}>
                        <div className="expanded-detail-container">
                          <table className="detail-inner-table">
                            <thead>
                              <tr>
                                <th>Área</th>
                                <th>Nombre del Elemento</th>
                                <th style={{ textAlign: 'right' }}>Monto Semanal</th>
                                <th style={{ width: 80 }}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                                {d.lines.filter(l => l.allocatedAmount > 0).map((line, idx) => (
                                  <tr key={`${line.id || line.id_movimiento || idx}-${idx}`} style={line.isInvoice ? { background: '#fffbeb' } : {}}>
                                    <td><span className="badge badge-outline" style={line.isInvoice ? { borderColor: '#d97706', color: '#d97706' } : {}}>{line.area}</span></td>
                                    <td style={{ fontSize: '0.75rem' }}>{line.nombreElemento}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                      {formatCurrency(line.allocatedAmount)}
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        {line.isInvoice ? (
                                           <button 
                                             className="btn-icon-sm" 
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               toggleExclude(line.id_movimiento);
                                             }}
                                             title="Descartar del flujo"
                                             style={{ color: '#ef4444' }}
                                           >
                                             <X size={12} />
                                           </button>
                                        ) : (
                                          <button 
                                            className="btn-icon-sm" 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onEdit(line);
                                            }}
                                            title="Editar línea"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .segmented-control {
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          display: flex;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
        }
        .segmented-control button {
          border: none;
          padding: 6px 16px;
          border-radius: 7px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .segmented-control button.btn-primary {
          background: white;
          color: var(--primary-color);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        }
        .segmented-control button:hover:not(.btn-primary) {
          background: rgba(255,255,255,0.5);
        }
        
        .row-clickable { 
          cursor: pointer; 
          transition: background 0.2s;
        }
        .row-clickable:hover { 
          background: #f1f5f9; 
        }
        .row-highlight { 
          background: rgba(46, 49, 146, 0.03); 
          border-left: 3px solid var(--primary-color);
        }
        .expanded-detail-container {
          padding: 12px;
          border-radius: 0 0 8px 8px;
          border: 1px solid #e2e8f0;
          border-top: none;
          background: #fff;
          margin-right: 15px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .detail-inner-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .detail-inner-table th {
          text-align: left;
          padding: 6px 8px;
          color: #64748b;
          font-weight: 600;
          border-bottom: 1px solid #f1f5f9;
        }
        .detail-inner-table td {
          padding: 8px;
          border-bottom: 1px solid #f8fafc;
        }
        .btn-icon-sm {
          background: none;
          border: none;
          color: var(--primary-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
        }
        .btn-icon-sm:hover {
          background: #f1f5f9;
        }
      `}</style>
    </div>
  );
}


