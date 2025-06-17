import React, { useState, useEffect } from 'react';
import { Plus, Search, ChevronDown, Edit, Trash2, Check, X, Save } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { Ape, StatoApe } from '../types';
import toast from 'react-hot-toast';

interface ApeFormData {
  committente: string;
  proprieta: string;
  indirizzo: string;
  citta: string;
  mail: string;
  telefono: string;
  note: string;
  registrazione: number | null;
  progressivo: string;
  pagamento: boolean;
}

export const ApePage: React.FC = () => {
  const [pratiche, setPratiche] = useState<Ape[]>([]);
  const [stati, setStati] = useState<StatoApe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtriAttivi, setFiltriAttivi] = useState({
    soloNonPagate: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingPratica, setEditingPratica] = useState<Ape | null>(null);
  const [formData, setFormData] = useState<ApeFormData>({
    committente: '',
    proprieta: '',
    indirizzo: '',
    citta: '',
    mail: '',
    telefono: '',
    note: '',
    registrazione: null,
    progressivo: '',
    pagamento: false
  });
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();

  const resetForm = () => {
    setFormData({
      committente: '',
      proprieta: '',
      indirizzo: '',
      citta: '',
      mail: '',
      telefono: '',
      note: '',
      registrazione: null,
      progressivo: '',
      pagamento: false
    });
    setEditingPratica(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (pratica: Ape) => {
    setFormData({
      committente: pratica.committente || '',
      proprieta: pratica.proprieta || '',
      indirizzo: pratica.indirizzo || '',
      citta: pratica.citta || '',
      mail: pratica.mail || '',
      telefono: pratica.telefono || '',
      note: pratica.note || '',
      registrazione: pratica.registrazione || null,
      progressivo: pratica.progressivo || '',
      pagamento: pratica.pagamento || false
    });
    setEditingPratica(pratica);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const formatPhoneNumber = (value: string) => {
    // Rimuovi tutti i caratteri non numerici
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 10 cifre
    const truncated = numbers.slice(0, 10);
    
    // Applica la formattazione XXX XXX XXXX
    if (truncated.length <= 3) {
      return truncated;
    } else if (truncated.length <= 6) {
      return `${truncated.slice(0, 3)} ${truncated.slice(3)}`;
    } else {
      return `${truncated.slice(0, 3)} ${truncated.slice(3, 6)} ${truncated.slice(6)}`;
    }
  };

  const handleInputChange = async (field: keyof ApeFormData, value: string | number | boolean | null) => {
    // Formatta il numero di telefono se il campo è 'telefono'
    if (field === 'telefono' && typeof value === 'string') {
      value = formatPhoneNumber(value);
    }
    
    // Se stiamo cambiando lo stato di registrazione a "Completata" e non c'è un progressivo
    if (field === 'registrazione' && typeof value === 'number' && !formData.progressivo.trim()) {
      try {
        const progressivoGenerato = await generaProgressivoAutomatico(value);
        if (progressivoGenerato) {
          setFormData(prev => ({
            ...prev,
            [field]: value,
            progressivo: progressivoGenerato
          }));
          toast.success('Progressivo generato automaticamente');
          return;
        }
      } catch (error) {
        console.error('Errore generazione progressivo:', error);
        // Continua con l'aggiornamento normale se c'è un errore
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Funzione per generare il progressivo automatico
  const generaProgressivoAutomatico = async (statoId: number): Promise<string> => {
    try {
      // 1. Controlla se lo stato è "Completata"
      const statoCompletata = stati.find(stato => 
        stato.descrizione.toLowerCase().includes('completata')
      );
      
      if (!statoCompletata || statoId !== statoCompletata.id) {
        return ''; // Non genera progressivo se non è completata
      }

      // 2. Ottieni l'anno corrente
      const annoCorrente = new Date().getFullYear();

      // 3. Recupera il codice APE dai parametri azienda
      const { data: parametriData, error: parametriError } = await supabase
        .from('parametri_azienda')
        .select('codice_ape')
        .limit(1);

      if (parametriError) {
        console.error('Errore caricamento parametri azienda:', parametriError);
        throw new Error('Impossibile recuperare il codice APE');
      }

      const codiceApe = parametriData?.[0]?.codice_ape || 'APE';

      // 4. Calcola il prossimo numero progressivo per l'anno corrente
      const { data: praticheDellAnno, error: praticheError } = await supabase
        .from('ape')
        .select('progressivo')
        .eq('user_id', user?.id)
        .not('progressivo', 'is', null)
        .like('progressivo', `${annoCorrente}-${codiceApe}-%`);

      if (praticheError) {
        console.error('Errore recupero pratiche anno:', praticheError);
        throw new Error('Errore nel calcolo del progressivo');
      }

      // Estrai i numeri progressivi esistenti
      let numeroProgressivo = 1;
      if (praticheDellAnno && praticheDellAnno.length > 0) {
        const numeriEsistenti = praticheDellAnno
          .map(p => {
            const match = p.progressivo?.match(new RegExp(`^${annoCorrente}-${codiceApe}-(\\d+)$`));
            return match ? parseInt(match[1]) : 0;
          })
          .filter(n => n > 0);
        
        if (numeriEsistenti.length > 0) {
          numeroProgressivo = Math.max(...numeriEsistenti) + 1;
        }
      }

      // 5. Genera il progressivo finale: anno-codiceAPE-numero
      return `${annoCorrente}-${codiceApe}-${numeroProgressivo.toString().padStart(3, '0')}`;

    } catch (error) {
      console.error('Errore generazione progressivo:', error);
      toast.error('Errore nella generazione del progressivo automatico');
      return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.committente.trim()) {
      toast.error('Il committente è obbligatorio');
      return;
    }

    setSubmitting(true);

    try {
      // Verifica se dobbiamo generare il progressivo automatico
      let progressivoFinale = formData.progressivo.trim();
      
      // Se la registrazione è cambiata a "Completata" e non c'è già un progressivo
      if (formData.registrazione && !progressivoFinale) {
        progressivoFinale = await generaProgressivoAutomatico(formData.registrazione);
      }

      const dataToSubmit = {
        committente: formData.committente.trim(),
        proprieta: formData.proprieta.trim() || null,
        indirizzo: formData.indirizzo.trim() || null,
        citta: formData.citta.trim() || null,
        mail: formData.mail.trim() || null,
        telefono: formData.telefono.trim() || null,
        note: formData.note.trim() || null,
        registrazione: formData.registrazione || null,
        progressivo: progressivoFinale || null,
        pagamento: formData.pagamento,
        user_id: user?.id
      };

      if (editingPratica) {
        // Modifica
        const { error } = await supabase
          .from('ape')
          .update({
            ...dataToSubmit,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPratica.id)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Errore modifica:', error);
          toast.error('Errore nella modifica della pratica APE');
          return;
        }

        if (progressivoFinale && !formData.progressivo.trim()) {
          toast.success('Pratica APE modificata e progressivo generato automaticamente');
        } else {
          toast.success('Pratica APE modificata con successo');
        }
      } else {
        // Creazione
        const { error } = await supabase
          .from('ape')
          .insert([dataToSubmit]);

        if (error) {
          console.error('Errore creazione:', error);
          toast.error('Errore nella creazione della pratica APE');
          return;
        }

        if (progressivoFinale && !formData.progressivo.trim()) {
          toast.success('Pratica APE creata e progressivo generato automaticamente');
        } else {
          toast.success('Pratica APE creata con successo');
        }
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'operazione');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async (customFilters?: {
    searchTerm?: string;
    filtroStato?: string;
    filtriAttivi?: typeof filtriAttivi;
    page?: number;
    perPage?: number;
  }) => {
    try {
      setLoading(true);
      
      // Usa i filtri personalizzati o quelli dello stato corrente
      const currentSearchTerm = customFilters?.searchTerm ?? searchTerm;
      const currentFiltroStato = customFilters?.filtroStato ?? filtroStato;
      const currentFiltriAttivi = customFilters?.filtriAttivi ?? filtriAttivi;
      const currentPageParam = customFilters?.page ?? currentPage;
      const currentPerPage = customFilters?.perPage ?? recordsPerPage;
      
      // Prima query per contare il totale dei record
      let countQuery = supabase
        .from('ape')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Applica filtri al conteggio
      if (currentSearchTerm) {
        countQuery = countQuery.or(`committente.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,progressivo.ilike.%${currentSearchTerm}%`);
      }

      if (currentFiltroStato) {
        countQuery = countQuery.eq('registrazione', parseInt(currentFiltroStato));
      }

      if (currentFiltriAttivi.soloNonPagate) {
        countQuery = countQuery.eq('pagamento', false);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Errore nel conteggio:', countError);
      } else {
        setTotalRecords(count || 0);
      }
      
      // Query principale con paginazione
      let query = supabase
        .from('ape')
        .select(`
          *,
          registrazione_info:stati_ape(id, descrizione, colore)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      // Applica filtri
      if (currentSearchTerm) {
        query = query.or(`committente.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,progressivo.ilike.%${currentSearchTerm}%`);
      }

      if (currentFiltroStato) {
        query = query.eq('registrazione', parseInt(currentFiltroStato));
      }

      if (currentFiltriAttivi.soloNonPagate) {
        query = query.eq('pagamento', false);
      }

      // Applica paginazione
      const from = (currentPageParam - 1) * currentPerPage;
      const to = from + currentPerPage - 1;
      query = query.range(from, to);

      const { data: praticheData, error: praticheError } = await query;

      if (praticheError) {
        console.error('Errore nel caricamento pratiche APE:', praticheError);
        toast.error('Errore nel caricamento delle pratiche APE');
        return;
      }

      // Carica stati APE per il dropdown
      const { data: statiData, error: statiError } = await supabase
        .from('stati_ape')
        .select('*')
        .order('id');

      if (statiError) {
        console.error('Errore caricamento stati APE:', statiError);
      } else {
        setStati(statiData || []);
      }

      setPratiche(praticheData || []);
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const handleSearch = () => {
    fetchData();
  };

  const handleFilterToggle = (filterName: keyof typeof filtriAttivi) => {
    const newFiltriAttivi = {
      ...filtriAttivi,
      [filterName]: !filtriAttivi[filterName]
    };
    
    setFiltriAttivi(newFiltriAttivi);
    setCurrentPage(1); // Reset alla prima pagina quando cambiano i filtri
    
    // Trigger automatico della ricerca con i nuovi filtri
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
    setCurrentPage(1); // Reset alla prima pagina quando cambia il numero di record
    fetchData({ 
      perPage: newRecordsPerPage,
      page: 1
    });
  };

  const getTotalPages = () => {
    return Math.ceil(totalRecords / recordsPerPage);
  };

  const handleTogglePagamento = async (pratica: Ape) => {
    try {
      const nuovoPagamento = !pratica.pagamento;
      
      const { error } = await supabase
        .from('ape')
        .update({ 
          pagamento: nuovoPagamento,
          updated_at: new Date().toISOString()
        })
        .eq('id', pratica.id)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Errore aggiornamento pagamento:', error);
        toast.error('Errore nell\'aggiornamento del pagamento');
        return;
      }

      toast.success(nuovoPagamento ? 'Pagamento marcato come effettuato' : 'Pagamento marcato come non effettuato');
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'aggiornamento del pagamento');
    }
  };

  const handleDeletePratica = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa pratica APE?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ape')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della pratica');
        return;
      }

      toast.success('Pratica APE eliminata con successo');
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const getStatoStyle = (stato: StatoApe | undefined) => {
    if (!stato) {
      return {
        backgroundColor: '#f3f4f6',
        color: '#374151'
      };
    }
    
    // Utilizza direttamente il colore dal database
    const backgroundColor = stato.colore || '#6b7280';
    
    // Calcola automaticamente il colore del testo in base alla luminosità del background
    const getTextColor = (bgColor: string) => {
      // Rimuovi il # se presente
      const hex = bgColor.replace('#', '');
      
      // Converti in RGB
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Calcola la luminosità
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Restituisci bianco per sfondi scuri, nero per sfondi chiari
      return luminance > 0.5 ? '#000000' : '#ffffff';
    };
    
    return {
      backgroundColor,
      color: getTextColor(backgroundColor)
    };
  };

  const renderPagamentoToggle = (pratica: Ape) => {
    return (
      <button
        onClick={() => handleTogglePagamento(pratica)}
        className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 ${
          pratica.pagamento 
            ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50' 
            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
        }`}
        title={pratica.pagamento ? 'Marcato come pagato - Clicca per rimuovere' : 'Non pagato - Clicca per marcare come pagato'}
      >
        {pratica.pagamento ? (
          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
        ) : (
          <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        )}
      </button>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  return (
    <div className="space-y-6" style={{marginTop: '0px'}}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestione APE</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestione pratiche APE</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Pratica APE
        </button>
      </div>

      {/* Filtri */}
      <div className="card space-y-4 dark:bg-gray-800 dark:border-gray-700">
        {/* Filtri */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Campo di ricerca */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Cerca..."
              className="input pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-emerald-500 text-white p-1 rounded"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Filtro Stati APE */}
          <div className="relative">
            <select
              value={filtroStato}
              onChange={(e) => {
                const newFiltroStato = e.target.value;
                setFiltroStato(newFiltroStato);
                setCurrentPage(1); // Reset alla prima pagina quando cambia il filtro
                // Trigger automatico della ricerca con il nuovo stato
                fetchData({
                  filtroStato: newFiltroStato,
                  page: 1
                });
              }}
              className="input pr-8 appearance-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">-- Tutti gli stati APE --</option>
              {stati.map((stato) => (
                <option key={stato.id} value={stato.id}>
                  {stato.descrizione}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>

          {/* Filtro Non pagate */}
          <div className="flex items-center">
            <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 w-full justify-center ${
              filtriAttivi.soloNonPagate 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}>
              <input
                type="checkbox"
                checked={filtriAttivi.soloNonPagate}
                onChange={() => handleFilterToggle('soloNonPagate')}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
                filtriAttivi.soloNonPagate 
                  ? 'border-white bg-white' 
                  : 'border-gray-400 dark:border-gray-500 bg-transparent'
              }`}>
                {filtriAttivi.soloNonPagate && (
                  <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">Non pagate</span>
            </label>
          </div>
        </div>
      </div>

      {/* Contenuto principale */}
      {loading ? (
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-500 dark:text-gray-400">Caricamento...</span>
          </div>
        </div>
      ) : pratiche.length === 0 ? (
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-300 text-center">Nessuna pratica APE trovata.</p>
          </div>
        </div>
      ) : (
        /* Tabella */
        <div className="card p-0 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Committente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Proprietà
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Indirizzo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Città
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Mail
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Telefono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Note
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Progressivo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Pagamento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Data Creazione
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {pratiche.map((pratica) => (
                  <tr key={pratica.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <span 
                        className="inline-flex px-2 py-1 text-xs font-semibold rounded"
                        style={getStatoStyle(pratica.registrazione_info)}
                      >
                        {pratica.registrazione_info?.descrizione || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {pratica.committente}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.proprieta || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.indirizzo || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.citta || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.mail || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.telefono || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {pratica.note || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.progressivo || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderPagamentoToggle(pratica)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(pratica.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(pratica)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                          title="Modifica"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePratica(pratica.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Controlli Paginazione */}
          {pratiche.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                {/* Info record */}
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Mostrando {Math.min((currentPage - 1) * recordsPerPage + 1, totalRecords)} - {Math.min(currentPage * recordsPerPage, totalRecords)} di {totalRecords} pratiche
                </div>
                
                {/* Controlli centrali */}
                <div className="flex items-center gap-4">
                  {/* Selezione record per pagina */}
                  <div className="flex items-center gap-2">
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
                  
                  {/* Controlli navigazione */}
                  {getTotalPages() > 1 && (
                    <div className="flex items-center gap-2">
                      {/* Prima pagina */}
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                      >
                        ««
                      </button>
                      
                      {/* Pagina precedente */}
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                      >
                        ‹
                      </button>
                      
                      {/* Numeri pagina */}
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
                      
                      {/* Pagina successiva */}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === getTotalPages()}
                        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                      >
                        ›
                      </button>
                      
                      {/* Ultima pagina */}
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
                
                {/* Info pagine */}
                {getTotalPages() > 1 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Pagina {currentPage} di {getTotalPages()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Gestione Pratica APE */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingPratica ? 'Modifica Pratica APE' : 'Nuova Pratica APE'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Prima riga - Committente e Proprietà */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Committente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.committente}
                    onChange={(e) => handleInputChange('committente', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Nome del committente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Proprietà
                  </label>
                  <input
                    type="text"
                    value={formData.proprieta}
                    onChange={(e) => handleInputChange('proprieta', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Nome del proprietario"
                  />
                </div>
              </div>

              {/* Seconda riga - Indirizzo e Città */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Indirizzo
                  </label>
                  <input
                    type="text"
                    value={formData.indirizzo}
                    onChange={(e) => handleInputChange('indirizzo', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Via, numero civico"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Città
                  </label>
                  <input
                    type="text"
                    value={formData.citta}
                    onChange={(e) => handleInputChange('citta', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Città"
                  />
                </div>
              </div>

              {/* Terza riga - Email e Telefono */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.mail}
                    onChange={(e) => handleInputChange('mail', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="email@esempio.com"
                  />
                </div>
                                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                     Telefono
                   </label>
                   <input
                     type="tel"
                     value={formData.telefono}
                     onChange={(e) => handleInputChange('telefono', e.target.value)}
                     className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                     placeholder="123 456 7890"
                     maxLength={12}
                   />
                 </div>
              </div>

              {/* Quarta riga - Stato e Progressivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Stato Registrazione
                  </label>
                  <select
                    value={formData.registrazione || ''}
                    onChange={(e) => handleInputChange('registrazione', e.target.value ? parseInt(e.target.value) : null)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">-- Seleziona stato --</option>
                    {stati.map((stato) => (
                      <option key={stato.id} value={stato.id}>
                        {stato.descrizione}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Progressivo
                    {formData.progressivo && formData.registrazione && stati.find(s => s.id === formData.registrazione && s.descrizione.toLowerCase().includes('completata')) && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">(generato automaticamente)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.progressivo}
                    onChange={(e) => handleInputChange('progressivo', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Sarà generato automaticamente quando 'Completata'"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Note
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                  rows={3}
                  className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                  placeholder="Note aggiuntive..."
                />
              </div>

              {/* Checkbox Pagamento */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stato Pagamento
                </label>
                <div className="flex items-center gap-4">
                  <label className={`relative inline-flex items-center cursor-pointer p-3 rounded-lg border-2 transition-all duration-200 ${
                    formData.pagamento 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.pagamento}
                        onChange={(e) => handleInputChange('pagamento', e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                        formData.pagamento 
                          ? 'bg-green-500 border-green-500' 
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      }`}>
                        {formData.pagamento && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className={`text-sm font-medium transition-colors ${
                        formData.pagamento 
                          ? 'text-green-700 dark:text-green-300' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {formData.pagamento ? 'Pagamento effettuato' : 'Pagamento in sospeso'}
                      </div>
                      <div className={`text-xs transition-colors ${
                        formData.pagamento 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.pagamento ? 'La pratica è stata saldata' : 'In attesa di pagamento'}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Bottoni */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  disabled={submitting}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingPratica ? 'Modifica' : 'Crea'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}; 