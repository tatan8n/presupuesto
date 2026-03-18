import { DollarSign, TrendingDown, TrendingUp, Target } from 'lucide-react';
import { formatCurrency, formatPercentage } from '../utils/formatters';

export default function KPICards({ kpis }) {
  if (!kpis) return null;

  const cards = [
    {
      key: 'budget-combined',
      label: 'Presupuesto Inicial / Actual',
      value: `${formatCurrency(kpis.totalPresupuestoInicial || 0)} / ${formatCurrency(kpis.totalPresupuesto || 0)}`,
      sub: `${kpis.totalLines || 0} líneas activas`,
      icon: DollarSign,
      type: 'budget',
    },
    {
      key: 'expenses',
      label: 'Ejecutado',
      value: formatCurrency(kpis.totalEjecutado || 0),
      sub: 'Total acumulado',
      icon: TrendingDown,
      type: 'expenses',
      valueClass: kpis.totalEjecutado > 0 ? 'danger' : '',
    },
    {
      key: 'difference',
      label: 'Diferencia (Actual)',
      value: formatCurrency(kpis.saldo || 0),
      sub: 'Saldo disponible',
      icon: TrendingUp,
      type: 'difference',
      valueClass: kpis.saldo >= 0 ? 'success' : 'danger',
    },
    {
      key: 'compliance',
      label: '% de Ejecución',
      value: formatPercentage(kpis.porcentajeEjecucion || 0),
      sub: 'Sobre P. Actual',
      icon: Target,
      type: 'compliance',
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.key} className={`kpi-card ${card.type}`}>
            <div className="kpi-label">
              <Icon />
              {card.label}
            </div>
            <div className={`kpi-value ${card.valueClass || ''}`} style={card.key === 'budget-combined' ? { fontSize: '1.1rem' } : {}}>
              {card.value}
            </div>
            <div className="kpi-sub">{card.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
