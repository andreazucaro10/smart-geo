import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  Calculator, 
  FileText, 
  CreditCard,
  Building2,
  FileCheck,
  FolderOpen,
  Users,
  Settings,
  X
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  category: 'navigazione' | 'strumenti' | 'impostazioni';
}

const menuItems: MenuItem[] = [
  // Navigazione principale
  {
    label: 'Dashboard',
    icon: Home,
    path: '/',
    category: 'navigazione'
  },
  {
    label: 'Planner',
    icon: Calendar,
    path: '/planner',
    category: 'navigazione'
  },
  {
    label: 'Comune e Catasto',
    icon: Building2,
    path: '/comune-catasto',
    category: 'navigazione'
  },
  {
    label: 'APE',
    icon: FileCheck,
    path: '/ape',
    category: 'navigazione'
  },
  {
    label: 'Varie',
    icon: FolderOpen,
    path: '/varie',
    category: 'navigazione'
  },
  // Strumenti
  {
    label: 'Contabilità',
    icon: Calculator,
    path: '/contabilita',
    category: 'strumenti'
  },
  {
    label: 'Fatture non contabilizzate',
    icon: FileText,
    path: '/fatture-non-contabilizzate',
    category: 'strumenti'
  },
  {
    label: 'Spese',
    icon: CreditCard,
    path: '/spese',
    category: 'strumenti'
  },
  {
    label: 'Rubrica',
    icon: Users,
    path: '/rubrica',
    category: 'strumenti'
  },
  // Impostazioni
  {
    label: 'Parametri',
    icon: Settings,
    path: '/parametri',
    category: 'impostazioni'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();

  const navigazioneItems = menuItems.filter(item => item.category === 'navigazione');
  const strumentiItems = menuItems.filter(item => item.category === 'strumenti');
  const impostazioniItems = menuItems.filter(item => item.category === 'impostazioni');

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const NavItem = ({ item }: { item: MenuItem }) => (
    <NavLink
      to={item.path}
      onClick={onClose}
      className={clsx(
        'sidebar-item group relative',
        isActive(item.path) && 'sidebar-item-active'
      )}
    >
      {isActive(item.path) && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-signal-500 rounded-r" />
      )}
      <item.icon className={clsx(
        'w-5 h-5 flex-shrink-0',
        isActive(item.path) ? 'text-signal-500' : 'text-ink-400 group-hover:text-white'
      )} />
      <span className="sidebar-label truncate">{item.label}</span>
    </NavLink>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-ink-900/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-ink-800 transition-all duration-200',
        'w-sidebar lg:relative',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-topbar px-4 border-b border-ink-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-signal-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14z"/>
                <circle cx="12" cy="14" r="2"/>
              </svg>
            </div>
            <span className="font-display text-lg font-bold text-white tracking-tight">
              SMART-GEO
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-ink-400 hover:text-white hover:bg-ink-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {/* Navigazione */}
          <div>
            <div className="px-3 mb-2">
              <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Navigazione
              </span>
            </div>
            <div className="space-y-1">
              {navigazioneItems.map(item => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          </div>

          {/* Strumenti */}
          <div>
            <div className="px-3 mb-2">
              <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Strumenti
              </span>
            </div>
            <div className="space-y-1">
              {strumentiItems.map(item => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          </div>

          {/* Impostazioni */}
          <div>
            <div className="px-3 mb-2">
              <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">
                Impostazioni
              </span>
            </div>
            <div className="space-y-1">
              {impostazioniItems.map(item => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-ink-700">
          <div className="text-xs text-ink-500 text-center">
            · Smart-Geo ·
          </div>
        </div>
      </aside>
    </>
  );
};
