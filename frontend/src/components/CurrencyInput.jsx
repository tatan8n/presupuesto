import { useState, useEffect } from 'react';

export default function CurrencyInput({ value, onChange, placeholder, disabled, id, className = "form-input" }) {
  const [displayValue, setDisplayValue] = useState('');
  
  // Update internal display state when value props change externally
  useEffect(() => {
    if (value === undefined || value === null || value === '') {
      setDisplayValue('');
    } else {
      setDisplayValue(Math.round(Number(value)).toLocaleString('es-CO'));
    }
  }, [value]);

  const handleChange = (e) => {
    let raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const num = parseInt(raw, 10);
    setDisplayValue(num.toLocaleString('es-CO'));
    onChange(num);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <span style={{ 
        position: 'absolute', 
        left: 10, 
        top: '50%', 
        transform: 'translateY(-50%)', 
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontSize: '0.9rem',
        pointerEvents: 'none'
      }}>
        $
      </span>
      <input
        id={id}
        type="text"
        className={className}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{ paddingLeft: 24, textAlign: 'right', ...(disabled ? { backgroundColor: 'var(--bg-card)' } : {}) }}
      />
    </div>
  );
}
