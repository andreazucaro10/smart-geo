import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, User, LogOut, Settings, Moon, Sun, Search, ChevronRight, Building2, FileCheck, Users, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { searchAll, type SearchResult, type SearchTable } from '../../services/search';

interface HeaderProps {
  onMenuClick: () => void;
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/planner': 'Planner',
  '/comune-catasto': 'Comune e Catasto',
  '/ape': 'APE',
  '/varie': 'Varie',
  '/contabilita': 'Contabilità',
  '/spese': 'Spese',
  '/rubrica': 'Rubrica',
  '/parametri': 'Parametri',
  '/user-settings': 'Impostazioni',
};

const tableLabels: Record<SearchTable, string> = {
  comune_catasto: 'Comune e Catasto',
  ape: 'APE',
  varie: 'Varie',
  rubrica: 'Rubrica',
};

const tableIcons: Record<SearchTable, React.ComponentType<{ className?: string }>> = {
  comune_catasto: Building2,
  ape: FileCheck,
  varie: Building2,
  rubrica: Users,
};

export const Header: React.FC<HeaderProps> = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = pageTitles[location.pathname] || 'Dashboard';
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const { user, signOut } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();

  // Inline search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const runSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchAll(term);
      setSearchResults(results);
      setHighlightedIndex(results.length > 0 ? 0 : -1);
    } catch (error) {
      console.error('Errore ricerca:', error);
      setSearchResults([]);
      setHighlightedIndex(-1);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, runSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcut for Cmd+K / Ctrl+K - focus the search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsDropdownOpen(true);
  };

  const handleSearchFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsDropdownOpen(true);
  };

  const handleSearchBlur = () => {
    // Delay to allow click on dropdown items
    blurTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 150);
  };

  const handleResultSelect = (result: SearchResult) => {
    navigate(result.route);
    setSearchQuery('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    searchInputRef.current?.blur();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[highlightedIndex]) {
        handleResultSelect(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setSearchResults([]);
      setIsDropdownOpen(false);
      searchInputRef.current?.blur();
    }
  };

  // Group results by table (preserving table order)
  const groupedResults = (() => {
    const order: SearchTable[] = ['comune_catasto', 'ape', 'varie', 'rubrica'];
    const groups: Record<SearchTable, SearchResult[]> = {
      comune_catasto: [],
      ape: [],
      varie: [],
      rubrica: [],
    };
    for (const result of searchResults) {
      groups[result.table].push(result);
    }
    return order
      .map((table) => ({ table, items: groups[table] }))
      .filter((g) => g.items.length > 0);
  })();

  const showDropdown =
    isDropdownOpen && (searchQuery.trim().length >= 2 || isSearching);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  const handleUserMenuToggle = () => {
    if (userMenuOpen) {
      setIsAnimatingOut(true);
    } else {
      setUserMenuOpen(true);
      setIsAnimatingOut(false);
    }
  };

  useEffect(() => {
    if (isAnimatingOut) {
      const timer = setTimeout(() => {
        setUserMenuOpen(false);
        setIsAnimatingOut(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isAnimatingOut]);

  return (
    <header className="h-topbar bg-white border-b border-ink-200 px-4 flex items-center justify-between flex-shrink-0">
      {/* Left Side */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-ink-500 hover:text-ink-700 hover:bg-ink-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 text-sm text-ink-500">
          <span className="text-ink-400">Home</span>
          <ChevronRight className="w-4 h-4 text-ink-300" />
          <span className="text-ink-700 font-medium">{currentPage}</span>
        </div>
      </div>

      {/* Center - Inline Search */}
      <div ref={searchWrapperRef} className="hidden md:block relative flex-1 max-w-xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            onKeyDown={handleSearchKeyDown}
            placeholder="Cerca committente, indirizzo, proprietà, numero APE..."
            className="w-full pl-10 pr-12 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm text-ink-700 placeholder:text-ink-400 focus:bg-white focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500 transition-all"
          />
          <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 px-2 py-0.5 bg-white border border-ink-200 rounded text-xs font-mono text-ink-500 pointer-events-none">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {/* Dropdown risultati */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-ink-200 rounded-lg shadow-lg z-50 max-h-[60vh] overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-ink-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Ricerca in corso…
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-500 text-center">
                Nessun risultato per "{searchQuery.trim()}"
              </div>
            ) : (
              groupedResults.map(({ table, items }) => {
                const Icon = tableIcons[table];
                return (
                  <div key={table} className="py-1">
                    <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400 bg-ink-50/50">
                      {tableLabels[table]}
                    </div>
                    {items.map((item) => {
                      const flatIndex = searchResults.indexOf(item);
                      const isActive = flatIndex === highlightedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleResultSelect(item);
                          }}
                          onMouseEnter={() => setHighlightedIndex(flatIndex)}
                          className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-colors ${
                            isActive ? 'bg-signal-50' : 'hover:bg-ink-50'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-ink-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-ink-700 truncate">
                              {item.label}
                            </div>
                            {item.sublabel && (
                              <div className="text-xs text-ink-500 truncate">
                                {item.sublabel}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Button - toggles inline search by focusing it (visible only on mobile where center input is hidden) */}
        <button
          onClick={() => {
            const input = searchInputRef.current;
            if (input) {
              input.focus();
              input.scrollIntoView({ block: 'nearest' });
            }
          }}
          className="md:hidden p-2 rounded-md text-ink-500 hover:text-ink-700 hover:bg-ink-100 transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-ink-500 hover:text-ink-700 hover:bg-ink-100 transition-colors"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={handleUserMenuToggle}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-ink-100 transition-colors"
          >
            <div className="w-8 h-8 bg-signal-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-sm font-medium text-ink-700">
                {user?.name || user?.username || 'Utente'}
              </div>
            </div>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10"
                onClick={handleUserMenuToggle}
              />
              <div className={`absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-ink-200 py-1 z-20 ${
                isAnimatingOut ? 'animate-fade-out-up' : 'animate-fade-in-down'
              }`}>
                <div className="px-4 py-3 border-b border-ink-100">
                  <div className="text-sm font-medium text-ink-700">
                    {user?.name || user?.username || 'Utente'}
                  </div>
                  <div className="text-xs text-ink-500">
                    {user?.email || ''}
                  </div>
                </div>
                
                <div className="py-1">
                  <button 
                    onClick={toggleTheme}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {isDark ? 'Modalità chiara' : 'Modalità scura'}
                  </button>
                  
                  <button
                    onClick={() => navigate('/user-settings')}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Impostazioni
                  </button>
                  
                  <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-error-500 hover:bg-error-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnetti
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
