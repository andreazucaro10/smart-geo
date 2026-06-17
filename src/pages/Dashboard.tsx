import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { Scadenza, ComuneCatasto } from '../types';

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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [speseImminenti, setSpeseImminenti] = useState<Scadenza[]>([]);
  const [praticheRecenti, setPraticheRecenti] = useState<ComuneCatasto[]>([]);
  const [stats, setStats] = useState({
    pratiche_comune_aperte: 0,
    pratiche_completate_non_pagate: 0,
    ape_completate_non_pagate: 0,
    varie_completate_non_pagate: 0,
    scadenze_in_arrivo: 0,
    fatturato_annuo: 0,
    clienti_attivi: 0
  });
  
  // Funzione per caricare tutti i dati
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Query parallele per ottimizzare le performance
      const [
        praticheComuneAperteResult,
        praticheNonPagateResult,
        apeNonPagateResult,
        varieNonPagateResult,
        speseImmimentiResult,
        fatturatoAnnuoResult,
        praticheRecentiResult
      ] = await Promise.all([
        // Pratiche Comune Aperte: tipo incarico con comune=true e stato diverso da 2 (completato)
        supabase
          .from('comune_catasto')
          .select(`
            id,
            tipo_incarico_info:tipi_incarico!tipo_incarico(comune)
          `)
          .neq('stato', 2) // Non completato
          .eq('tipi_incarico.comune', true),

        // Pratiche non pagate: pagamento = 0
        supabase
          .from('comune_catasto')
          .select('id')
          .eq('pagamento', 0),

        // APE non pagate: pagamento = 0
        supabase
          .from('ape')
          .select('id')
          .eq('pagamento', 0),

        // Varie non pagate: pagamento = 0, escludi omaggio
        supabase
          .from('varie')
          .select('id')
          .eq('pagamento', 0)
          .eq('omaggio', false),

        // Spese imminenti: scadenza entro 30 giorni o senza data e non pagate
        (() => {
          const today = new Date();
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(today.getDate() + 30);

          return supabase
            .from('scadenze')
            .select(`
              *,
              stato_info:stati_scadenze(*)
            `)
            .eq('pagamento', 0)
            .or(`data_scadenza.lte.${thirtyDaysFromNow.toISOString().split('T')[0]},data_scadenza.is.null`)
            .order('data_scadenza', { ascending: true, nullsFirst: false });
        })(),

        // Fatturato annuo: somma del fatturato dell'anno corrente
        supabase
          .from('fatture')
          .select('fatturato')
          .eq('anno_fattura', new Date().getFullYear()),

        // Clienti attivi: conteggio distinto di committenti nelle tabelle principali
        supabase
          .from('comune_catasto')
          .select('committente')
          .neq('stato', 4), // Non annullato

        // Pratiche recenti: ultime 4 pratiche dalla tabella comune_catasto, ordinate per data creazione decrescente
        supabase
          .from('comune_catasto')
          .select(`
            *,
            stato_info:stati_generali(id, descrizione, colore),
            tipo_incarico_info:tipi_incarico(id, descrizione, comune, catasto)
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(4)
      ]);

      // Elabora i risultati
      const newStats = {
        pratiche_comune_aperte: 0,
        pratiche_completate_non_pagate: praticheNonPagateResult.data?.length || 0,
        ape_completate_non_pagate: apeNonPagateResult.data?.length || 0,
        varie_completate_non_pagate: varieNonPagateResult.data?.length || 0,
        scadenze_in_arrivo: speseImmimentiResult.data?.length || 0,
        fatturato_annuo: fatturatoAnnuoResult.data?.reduce((sum, fattura) => sum + (fattura.fatturato || 0), 0) || 0,
        clienti_attivi: 0
      };

      // Calcola pratiche comune aperte filtrando per tipo incarico con comune=true
      if (praticheComuneAperteResult.data) {
        // Prima query per ottenere i tipi incarico con comune=true
        const { data: tipiIncaricoComune } = await supabase
          .from('tipi_incarico')
          .select('id')
          .eq('comune', true);

        if (tipiIncaricoComune) {
          const tipiIds = tipiIncaricoComune.map(tipo => tipo.id);
          
          // Seconda query per contare le pratiche con questi tipi e stato diverso da completato
          const { data: pratiche } = await supabase
            .from('comune_catasto')
            .select('id')
            .in('tipo_incarico', tipiIds)
            .neq('stato', 3);

          newStats.pratiche_comune_aperte = pratiche?.length || 0;
        }
      }

      // Calcola clienti attivi (distinct committenti)
      const [comuneClienti, apeClienti, varieClienti] = await Promise.all([
        supabase.from('comune_catasto').select('committente').neq('stato', 4),
        supabase.from('ape').select('committente'),
        supabase.from('varie').select('committente')
      ]);

      const allClienti = new Set([
        ...(comuneClienti.data?.map(c => c.committente) || []),
        ...(apeClienti.data?.map(c => c.committente) || []),
        ...(varieClienti.data?.map(c => c.committente) || [])
      ]);

      newStats.clienti_attivi = allClienti.size;

      setStats(newStats);
      setSpeseImminenti(speseImmimentiResult.data || []);
      
      // Ensure we only show maximum 4 items, even if more are returned
      const recentPractices = (praticheRecentiResult.data as ComuneCatasto[]) || [];
      const limitedPractices = recentPractices.slice(0, 4);
      setPraticheRecenti(limitedPractices);

    } catch (error) {
      console.error('Errore caricamento dati dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id]);

  // Funzioni di navigazione
  const handlePraticheComuneClick = () => {
    // Naviga alla pagina comune-catasto con filtro "Non completati"
    navigate('/comune-catasto?filter=non_completati');
  };

  const handlePraticheDaPagareClick = () => {
    // Naviga alla pagina comune-catasto con filtro per pratiche completate non pagate
    navigate('/comune-catasto?filter=non_pagate');
  };

  const handleApeClick = () => {
    // Naviga alla pagina APE con filtro per non pagate
    navigate('/ape?filter=non_pagate');
  };

  const handleVarieClick = () => {
    // Naviga alla pagina varie con filtro per non pagate
    navigate('/varie?filter=non_pagate');
  };

  const handleScadenzeClick = () => {
    // Naviga alla pagina spese con filtro per imminenti
    navigate('/spese?filter=imminenti');
  };

  // Funzione per determinare se una spesa è scaduta
  const isOverdue = (dataScadenza: string | null | undefined): boolean => {
    if (!dataScadenza) return false;
    const today = new Date();
    const scadenza = new Date(dataScadenza);
    return scadenza < today;
  };

  // Funzione per formattare i giorni rimanenti
  const getDaysRemaining = (dataScadenza: string | null | undefined): string => {
    if (!dataScadenza) return 'Non specificata';
    
    const today = new Date();
    const scadenza = new Date(dataScadenza);
    const diffTime = scadenza.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Scaduta da ${Math.abs(diffDays)} giorni`;
    } else if (diffDays === 0) {
      return 'Scade oggi';
    } else if (diffDays === 1) {
      return 'Scade domani';
    } else {
      return `${diffDays} giorni`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Panoramica dello studio</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          )}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Aggiornato: {new Date().toLocaleDateString('it-IT')}
          </div>
        </div>
      </div>

      {/* Statistiche principali */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pratiche Comune Aperte"
          value={stats.pratiche_comune_aperte}
          icon={Building2}
          color="blue"
          onClick={handlePraticheComuneClick}
        />
        
        <StatCard
          title="Pratiche da Pagare"
          value={stats.pratiche_completate_non_pagate}
          icon={Euro}
          color="yellow"
          onClick={handlePraticheDaPagareClick}
        />
        
        <StatCard
          title="APE da Pagare"
          value={stats.ape_completate_non_pagate}
          icon={FileCheck}
          color="green"
          onClick={handleApeClick}
        />
        
        <StatCard
          title="Scadenze in Arrivo"
          value={stats.scadenze_in_arrivo}
          icon={AlertTriangle}
          color="red"
          onClick={handleScadenzeClick}
        />
      </div>

      {/* Seconda riga di statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Varie da Pagare"
          value={stats.varie_completate_non_pagate}
          icon={FolderOpen}
          color="purple"
          onClick={handleVarieClick}
        />
        
        <StatCard
          title="Fatturato Annuo"
          value={`€${stats.fatturato_annuo.toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
        
        <StatCard
          title="Clienti Attivi"
          value={stats.clienti_attivi}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Sezioni aggiuntive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pratiche recenti */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pratiche Recenti
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({praticheRecenti.length} di max 4)
              </span>
              {loading && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {praticheRecenti.length === 0 && !loading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nessuna pratica recente
              </div>
            ) : (
              praticheRecenti.map((pratica) => (
                <div key={pratica.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {pratica.committente || 'Informazione non disponibile'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {pratica.proprieta || 'Nessuna proprietà specificata'}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {pratica.created_at && !isNaN(new Date(pratica.created_at).getTime())
                      ? new Date(pratica.created_at).toLocaleDateString('it-IT')
                      : 'Data non valida'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Spese imminenti */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Spese Imminenti
            </h3>
            {loading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <div className="space-y-3">
            {speseImminenti.length === 0 && !loading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nessuna spesa imminente
              </div>
            ) : (
              speseImminenti.slice(0, 5).map((spesa) => {
                const isScaduta = isOverdue(spesa.data_scadenza);
                return (
                  <div key={spesa.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{spesa.descrizione}</p>
                      <p className={`text-sm flex items-center ${
                        isScaduta 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        <Calendar className="w-4 h-4 mr-1" />
                        {spesa.data_scadenza 
                          ? new Date(spesa.data_scadenza).toLocaleDateString('it-IT')
                          : 'Data non specificata'
                        }
                      </p>
                      <p className={`text-xs ${
                        isScaduta 
                          ? 'text-red-500 dark:text-red-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {getDaysRemaining(spesa.data_scadenza)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        €{spesa.spese.toLocaleString()}
                      </div>
                      {isScaduta && (
                        <div className="text-xs text-red-500 dark:text-red-400 font-medium">
                          SCADUTA
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {speseImminenti.length > 5 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                ...e altre {speseImminenti.length - 5} spese
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 