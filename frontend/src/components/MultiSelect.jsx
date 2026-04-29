import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export default function MultiSelect({ options, value = [], onChange, placeholder, label, id, renderLabel, width }) {
  /**
   * Resuelve la etiqueta visible de una opción.
   * Si renderLabel está definido, lo usa (permite mostrar nombres amigables para UUIDs, etc.).
   * Si no, aplica la lógica por defecto (números → "Escenario N", strings → tal cual).
   */
  const getLabel = (opt) => {
    if (renderLabel) return renderLabel(opt);
    return typeof opt === 'number' ? `Escenario ${opt}` : String(opt);
  };
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const toggleOption = (opt) => {
    let newValue;
    if (value.includes(opt)) {
      newValue = value.filter(v => v !== opt);
    } else {
      newValue = [...value, opt];
    }
    onChange(newValue);
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    onChange([...options]);
  };

  const handleSelectNone = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayLabel = label || placeholder || 'Filtro';

  const displayValue = value.length === 0 ? displayLabel : 
                       value.length === 1 ? getLabel(value[0]) : 
                       value.length === options.length ? displayLabel :
                       `${value.length} seleccionadas`;

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerSearch = searchTerm.toLowerCase();
    return options.filter(opt => 
      getLabel(opt).toLowerCase().includes(lowerSearch)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, searchTerm, renderLabel]);

  return (
    <div className="multi-select" ref={containerRef} style={{ position: 'relative', minWidth: width || 220, width: width }}>
      {/* Target button */}
      <button 
        id={id}
        type="button"
        className="filter-select"
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: 'var(--bg-card)', cursor: 'pointer', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
          {displayValue}
        </span>
        <ChevronDown style={{ width: 14, height: 14, opacity: 0.6, flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)', zIndex: 100, display: 'flex', flexDirection: 'column', 
        }}>
          {/* Header Controls */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '6px 8px 6px 28px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.85rem' }}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button 
                type="button" 
                onClick={handleSelectAll} 
                style={{ flex: 1, padding: '4px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Todas
              </button>
              <button 
                type="button" 
                onClick={handleSelectNone} 
                style={{ flex: 1, padding: '4px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Ninguna
              </button>
            </div>
          </div>

          {/* List Options */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Sin resultados
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = value.includes(opt);
                const label = getLabel(opt);
                return (
                  <div 
                    key={opt}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(opt);
                    }}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      background: isSelected ? 'rgba(46, 49, 146, 0.05)' : 'transparent',
                      color: 'var(--text-primary)', fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ 
                      width: 16, height: 16, borderRadius: 4, border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {isSelected && <Check style={{ color: '#fff', width: 12, height: 12 }} />}
                    </div>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
