import { useState, useMemo } from 'react';
import { formatCurrency } from '../utils/formatters';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const CATEGORIES = [
  {
    key: 'ingresos',
    label: 'Ingresos',
    icon: TrendingUp,
    color: '#27AE60',
    bgColor: 'rgba(39, 174, 96, 0.08)',
    borderColor: 'rgba(39, 174, 96, 0.3)',
    match: (line) => (line.cuenta || '').startsWith('01'),
  },
  {
    key: 'comisiones',
    label: 'Comisiones y bonos',
    icon: Minus,
    color: '#8E44AD',
    bgColor: 'rgba(142, 68, 173, 0.08)',
    borderColor: 'rgba(142, 68, 173, 0.3)',
    match: (line) => {
      const cc = (line.cuentaContable || '').toLowerCase();
      return cc.includes('comision') || cc.includes('bonificacion');
    },
  },
  {
    key: 'ica',
    label: 'Industria y comercio',
    icon: Minus,
    color: '#2980B9',
    bgColor: 'rgba(41, 128, 185, 0.08)',
    borderColor: 'rgba(41, 128, 185, 0.3)',
    match: (line) => (line.cuentaContable || '').toLowerCase().includes('industria y comercio'),
  },
  {
    key: 'materiales',
    label: 'Materiales y CIF',
    icon: Minus,
    color: '#E67E22',
    bgColor: 'rgba(230, 126, 34, 0.08)',
    borderColor: 'rgba(230, 126, 34, 0.3)',
    match: (line) => (line.cuentaContable || '').toLowerCase().includes('compra implemento'),
  },
  {
    key: 'costos',
    label: 'Costos, gastos fijos e inversiones',
    icon: Minus,
    color: '#E74C3C',
    bgColor: 'rgba(231, 76, 60, 0.08)',
    borderColor: 'rgba(231, 76, 60, 0.3)',
    match: null, // Catch-all
  },
];

export default function EERRSummary({ lines = [], onFilterCategory }) {
  const [selectedKey, setSelectedKey] = useState(null);

  const categoryData = useMemo(() => {
    const data = {};
    CATEGORIES.forEach(cat => {
      data[cat.key] = { total: 0, totalInicial: 0, accounts: new Set() };
    });

    (lines || []).forEach(line => {
      const isDeleted = line.estado === 'eliminada';
      const pInicial = line.totalOriginal || 0;
      const pActual = isDeleted ? 0 : (line.total || 0);

      let matched = false;
      for (const cat of CATEGORIES) {
        if (cat.match && cat.match(line)) {
          data[cat.key].total += pActual;
          data[cat.key].totalInicial += pInicial;
          if (line.cuentaContable) data[cat.key].accounts.add(line.cuentaContable);
          matched = true;
          break;
        }
      }
      if (!matched) {
        data['costos'].total += pActual;
        data['costos'].totalInicial += pInicial;
        if (line.cuentaContable) data['costos'].accounts.add(line.cuentaContable);
      }
    });

    return data;
  }, [lines]);

  const utilidad = (categoryData.ingresos?.total || 0) -
    (categoryData.comisiones?.total || 0) -
    (categoryData.ica?.total || 0) -
    (categoryData.materiales?.total || 0) -
    (categoryData.costos?.total || 0);

  const utilidadInicial = (categoryData.ingresos?.totalInicial || 0) -
    (categoryData.comisiones?.totalInicial || 0) -
    (categoryData.ica?.totalInicial || 0) -
    (categoryData.materiales?.totalInicial || 0) -
    (categoryData.costos?.totalInicial || 0);

  const handleRowClick = (cat) => {
    const newKey = selectedKey === cat.key ? null : cat.key;
    setSelectedKey(newKey);
    if (newKey && onFilterCategory) {
      onFilterCategory([...categoryData[newKey].accounts]);
    } else if (onFilterCategory) {
      onFilterCategory(null);
    }
  };

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="chart-card-title">Estado de Resultados Resumido</div>

      {/* Columna Headers */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4, paddingRight: 2 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: 90, textAlign: 'right', fontWeight: 600 }}>P. Inicial</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: 90, textAlign: 'right', fontWeight: 600 }}>P. Actual</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {CATEGORIES.map(cat => {
            const isSelected = selectedKey === cat.key;
            const Icon = cat.icon;
            const total = categoryData[cat.key]?.total || 0;
            const totalInicial = categoryData[cat.key]?.totalInicial || 0;

            return (
              <div
                key={cat.key}
                onClick={() => handleRowClick(cat)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${isSelected ? cat.color : cat.borderColor}`,
                  background: isSelected ? cat.bgColor : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 2px 8px ${cat.borderColor}` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: cat.bgColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon style={{ width: 14, height: 14, color: cat.color }} />
                  </div>
                  <span style={{
                    fontSize: '0.82rem', fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? cat.color : 'var(--text-primary)',
                    lineHeight: 1.3
                  }}>
                    {cat.label}
                  </span>
                </div>
                {/* Columnas Inicial / Actual */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600,
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap', width: 90, textAlign: 'right'
                  }}>
                    {formatCurrency(totalInicial)}
                  </span>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: 700,
                    color: cat.key === 'ingresos' ? '#27AE60' : 'var(--text-primary)',
                    whiteSpace: 'nowrap', width: 90, textAlign: 'right'
                  }}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Utilidad Operativa */}
        <div style={{
          marginTop: 12,
          padding: '12px 14px',
          borderRadius: 10,
          background: utilidad >= 0
            ? 'linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(39, 174, 96, 0.03) 100%)'
            : 'linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(231, 76, 60, 0.03) 100%)',
          border: `1.5px solid ${utilidad >= 0 ? 'rgba(39, 174, 96, 0.4)' : 'rgba(231, 76, 60, 0.4)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: utilidad >= 0 ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {utilidad >= 0
                ? <TrendingUp style={{ width: 14, height: 14, color: '#27AE60' }} />
                : <TrendingDown style={{ width: 14, height: 14, color: '#E74C3C' }} />
              }
            </div>
            <span style={{
              fontSize: '0.85rem', fontWeight: 700,
              color: utilidad >= 0 ? '#27AE60' : '#E74C3C'
            }}>
              Utilidad Operativa
            </span>
          </div>
          {/* Columnas Inicial / Actual */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <span style={{
              fontSize: '0.82rem', fontWeight: 700,
              color: utilidadInicial >= 0 ? 'rgba(39, 174, 96, 0.7)' : 'rgba(231, 76, 60, 0.7)',
              whiteSpace: 'nowrap', width: 90, textAlign: 'right'
            }}>
              {formatCurrency(utilidadInicial)}
            </span>
            <span style={{
              fontSize: '0.95rem', fontWeight: 800,
              color: utilidad >= 0 ? '#27AE60' : '#E74C3C',
              whiteSpace: 'nowrap', width: 90, textAlign: 'right'
            }}>
              {formatCurrency(utilidad)}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          Clic en una categoría para filtrar • Utilidad = Ingresos − Egresos
        </div>
      </div>
    </div>
  );
}
