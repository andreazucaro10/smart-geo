import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Contabilita } from './pages/Contabilita';
import { FattureNonContabilizzate } from './pages/FattureNonContabilizzate';
import { Spese } from './pages/Spese';
import { ComuneCatastoPage } from './pages/ComuneCatasto';
import { ApePage } from './pages/Ape';
import { Parametri } from './pages/Parametri';
import { Planner } from './pages/Planner';

function App() {
  const { initialize } = useAuthStore();
  const { isDark } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          {/* Route pubbliche */}
          <Route path="/login" element={<Login />} />
          
          {/* Route protette */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />
            
            {/* Placeholder per le altre pagine */}
            <Route path="planner" element={<Planner />} />
            <Route path="contabilita" element={<Contabilita />} />
            <Route path="fatture-non-contabilizzate" element={<FattureNonContabilizzate />} />
            <Route path="spese" element={<Spese />} />
            <Route path="comune-catasto" element={<ComuneCatastoPage />} />
            <Route path="ape" element={<ApePage />} />
            <Route 
              path="varie" 
              element={
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-gray-900">Varie</h1>
                  <p className="text-gray-600 mt-2">Pagina in sviluppo</p>
                </div>
              } 
            />
            <Route 
              path="rubrica" 
              element={
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-gray-900">Rubrica</h1>
                  <p className="text-gray-600 mt-2">Pagina in sviluppo</p>
                </div>
              } 
            />
            <Route path="parametri" element={<Parametri />} />
          </Route>
        </Routes>

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: isDark ? '#374151' : '#fff',
              color: isDark ? '#f9fafb' : '#1f2937',
              border: isDark ? '1px solid #4b5563' : '1px solid #e5e7eb',
            },
            success: {
              style: {
                background: isDark ? '#065f46' : '#dcfce7',
                color: isDark ? '#d1fae5' : '#166534',
                border: isDark ? '1px solid #047857' : '1px solid #bbf7d0',
              },
              iconTheme: {
                primary: '#10b981',
                secondary: isDark ? '#065f46' : '#dcfce7',
              },
            },
            error: {
              style: {
                background: isDark ? '#7f1d1d' : '#fef2f2',
                color: isDark ? '#fecaca' : '#991b1b',
                border: isDark ? '1px solid #dc2626' : '1px solid #fca5a5',
              },
              iconTheme: {
                primary: '#ef4444',
                secondary: isDark ? '#7f1d1d' : '#fef2f2',
              },
            },
          }}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
