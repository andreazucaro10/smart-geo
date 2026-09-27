import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Euro,
  Calendar,
  Plus,
  UserPlus,
  FileText
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';

// KPI Card Component
interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ComponentType<{ className?: string }>;
  color: 'signal' | 'topo' | 'warning';
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({ 
  label, 
  value, 
  trend, 
  icon: Icon, 
  color,
  onClick 
}) => {
  const colorClasses = {
    signal: 'bg-signal-500',
    topo: 'bg-topo-500',
    warning: 'bg-warning-500'
  };

  return (
    <div 
      className="kpi-card card-hover cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="kpi-label">{label}</div>
        <div className={`w-10 h-10 rounded-full ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      {trend && (
        <div className={`kpi-trend ${trend.isPositive ? 'kpi-trend-positive' : 'kpi-trend-negative'}`}>
          {trend.isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{trend.value}% vs mese p.</span>
        </div>
      )}
    </div>
  );
};

// Quick Action Card Component
interface QuickActionProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onClick: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ label, icon: Icon, shortcut, onClick }) => (
  <button
    className="quick-action"
    onClick={onClick}
  >
    <div className="quick-action-icon">
      <Icon className="w-6 h-6" />
    </div>
    <div className="quick-action-label">{label}</div>
    {shortcut && (
      <div className="quick-action-shortcut">{shortcut}</div>
    )}
  </button>
);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [, setLoading] = useState(false);
  const [stats, setStats] = useState({
    pratiche_aperte: 0,
    scadenze_imminenti: 0,
    fatturato_mese: 0,
    pratiche_aperte_trend: 0,
    scadenze_trend: 0,
    fatturato_trend: 0
  });
  
  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Parallel queries for performance
        const [
          praticheAperteResult,
          scadenzeResult,
          fatturatoResult
        ] = await Promise.all([
          // Pratiche aperte
          supabase
            .from('comune_catasto')
            .select('id', { count: 'exact', head: true })
            .eq('fine_lavori', false),
          
          // Scadenze prossime 7 giorni
          supabase
            .from('scadenze')
            .select('id', { count: 'exact', head: true })
            .gte('data_scadenza', new Date().toISOString().split('T')[0])
            .lte('data_scadenza', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .eq('pagamento', false),
          
          // Fatturato mese corrente
          supabase
            .from('fatture')
            .select('fatturato')
            .gte('data_creazione', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
            .lte('data_creazione', new Date().toISOString())
        ]);

        setStats({
          pratiche_aperte: praticheAperteResult.count || 0,
          scadenze_imminenti: scadenzeResult.count || 0,
          fatturato_mese: (fatturatoResult.data || []).reduce((sum, f) => sum + (f.fatturato || 0), 0),
          pratiche_aperte_trend: 5, // Mock trend
          scadenze_trend: -2,
          fatturato_trend: 12
        });

      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-700">
          Bentornato, {user?.name || user?.username || 'Utente'}
        </h1>
        <p className="text-ink-500 mt-1">
          {new Date().toLocaleDateString('it-IT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KpiCard
          label="PRATICHE APERTE"
          value={stats.pratiche_aperte}
          trend={{ value: stats.pratiche_aperte_trend, isPositive: stats.pratiche_aperte_trend > 0 }}
          icon={Building2}
          color="signal"
          onClick={() => navigate('/comune-catasto')}
        />
        <KpiCard
          label="SCADENZE 7GG"
          value={stats.scadenze_imminenti}
          trend={stats.scadenze_imminenti > 0 ? { value: stats.scadenze_imminenti, isPositive: false } : undefined}
          icon={AlertTriangle}
          color="warning"
          onClick={() => navigate('/planner')}
        />
        <KpiCard
          label="FATTURATO MESE"
          value={formatCurrency(stats.fatturato_mese)}
          trend={{ value: stats.fatturato_trend, isPositive: stats.fatturato_trend > 0 }}
          icon={Euro}
          color="topo"
          onClick={() => navigate('/contabilita')}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-display font-semibold text-ink-700 mb-4">
          Azioni Rapide
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction
            label="Nuova Pratica"
            icon={Plus}
            shortcut="⌘N"
            onClick={() => navigate('/comune-catasto')}
          />
          <QuickAction
            label="Nuovo Contatto"
            icon={UserPlus}
            shortcut="⌘⇧N"
            onClick={() => navigate('/rubrica')}
          />
          <QuickAction
            label="Registra Fattura"
            icon={FileText}
            onClick={() => navigate('/contabilita')}
          />
          <QuickAction
            label="Apri Planner"
            icon={Calendar}
            onClick={() => navigate('/planner')}
          />
        </div>
      </div>

    </div>
  );
};
