import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Legend
} from 'recharts';
import { formatCurrency } from '../utils/formatters';

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
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function MonthlyLineChart({ data, onChartClick }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map(val => ({
    ...val,
    'P. Inicial': val.presupuestadoInicial || 0, // Using standard mapped field once updated in backend
    'P. Actual': val.presupuestado || 0,
    ejecutado: val.ejecutado || 0,
  }));

  const handleClick = (data) => {
    if (onChartClick && data && data.activePayload && data.activePayload.length > 0) {
      const mesKey = data.activePayload[0].payload.mesKey;
      if (mesKey) {
        onChartClick('mes', mesKey);
      }
    }
  };

  return (
    <div className="chart-card">
      <div className="chart-card-title">Presupuesto Mensual (Inicial vs Actual)</div>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }} onClick={handleClick} style={{ cursor: onChartClick ? 'pointer' : 'default' }}>
          <defs>
            <linearGradient id="gradPresupuestoActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1A8B8D" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1A8B8D" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradPresupuestoInicial" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#d1d5db" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradEjecutado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#E74C3C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v ? v.substring(0, 3) : ''}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.85rem' }} />
          <Area
            type="monotone"
            dataKey="P. Inicial"
            stroke="#9ca3af"
            strokeWidth={2}
            fill="url(#gradPresupuestoInicial)"
            dot={{ r: 3, fill: '#9ca3af', strokeWidth: 2, stroke: '#fff' }}
            strokeDasharray="4 4"
          />
          <Area
            type="monotone"
            dataKey="P. Actual"
            stroke="#1A8B8D"
            strokeWidth={2.5}
            fill="url(#gradPresupuestoActual)"
            dot={{ r: 4, fill: '#1A8B8D', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#1A8B8D' }}
          />
          {/* Ocultamos ejecutado si no tiene sentido, o lo dejamos como antes. Lo dejamos para consistencia. */}
          <Area
            type="monotone"
            dataKey="ejecutado"
            stroke="#E74C3C"
            strokeWidth={2}
            fill="url(#gradEjecutado)"
            dot={{ r: 3, fill: '#E74C3C', strokeWidth: 2, stroke: '#fff' }}
            strokeDasharray="5 3"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
