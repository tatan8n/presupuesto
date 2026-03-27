import { DollarSign, TrendingDown, TrendingUp, Target, ArrowLeftRight } from 'lucide-react';
import { formatCurrency, formatPercentage } from '../utils/formatters';

export default function KPICards({ kpis }) {
  if (!kpis) return null;

  // Diferencia entre Ppto. Inicial y Actual (cuánto cambió el presupuesto vs lo aprobado)
  const diferencia = (kpis.totalPresupuestoInicial || 0) - (kpis.totalPresupuesto || 0);

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
      label: 'Diferencia (Inicial − Actual)',
      value: formatCurrency(Math.abs(diferencia)),
      sub: diferencia > 0 ? '↑ Inicial mayor al actual' : diferencia < 0 ? '↑ Actual mayor al inicial' : 'Sin variación',
      icon: ArrowLeftRight,
      type: 'difference',
      valueClass: diferencia > 0 ? 'success' : diferencia < 0 ? 'danger' : '',
    },
    {
      key: 'compliance',
      label: '% Ejecución',
      value: formatPercentage(kpis.porcentajeEjecucion || 0),
      sub: `Sobre P. Inicial: ${formatPercentage(kpis.porcentajeEjecucionInicial || 0)}`,
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
            <div
              className={`kpi-value ${card.valueClass || ''}`}
              style={card.key === 'budget-combined' ? { fontSize: '1.1rem' } : {}}
            >
              {card.value}
            </div>
            <div className="kpi-sub">{card.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
