import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { formatCurrency } from '../utils/formatters';

const ICGI_COLORS = {
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
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 500 }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function LineaICGIChart({ data, onChartClick }) {
  if (!data || Object.keys(data).length === 0) return null;

  // Collect all ICGI types present across all lineas
  const allICGITypes = new Set();
  Object.values(data).forEach(icgiMap => {
    Object.keys(icgiMap).forEach(type => allICGITypes.add(type));
  });
  const icgiTypes = [...allICGITypes].sort();

  // Transform data for stacked bars: each row = one business line, each key = ICGI type
  const chartData = Object.entries(data)
    .map(([linea, icgiMap]) => {
      const row = { name: linea };
      let total = 0;
      icgiTypes.forEach(type => {
        row[type] = icgiMap[type] || 0;
        total += row[type];
      });
      row._total = total;
      return row;
    })
    .sort((a, b) => b._total - a._total);

  const handleClick = (data) => {
    if (onChartClick && data && data.name) {
      onChartClick('linea', data.name);
    }
  };

  return (
    <div className="chart-card">
      <div className="chart-card-title">ICGI por Línea de Negocio</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#1A1D3B', fontWeight: 500 }}
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
          {icgiTypes.map(type => (
            <Bar
              key={type}
              dataKey={type}
              stackId="icgi"
              fill={ICGI_COLORS[type] || '#3498DB'}
              radius={icgiTypes.indexOf(type) === icgiTypes.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              onClick={handleClick}
              style={{ cursor: onChartClick ? 'pointer' : 'default' }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
