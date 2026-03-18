export default function ICGIToggle({ options = [], value = [], onChange }) {
  const toggleOption = (opt) => {
    let newValue;
    if (value.includes(opt)) {
      newValue = value.filter(v => v !== opt);
    } else {
      newValue = [...value, opt];
    }
    onChange(newValue);
  };

  const colorMap = {
    'Gasto': { bg: '#FEE2E2', border: '#EF4444', text: '#B91C1C', activeBg: '#EF4444', activeText: '#fff' },
    'Costo': { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', activeBg: '#F59E0B', activeText: '#fff' },
    'Inversión': { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF', activeBg: '#3B82F6', activeText: '#fff' },
    'Ingreso': { bg: '#D1FAE5', border: '#10B981', text: '#065F46', activeBg: '#10B981', activeText: '#fff' },
  };

  const defaultColor = { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151', activeBg: '#6B7280', activeText: '#fff' };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: 4 }}>Tipo:</span>
      {options.map(opt => {
        const isActive = value.includes(opt);
        const c = colorMap[opt] || defaultColor;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggleOption(opt)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: `1.5px solid ${c.border}`,
              background: isActive ? c.activeBg : c.bg,
              color: isActive ? c.activeText : c.text,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              opacity: isActive ? 1 : 0.7,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
