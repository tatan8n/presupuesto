import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ComposedChart, Line
} from 'recharts';
import { formatCurrency } from '../utils/formatters';
import { getWeekRange, getCurrentWeek } from '../utils/dateUtils';
import { Filter, Calendar, Info, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import SingleSelect from './SingleSelect';

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

  const effectiveStartWeek = startWeek === 'current' ? currentWeek : parseInt(startWeek);

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

  const aggregatedData = useMemo(() => {
    // 1. Las líneas ya vienen filtradas desde App.jsx
    let filteredLines = lines;

    // 2. Inicializar semanas
    const weeksMap = Array(52).fill(0).map((_, i) => ({
      semana: i + 1,
      presupuestado: 0,
      ejecutado: 0,
      lines: [] // Líneas que contribuyen a esta semana
    }));

    // 3. Asignar líneas a semanas
    filteredLines.forEach(line => {
      MONTH_FIELDS.forEach((m, monthIndex) => {
        const amount = line[m.key] || 0;
        if (amount === 0) return;

        let weekNumber;
        // Si tiene un día específico para este mes (de BudgetForm)
        if (line[m.dateKey]) {
          const day = parseInt(line[m.dateKey]);
          const date = new Date(2026, monthIndex, day);
          weekNumber = getCurrentWeek(date) - 1;
        } 
        // Si es una línea de Excel original con fecha serial única
        else if (line.fecha && typeof line.fecha === 'number') {
          const date = new Date((line.fecha - 25569) * 86400 * 1000);
          
          if (date.getMonth() === monthIndex) {
            weekNumber = getCurrentWeek(date) - 1;
          } else {
            // Fallback al último día del mes
            const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
            const defaultDate = new Date(2026, monthIndex, lastDay);
            weekNumber = getCurrentWeek(defaultDate) - 1;
          }
        } 
        // Por defecto: último día del mes correspondiente
        else {
          const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
          const defaultDate = new Date(2026, monthIndex, lastDay);
          weekNumber = getCurrentWeek(defaultDate) - 1;
        }

        weekNumber = Math.max(0, Math.min(51, weekNumber));
        weeksMap[weekNumber].presupuestado += amount;
        
        // Agregar línea al detalle de la semana (evitar duplicados si una línea afecta múltiples meses y cae en la misma semana?)
        // En este presupuesto, una línea suele tener fecha única o distribución mensual.
        // Si tiene fecha única, caerá en 1 semana. Si es mensual sín fecha, tomamos fin de mes.
        // Para simplificar, agregamos la línea y el monto específico de ese mes.
        weeksMap[weekNumber].lines.push({
          ...line,
          allocatedAmount: amount,
          allocatedMonth: m.key
        });
      });
    });

    return weeksMap.filter(w => w.semana >= effectiveStartWeek && w.semana < effectiveStartWeek + displayWeeks);
  }, [lines, displayWeeks, effectiveStartWeek]);

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
            <Bar dataKey="presupuestado" fill="var(--primary-color)" opacity={0.7} radius={[4, 4, 0, 0]} />
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
                <th style={{ textAlign: 'right' }}>Presupuestado</th>
                <th style={{ textAlign: 'right' }}>Diferencia</th>
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
                    <td className="amount-cell">{formatCurrency(d.presupuestado)}</td>
                    <td className="amount-cell">{formatCurrency(d.presupuestado - d.ejecutado)}</td>
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
                                <th>Cuenta</th>
                                <th style={{ textAlign: 'right' }}>Monto Semanal</th>
                                <th style={{ width: 40 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.lines.map((line, idx) => (
                                <tr key={`${line.id}-${idx}`}>
                                  <td><span className="badge badge-outline">{line.area}</span></td>
                                  <td style={{ fontSize: '0.75rem' }}>{line.nombreElemento}</td>
                                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{line.cuenta}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                    {formatCurrency(line.allocatedAmount)}
                                  </td>
                                  <td>
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
        .filter-info-banner {
          background: rgba(46, 49, 146, 0.05);
          padding: 10px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
          color: var(--primary-color);
          border: 1px solid rgba(46, 49, 146, 0.1);
        }
      `}</style>
    </div>
  );
}


