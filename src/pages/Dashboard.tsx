import React from 'react';
import { 
  Building2, 
  FileCheck, 
  FolderOpen, 
  AlertTriangle,
  TrendingUp,
  Euro,
  Calendar,
  Users
} from 'lucide-react';

// Componente per le card statistiche
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color,
  onClick 
}) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500'
  };

  return (
    <div 
      className="card hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:-translate-y-1"
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <div className={`flex items-center mt-1 text-sm ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`w-4 h-4 mr-1 ${
                !trend.isPositive ? 'transform rotate-180' : ''
              }`} />
              {trend.value}%
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  // Qui si farebbero chiamate API per ottenere i dati reali
  const stats = {
    pratiche_comune_aperte: 12,
    pratiche_completate_non_pagate: 8,
    ape_completate_non_pagate: 5,
    varie_completate_non_pagate: 3,
    scadenze_in_arrivo: 7,
    fatturato_mensile: 15420,
    clienti_attivi: 34
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Panoramica dello studio</p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Aggiornato: {new Date().toLocaleDateString('it-IT')}
        </div>
      </div>

      {/* Statistiche principali */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pratiche Comune Aperte"
          value={stats.pratiche_comune_aperte}
          icon={Building2}
          color="blue"
          trend={{ value: 8.2, isPositive: true }}
        />
        
        <StatCard
          title="Pratiche da Pagare"
          value={stats.pratiche_completate_non_pagate}
          icon={Euro}
          color="yellow"
          trend={{ value: 3.1, isPositive: false }}
        />
        
        <StatCard
          title="APE da Pagare"
          value={stats.ape_completate_non_pagate}
          icon={FileCheck}
          color="green"
        />
        
        <StatCard
          title="Scadenze in Arrivo"
          value={stats.scadenze_in_arrivo}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Seconda riga di statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Varie da Pagare"
          value={stats.varie_completate_non_pagate}
          icon={FolderOpen}
          color="purple"
        />
        
        <StatCard
          title="Fatturato Mensile"
          value={`€${stats.fatturato_mensile.toLocaleString()}`}
          icon={TrendingUp}
          color="green"
          trend={{ value: 12.5, isPositive: true }}
        />
        
        <StatCard
          title="Clienti Attivi"
          value={stats.clienti_attivi}
          icon={Users}
          color="blue"
          trend={{ value: 5.4, isPositive: true }}
        />
      </div>

      {/* Sezioni aggiuntive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pratiche recenti */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pratiche Recenti
          </h3>
          <div className="space-y-3">
            {[
              { cliente: 'Mario Rossi', tipo: 'Comune', data: '2024-01-15' },
              { cliente: 'Anna Verdi', tipo: 'Catasto', data: '2024-01-14' },
              { cliente: 'Luca Bianchi', tipo: 'APE', data: '2024-01-13' },
              { cliente: 'Sofia Neri', tipo: 'Varie', data: '2024-01-12' },
            ].map((pratica, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{pratica.cliente}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{pratica.tipo}</p>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(pratica.data).toLocaleDateString('it-IT')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scadenze imminenti */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Scadenze Imminenti
          </h3>
          <div className="space-y-3">
            {[
              { descrizione: 'Rinnovo assicurazione', data: '2024-01-20', importo: 1200 },
              { descrizione: 'Pagamento software CAD', data: '2024-01-25', importo: 800 },
              { descrizione: 'Tasse comunali', data: '2024-01-30', importo: 450 },
            ].map((scadenza, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{scadenza.descrizione}</p>
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(scadenza.data).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  €{scadenza.importo}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 