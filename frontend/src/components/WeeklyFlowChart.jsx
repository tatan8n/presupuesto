import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ComposedChart, Line
} from 'recharts';
import { formatCurrency } from '../utils/formatters';
import MultiSelect from './MultiSelect';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontSize: '0.82rem'
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Semana {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function WeeklyFlowChart({ data, filters, filterOptions, onFilterChange }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <p>Carga el presupuesto para ver el flujo semanal</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
        Flujo de Caja Semanal Estimado
      </h2>

      <div className="filters-bar">
        <MultiSelect
          id="weekly-filter-area"
          options={filterOptions?.areas || []}
          value={Array.isArray(filters.area) ? filters.area : (filters.area ? filters.area.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, area: val })}
          placeholder="Todas las Áreas"
        />

        <MultiSelect
          id="weekly-filter-linea"
          options={filterOptions?.lineas || []}
          value={Array.isArray(filters.linea) ? filters.linea : (filters.linea ? filters.linea.split(',') : [])}
          onChange={(val) => onFilterChange({ ...filters, linea: val })}
          placeholder="Todas las Líneas"
        />
      </div>

      {/* Gráfico */}
      <div className="chart-card">
        <div className="chart-card-title">Distribución Presupuestaria por Semana (2026)</div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="gradWeekly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2E3192" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2E3192" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="semana"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              interval={3}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v)}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="presupuestado" name="Presupuestado" fill="url(#gradWeekly)" radius={[3, 3, 0, 0]} barSize={10} />
            <Line type="monotone" dataKey="ejecutado" name="Ejecutado" stroke="#E74C3C" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla resumen */}
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-header">
          <div className="table-title">Detalle por Semana</div>
        </div>
        <div className="table-wrapper" style={{ maxHeight: 400 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Semana</th>
                <th style={{ textAlign: 'right' }}>Presupuestado</th>
                <th style={{ textAlign: 'right' }}>Ejecutado</th>
                <th style={{ textAlign: 'right' }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {data.filter(d => d.presupuestado > 0).map(d => (
                <tr key={d.semana}>
                  <td>Semana {d.semana}</td>
                  <td className="amount-cell">{formatCurrency(d.presupuestado)}</td>
                  <td className="amount-cell">{formatCurrency(d.ejecutado)}</td>
                  <td className={`amount-cell ${(d.presupuestado - d.ejecutado) >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                    {formatCurrency(d.presupuestado - d.ejecutado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
