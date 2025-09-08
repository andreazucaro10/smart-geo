import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, User, LogOut, Settings, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const { user, signOut } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  const handleUserMenuToggle = () => {
    if (userMenuOpen) {
      // Start fade out animation
      setIsAnimatingOut(true);
    } else {
      // Open menu
      setUserMenuOpen(true);
      setIsAnimatingOut(false);
    }
  };

  useEffect(() => {
    if (isAnimatingOut) {
      const timer = setTimeout(() => {
        setUserMenuOpen(false);
        setIsAnimatingOut(false);
      }, 200); // Match animation duration

      return () => clearTimeout(timer);
    }
  }, [isAnimatingOut]);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 transition-colors min-h-[3.5rem] max-h-[3.5rem]">
      <div className="flex items-center justify-between h-full">
        {/* Left Side */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <Menu className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          
          {/* Page Title */}
          <div className="hidden sm:block min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              Smart-Geo
            </h1>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Notifications */}
          
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={handleUserMenuToggle}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors max-w-[200px]"
            >
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3 text-white" />
              </div>
              <div className="hidden lg:block text-left min-w-0">
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.name || user?.username || 'Utente'} {user?.surname ? user?.surname.charAt(0).toUpperCase() + user?.surname.slice(1) : ''}
                </div>
              </div>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-10"
                  onClick={handleUserMenuToggle}
                />
                
                {/* Menu */}
                <div className={`absolute right-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 ${
                  isAnimatingOut ? 'animate-fade-out-up' : 'animate-fade-in-down'
                }`}>
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user?.name || user?.username || 'Utente'} {user?.surname ? user?.surname.charAt(0).toUpperCase() + user?.surname.slice(1) : ''}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.email || ''}
                    </div>
                  </div>
                  
                  <div className="py-1">
                    <button 
                      onClick={toggleTheme}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                      {isDark ? 'Modalità chiara' : 'Modalità scura'}
                    </button>
                    
                    <button
                      onClick={() => navigate('/user-settings')}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Impostazioni
                    </button>
                    
                    <button 
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Disconnetti
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};