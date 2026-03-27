import { LayoutDashboard, Table2, CalendarDays, Settings, Upload, RefreshCw, ArrowLeftRight } from 'lucide-react';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Principal' },
  { key: 'detalle', label: 'Detalle Presupuesto', icon: Table2, section: 'Principal' },
  { key: 'semanal', label: 'Flujo Semanal', icon: CalendarDays, section: 'Principal' },
  { key: 'traslados', label: 'Traslados', icon: ArrowLeftRight, section: 'Principal' },
  { key: 'importar', label: 'Importar Excel', icon: Upload, section: 'Datos' },
  { key: 'dolibarr', label: 'Sincronizar Dolibarr', icon: RefreshCw, section: 'Datos' },
  { key: 'configuracion', label: 'Configuración', icon: Settings, section: 'Sistema' },
];


export default function Sidebar({ currentView, onNavigate }) {
  let lastSection = '';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/logo.png" alt="Logo" className="sidebar-logo" />
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">Presupuesto</div>
          <div className="sidebar-brand-sub">Control 2026</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const showSection = item.section !== lastSection;
          if (showSection) lastSection = item.section;
          const Icon = item.icon;

          return (
            <div key={item.key}>
              {showSection && (
                <div className="sidebar-section-title">{item.section}</div>
              )}
              <button
                className={`sidebar-item ${currentView === item.key ? 'active' : ''}`}
                onClick={() => onNavigate(item.key)}
              >
                <Icon />
                {item.label}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        © 2026 Control Presupuestario <br />
        <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>v1.2.0-mejoras</span>
      </div>
    </aside>
  );
}
