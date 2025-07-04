import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronDown, Edit, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { Varie, StatoGenerale } from '../types';
import toast from 'react-hot-toast';

export const VariePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [varie, setVarie] = useState<Varie[]>([]);
  const [stati, setStati] = useState<StatoGenerale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtriAttivi, setFiltriAttivi] = useState({
    nonPagati: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingVaria, setEditingVaria] = useState<Varie | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    committente: '',
    proprieta: '',
    indirizzo: '',
    citta: '',
    telefono: '',
    mail: '',
    registrazione: '',
    pagamento: false,
    note: ''
  });
  const { user, loading: authLoading } = useAuthStore();

  // Gestione parametri URL per filtri automatici
  useEffect(() => {
    const filter = searchParams.get('filter');
    let newFiltriAttivi = { ...filtriAttivi };
    
    if (filter === 'non_pagate') {
      newFiltriAttivi = { ...newFiltriAttivi, nonPagati: true };
    }
    
    // Solo se c'è un filtro da applicare e l'user è presente
    if (filter && user?.id && !authLoading) {
      setFiltriAttivi(newFiltriAttivi);
      setCurrentPage(1);
      // Esegui la ricerca con il nuovo filtro
      fetchData({
        filtriAttivi: newFiltriAttivi,
        page: 1
      });
    }
  }, [searchParams, user?.id, authLoading]);

  // Protezione contro errori delle estensioni del browser
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.filename && (
        event.filename.includes('chrome-extension://') ||
        event.filename.includes('moz-extension://') ||
        event.filename.includes('safari-extension://') ||
        event.message?.includes('UltraWide') ||
        event.message?.includes('newValue')
      )) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && typeof event.reason === 'string' && (
        event.reason.includes('chrome-extension://') ||
        event.reason.includes('UltraWide') ||
        event.reason.includes('newValue')
      )) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const fetchData = async (customFilters?: {
    searchTerm?: string;
    filtroStato?: string;
    filtriAttivi?: typeof filtriAttivi;
    page?: number;
    perPage?: number;
  }) => {
    try {
      setLoading(true);
      
      // Verifica che l'utente sia autenticato
      if (!user?.id) {
        console.warn('Utente non autenticato, impossibile caricare i dati');
        setLoading(false);
        return;
      }
      
      const currentSearchTerm = customFilters?.searchTerm ?? searchTerm;
      const currentFiltroStato = customFilters?.filtroStato ?? filtroStato;
      const currentFiltriAttivi = customFilters?.filtriAttivi ?? filtriAttivi;
      const currentPageParam = customFilters?.page ?? currentPage;
      const currentPerPage = customFilters?.perPage ?? recordsPerPage;
      
      // Query per contare il totale
      let countQuery = supabase
        .from('varie')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Applica filtri al conteggio
      if (currentSearchTerm) {
        countQuery = countQuery.or(`committente.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%`);
      }

      if (currentFiltroStato) {
        countQuery = countQuery.eq('registrazione', parseInt(currentFiltroStato));
      }

      if (currentFiltriAttivi.nonPagati) {
        countQuery = countQuery.eq('pagamento', 0);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Errore nel conteggio:', countError);
        // Se l'errore è relativo alla sessione, mostra un messaggio specifico
        if (countError.message?.includes('JWT') || countError.message?.includes('session')) {
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
        }
      } else {
        setTotalRecords(count || 0);
      }
      
      // Query principale con paginazione
      let query = supabase
        .from('varie')
        .select(`
          *,
          registrazione_info:stati_generali(id, descrizione, colore)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      // Applica filtri
      if (currentSearchTerm) {
        query = query.or(`committente.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%`);
      }

      if (currentFiltroStato) {
        query = query.eq('registrazione', parseInt(currentFiltroStato));
      }

      if (currentFiltriAttivi.nonPagati) {
        query = query.eq('pagamento', 0);
      }

      // Applica paginazione
      const from = (currentPageParam - 1) * currentPerPage;
      const to = from + currentPerPage - 1;
      query = query.range(from, to);

      const { data: varieData, error: varieError } = await query;

      if (varieError) {
        console.error('Errore nel caricamento varie:', varieError);
        // Se l'errore è relativo alla sessione, mostra un messaggio specifico
        if (varieError.message?.includes('JWT') || varieError.message?.includes('session')) {
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
        } else {
          toast.error('Errore nel caricamento delle varie');
        }
        return;
      }

      // Carica stati
      const { data: statiData, error: statiError } = await supabase
        .from('stati_generali')
        .select('*')
        .order('ordinamento');

      if (statiError) {
        console.error('Errore caricamento stati:', statiError);
      } else {
        setStati(statiData || []);
      }

      setVarie(varieData || []);
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Aspetta che l'autenticazione sia inizializzata
    const initializeData = async () => {
      // Attende che l'autenticazione sia completata
      if (authLoading) {
        console.log('Autenticazione in corso...');
        return;
      }
      
      // Se c'è un user, carica i dati
      if (user?.id) {
        console.log('User autenticato, caricamento dati...');
        await fetchData();
      }
      // Se l'user è null ma lo store ha finito di caricare, significa che non è autenticato
      else if (user === null) {
        console.warn('User non autenticato');
        setLoading(false);
      }
    };

    initializeData();
  }, [user?.id, authLoading]);

  const handleSearch = () => {
    fetchData();
  };

  const handleFilterToggle = (filterName: keyof typeof filtriAttivi) => {
    const newFiltriAttivi = {
      ...filtriAttivi,
      [filterName]: !filtriAttivi[filterName]
    };
    
    setFiltriAttivi(newFiltriAttivi);
    setCurrentPage(1);
    
    fetchData({
      filtriAttivi: newFiltriAttivi,
      page: 1
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData({ page });
  };

  const handleRecordsPerPageChange = (newRecordsPerPage: number) => {
    setRecordsPerPage(newRecordsPerPage);
    setCurrentPage(1);
    fetchData({ 
      perPage: newRecordsPerPage,
      page: 1
    });
  };

  const getTotalPages = () => {
    return Math.ceil(totalRecords / recordsPerPage);
  };

  const handleToggleField = async (varia: Varie, field: 'pagamento') => {
    try {
      const newValue = !varia[field];
      
      const { error } = await supabase
        .from('varie')
        .update({ [field]: newValue })
        .eq('id', varia.id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error(`Errore nell'aggiornamento del campo ${field}`);
        return;
      }

      toast.success(`Campo ${field} aggiornato con successo`);
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'aggiornamento');
    }
  };

  const handleDeleteVaria = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa varia?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('varie')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della varia');
        return;
      }

      toast.success('Varia eliminata con successo');
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const formatTelefono = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    const limitedValue = numericValue.slice(0, 10);
    
    if (limitedValue.length <= 3) {
      return limitedValue;
    } else if (limitedValue.length <= 6) {
      return `${limitedValue.slice(0, 3)} ${limitedValue.slice(3)}`;
    } else {
      return `${limitedValue.slice(0, 3)} ${limitedValue.slice(3, 6)} ${limitedValue.slice(6)}`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!e || !e.target) {
      console.warn('Evento malformato ignorato');
      return;
    }

    const { name, value, type } = e.target;
    
    if (!name) {
      console.warn('Nome campo non definito');
      return;
    }

    let processedValue = value;
    
    if (name === 'telefono' && type !== 'checkbox') {
      processedValue = formatTelefono(value);
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : processedValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.committente.trim()) {
      toast.error('Il campo committente è obbligatorio');
      return;
    }

    setSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        registrazione: formData.registrazione ? parseInt(formData.registrazione) : null,
        user_id: user?.id
      };

      if (editingVaria) {
        const { error } = await supabase
          .from('varie')
          .update(dataToSave)
          .eq('id', editingVaria.id)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Errore modifica:', error);
          toast.error('Errore nella modifica della varia');
          return;
        }

        toast.success('Varia modificata con successo');
      } else {
        const { error } = await supabase
          .from('varie')
          .insert([dataToSave]);

        if (error) {
          console.error('Errore inserimento:', error);
          toast.error('Errore nel salvataggio della varia');
          return;
        }

        toast.success('Varia creata con successo');
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (varia?: Varie) => {
    if (varia) {
      setEditingVaria(varia);
      setFormData({
        committente: varia.committente,
        proprieta: varia.proprieta || '',
        indirizzo: varia.indirizzo || '',
        citta: varia.citta || '',
        telefono: varia.telefono || '',
        mail: varia.mail || '',
        registrazione: varia.registrazione?.toString() || '',
        pagamento: varia.pagamento,
        note: varia.note || ''
      });
    } else {
      setEditingVaria(null);
      setFormData({
        committente: '',
        proprieta: '',
        indirizzo: '',
        citta: '',
        telefono: '',
        mail: '',
        registrazione: '',
        pagamento: false,
        note: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVaria(null);
    setFormData({
      committente: '',
      proprieta: '',
      indirizzo: '',
      citta: '',
      telefono: '',
      mail: '',
      registrazione: '',
      pagamento: false,
      note: ''
    });
  };

  const getStatoStyle = (stato: StatoGenerale | undefined) => {
    if (!stato || !stato.colore) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    return `text-white`;
  };

  const getStatoBackgroundColor = (stato: StatoGenerale | undefined) => {
    if (!stato || !stato.colore) return '#6b7280';
    return stato.colore;
  };

  const renderToggleButton = (value: boolean) => {
    return (
      <div
        className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 ${
          value 
            ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50' 
            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
        }`}
      >
        {value ? (
          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
        ) : (
          <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Varie</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestione pratiche varie</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Varia
        </button>
      </div>

      {/* Filtri */}
      <div className="card space-y-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Campo di ricerca */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Cerca committente, indirizzo..."
              className="input pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white p-1 rounded"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Filtro Stati */}
          <div className="relative">
            <select
              value={filtroStato}
              onChange={(e) => {
                const newFiltroStato = e.target.value;
                setFiltroStato(newFiltroStato);
                setCurrentPage(1);
                fetchData({
                  filtroStato: newFiltroStato,
                  page: 1
                });
              }}
              className="input pr-8 appearance-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">-- Tutti gli stati --</option>
              {stati.map((stato) => (
                <option key={stato.id} value={stato.id}>
                  {stato.descrizione}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        {/* Filtri toggle */}
        <div className="flex flex-wrap gap-4">
          <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
            filtriAttivi.nonPagati 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}>
            <input
              type="checkbox"
              checked={filtriAttivi.nonPagati}
              onChange={() => handleFilterToggle('nonPagati')}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
              filtriAttivi.nonPagati 
                ? 'border-white bg-white' 
                : 'border-gray-400 dark:border-gray-500 bg-transparent'
            }`}>
              {filtriAttivi.nonPagati && (
                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium">Non pagati</span>
          </label>
        </div>
      </div>

      {/* Tabella */}
      <div className="card p-0 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Committente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Proprietario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Indirizzo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Città</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Telefono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pagamento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Note</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading || authLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">
                        {authLoading ? 'Verifica autenticazione...' : 'Caricamento...'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : varie.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nessuna varia trovata
                  </td>
                </tr>
              ) : (
                varie.map((varia) => (
                  <tr key={varia.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <span 
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getStatoStyle(varia.registrazione_info)}`}
                        style={{ backgroundColor: getStatoBackgroundColor(varia.registrazione_info) }}
                      >
                        {varia.registrazione_info?.descrizione || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{varia.committente}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{varia.proprieta || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{varia.indirizzo || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{varia.citta || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{varia.telefono || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{varia.mail || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleField(varia, 'pagamento')}
                        className="transition-colors cursor-pointer"
                        title="Clicca per cambiare stato"
                      >
                        {renderToggleButton(varia.pagamento)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">{varia.note || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openModal(varia)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                          title="Modifica"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVaria(varia.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Controlli Paginazione */}
        {varie.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando {Math.min((currentPage - 1) * recordsPerPage + 1, totalRecords)} - {Math.min(currentPage * recordsPerPage, totalRecords)} di {totalRecords} varie
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Record:</span>
                  <select
                    value={recordsPerPage}
                    onChange={(e) => handleRecordsPerPageChange(parseInt(e.target.value))}
                    className="input py-1 px-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
                
                {getTotalPages() > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                    >
                      ««
                    </button>
                    
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                    >
                      ‹
                    </button>
                    
                    {Array.from({ length: Math.min(5, getTotalPages()) }, (_, i) => {
                      let pageNum;
                      if (getTotalPages() <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= getTotalPages() - 2) {
                        pageNum = getTotalPages() - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-sm border rounded ${
                            currentPage === pageNum
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                    >
                      ›
                    </button>
                    
                    <button
                      onClick={() => handlePageChange(getTotalPages())}
                      disabled={currentPage === getTotalPages()}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                    >
                      »»
                    </button>
                  </div>
                )}
              </div>
              
              {getTotalPages() > 1 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Pagina {currentPage} di {getTotalPages()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingVaria ? 'Modifica Varia' : 'Nuova Varia'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Committente *
                    </label>
                    <input
                      type="text"
                      name="committente"
                      value={formData.committente}
                      onChange={handleInputChange}
                      placeholder="Nome committente"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Proprietario
                    </label>
                    <input
                      type="text"
                      name="proprieta"
                      value={formData.proprieta}
                      onChange={handleInputChange}
                      placeholder="Nome proprietario"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Indirizzo
                    </label>
                    <input
                      type="text"
                      name="indirizzo"
                      value={formData.indirizzo}
                      onChange={handleInputChange}
                      placeholder="Indirizzo"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Città
                    </label>
                    <input
                      type="text"
                      name="citta"
                      value={formData.citta}
                      onChange={handleInputChange}
                      placeholder="Città"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      placeholder="XXX XXX XXXX"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="mail"
                      value={formData.mail}
                      onChange={handleInputChange}
                      placeholder="Indirizzo email"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stato
                    </label>
                    <div className="relative">
                      <select
                        name="registrazione"
                        value={formData.registrazione}
                        onChange={handleInputChange}
                        className="input w-full pr-8 appearance-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="">-- Seleziona stato --</option>
                        {stati.map((stato) => (
                          <option key={stato.id} value={stato.id}>
                            {stato.descrizione}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </div>
                  </div>

                  <div>
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border-2 ${
                      formData.pagamento 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300 cursor-pointer' 
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
                    }`}>
                      <input
                        type="checkbox"
                        name="pagamento"
                        checked={formData.pagamento}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                        formData.pagamento 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 dark:border-gray-500 bg-transparent'
                      }`}>
                        {formData.pagamento && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">Pagamento</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Note
                    </label>
                    <textarea
                      name="note"
                      value={formData.note}
                      onChange={handleInputChange}
                      placeholder="Note aggiuntive"
                      rows={4}
                      className="input w-full resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>* Campo obbligatorio</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {editingVaria ? 'Modifica...' : 'Salvataggio...'}
                      </div>
                    ) : (
                      editingVaria ? 'Modifica' : 'Salva'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}; 