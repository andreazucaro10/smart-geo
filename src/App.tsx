import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Contabilita } from './pages/Contabilita';
import { Spese } from './pages/Spese';
import { ComuneCatastoPage } from './pages/ComuneCatasto';
import { ApePage } from './pages/Ape';
import { VariePage } from './pages/Varie';
import { Parametri } from './pages/Parametri';
import { Planner } from './pages/Planner';
import { Rubrica } from './pages/Rubrica';
import { UserSettings } from './pages/UserSettings';

function App() {
  const { initialize } = useAuthStore();

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
            
            {/* Route pagine */}
            <Route path="planner" element={<Planner />} />
            <Route path="contabilita" element={<Contabilita />} />
            <Route path="spese" element={<Spese />} />
            <Route path="comune-catasto" element={<ComuneCatastoPage />} />
            <Route path="ape" element={<ApePage />} />
            <Route path="varie" element={<VariePage />} />
            <Route path="rubrica" element={<Rubrica />} />
            <Route path="parametri" element={<Parametri />} />
            <Route path="user-settings" element={<UserSettings />} />
          </Route>
        </Routes>

        {/* Toast notifications - Datum v2 style */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#44403C',
              border: '1px solid #E7E5E4',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)',
              fontSize: '14px',
              fontFamily: 'IBM Plex Sans, sans-serif',
            },
            success: {
              style: {
                borderLeft: '4px solid #0F766E',
              },
              iconTheme: {
                primary: '#0F766E',
                secondary: '#F0FDFA',
              },
            },
            error: {
              duration: 5000,
              style: {
                borderLeft: '4px solid #DC2626',
              },
              iconTheme: {
                primary: '#DC2626',
                secondary: '#FEF2F2',
              },
            },
          }}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
