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
  MapPin,
  ChevronRight
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
  category: string;
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: Home,
    path: '/',
    category: 'main'
  },
  {
    label: 'Planner',
    icon: Calendar,
    path: '/planner',
    category: 'gestione'
  },
  {
    label: 'Contabilità',
    icon: Calculator,
    path: '/contabilita',
    category: 'gestione'
  },
  {
    label: 'Fatture non contabilizzate',
    icon: FileText,
    path: '/fatture-non-contabilizzate',
    category: 'gestione'
  },
  {
    label: 'Spese',
    icon: CreditCard,
    path: '/spese',
    category: 'gestione'
  },
  {
    label: 'Comune e Catasto',
    icon: Building2,
    path: '/comune-catasto',
    category: 'gestione'
  },
  {
    label: 'APE',
    icon: FileCheck,
    path: '/ape',
    category: 'gestione'
  },
  {
    label: 'Varie',
    icon: FolderOpen,
    path: '/varie',
    category: 'gestione'
  },
  {
    label: 'Rubrica',
    icon: Users,
    path: '/rubrica',
    category: 'gestione'
  },
  {
    label: 'Parametri',
    icon: Settings,
    path: '/parametri',
    category: 'settings'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const gestioneItems = menuItems.filter(item => item.category === 'gestione');
  const mainItems = menuItems.filter(item => item.category === 'main');
  const settingsItems = menuItems.filter(item => item.category === 'settings');

  return (
    <>
      {/* Overlay per mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-30 w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-700/60 transform transition-all duration-300 ease-in-out flex flex-col backdrop-blur-xl',
        'lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-600 dark:bg-blue-700"></div>
          <div className="relative flex items-center justify-between p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight">Smart-Geo</span>
                <div className="text-xs opacity-90 font-medium">Gestione Professionale</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col p-4 space-y-6">
          {/* Main Items */}
          <div>
            {mainItems.map((item) => (
              <SidebarItem
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
                onClose={onClose}
              />
            ))}
          </div>

          {/* Gestione Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3">
              <div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div>
              <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider bg-slate-200/50 dark:bg-slate-700/50 px-3 py-1 rounded-full border border-slate-300/50 dark:border-slate-600/50">
                Gestione
              </span>
              <div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div>
            </div>
            <div className="space-y-1">
              {gestioneItems.map((item) => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  isActive={location.pathname === item.path}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>

          {/* Settings - Posizionato al fondo */}
          <div className="mt-auto">
            <div className="h-px bg-slate-300 dark:bg-slate-600 mb-4"></div>
            {settingsItems.map((item) => (
              <SidebarItem
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
                onClose={onClose}
              />
            ))}
          </div>
        </nav>
      </div>
    </>
  );
};

interface SidebarItemProps {
  item: MenuItem;
  isActive: boolean;
  onClose: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, isActive, onClose }) => {
  const { label, icon: Icon, path } = item;

  return (
    <NavLink
      to={path}
      onClick={onClose}
      className={clsx(
        'group flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ease-out relative overflow-hidden',
        isActive 
          ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-400/20 transform scale-[1.02]' 
          : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-800/50 hover:scale-[1.01] backdrop-blur-sm'
      )}
    >
      <div className="flex items-center space-x-3 relative z-10">
        <div className={clsx(
          'p-2 rounded-xl transition-all duration-300',
          isActive 
            ? 'bg-white/20 backdrop-blur-sm' 
            : 'bg-slate-200/50 dark:bg-slate-700/50 group-hover:bg-slate-300/60 dark:group-hover:bg-slate-600/60'
        )}>
          <Icon className="w-5 h-5 flex-shrink-0" />
        </div>
        <span className="font-semibold text-sm tracking-wide">{label}</span>
      </div>
      
      {/* Indicatore freccia per item attivo */}
      {isActive && (
        <ChevronRight className="w-4 h-4 opacity-80" />
      )}
      
      {/* Effetto glow per item attivo */}
      {isActive && (
        <div className="absolute inset-0 bg-blue-400/20 rounded-2xl blur-xl"></div>
      )}
    </NavLink>
  );
}; 