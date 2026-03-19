import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SingleSelect({ options, value, onChange, placeholder, label, id, width = 160 }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setIsOpen(false);
  };

  // Encontrar el label actual
  const currentOption = options.find(opt => opt.value === value);
  const displayValue = currentOption ? currentOption.label : (placeholder || 'Seleccionar');

  return (
    <div className="single-select" ref={containerRef} style={{ position: 'relative', minWidth: width }}>
      {label && <span className="filter-label" style={{ marginBottom: 4, display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>}
      
      <button 
        id={id}
        type="button"
        className="filter-select"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          textAlign: 'left', 
          background: 'var(--bg-card)', 
          cursor: 'pointer', 
          padding: '8px 12px', 
          border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-md)',
          minHeight: '38px'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
          {displayValue}
        </span>
        <ChevronDown 
          style={{ 
            width: 14, 
            height: 14, 
            opacity: 0.6, 
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--transition-fast)'
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)', zIndex: 100, display: 'flex', flexDirection: 'column',
          maxHeight: 250, overflowY: 'auto'
        }}>
          {options.map(opt => (
            <div 
              key={opt.value}
              onClick={() => handleSelect(opt)}
              style={{
                padding: '10px 12px', 
                cursor: 'pointer', 
                fontSize: '0.85rem',
                background: value === opt.value ? 'rgba(46, 49, 146, 0.05)' : 'transparent',
                color: value === opt.value ? 'var(--primary)' : 'var(--text-primary)',
                fontWeight: value === opt.value ? 600 : 400,
                transition: 'all var(--transition-fast)'
              }}
              className="select-option-hover"
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
      
      <style>{`
        .select-option-hover:hover {
          background: var(--bg-primary) !important;
          color: var(--primary) !important;
        }
      `}</style>
    </div>
  );
}
