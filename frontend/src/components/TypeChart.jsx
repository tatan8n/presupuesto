import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts';
import { formatCurrency } from '../utils/formatters';

const COLORS = {
  'Gasto': '#E74C3C',
  'Costo': '#F39C12',
  'Inversión': '#2E3192',
  'Ingreso': '#27AE60',
};

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

export default function TypeChart({ data, onChartClick }) {
  if (!data || Object.keys(data).length === 0) return null;

  const chartData = Object.entries(data).map(([name, val]) => ({
    name,
    'P. Inicial': val.presupuestoInicial || 0,
    'P. Actual': val.presupuesto || 0,
    ejecutado: val.ejecutado || 0,
  })).sort((a, b) => b['P. Actual'] - a['P. Actual']);

  const handleClick = (data, index) => {
    if (onChartClick && data && data.name) {
      onChartClick('icgi', data.name);
    }
  };

  return (
    <div className="chart-card">
      <div className="chart-card-title">Presupuesto por Tipo (ICGI) (Inicial vs Actual)</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#1A1D3B', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.85rem' }} />
          <Bar 
            dataKey="P. Inicial" 
            fill="#d1d5db" 
            radius={[6, 6, 0, 0]} 
            barSize={30}
            onClick={handleClick}
            style={{ cursor: onChartClick ? 'pointer' : 'default' }}
          />
          <Bar 
            dataKey="P. Actual" 
            radius={[6, 6, 0, 0]} 
            barSize={30}
            onClick={handleClick}
            style={{ cursor: onChartClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#3498DB'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
