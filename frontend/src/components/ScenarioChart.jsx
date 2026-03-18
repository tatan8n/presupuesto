import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, Legend
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

const COLORS = ['#2E3192', '#1A8B8D', '#F39C12', '#E74C3C'];

export default function ScenarioChart({ data, onChartClick }) {
  if (!data || Object.keys(data).length === 0) return null;

  const chartData = Object.entries(data).map(([key, val]) => ({
    name: key, // name is just the number for the query
    displayName: `Escenario ${key}`,
    'P. Inicial': val.presupuestoInicial || 0,
    'P. Actual': val.presupuesto || 0,
    ejecutado: val.ejecutado || 0,
  }));

  const handleClick = (data, index) => {
    if (onChartClick && data && data.name) {
      onChartClick('escenario', data.name);
    }
  };

  return (
    <div className="chart-card">
      <div className="chart-card-title">Presupuesto por Escenario (Inicial vs Actual)</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="displayName"
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
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
