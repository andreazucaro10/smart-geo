import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronDown, Edit, Trash2, Check, X, Copy, ArrowRightCircle, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { RubricaAutocomplete } from '../components/RubricaAutocomplete';
import { syncRubricaFromPratica } from '../utils/rubricaSync';
import type { Varie, StatoGenerale, TipoIncarico, Rubrica } from '../types';
import toast from 'react-hot-toast';

export const VariePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [varie, setVarie] = useState<Varie[]>([]);
  const [stati, setStati] = useState<StatoGenerale[]>([]);
  const [tipiIncarico, setTipiIncarico] = useState<TipoIncarico[]>([]);
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; varia: Varie | null }>({ x: 0, y: 0, varia: null });
  const [showContextMenuActionModal, setShowContextMenuActionModal] = useState<'status' | 'contatto' | null>(null);
  const [selectedVariaForContextMenu, setSelectedVariaForContextMenu] = useState<Varie | null>(null);
  const [newStatusForContextMenu, setNewStatusForContextMenu] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    committente: '',
    proprieta: '',
    proprieta2: '',
    indirizzo: '',
    citta: '',
    telefono: '',
    telefono2: '',
    mail: '',
    registrazione: '',
    tipo_incarico: '',
    pagamento: false,
    acconto: false,
    omaggio: false,
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

  // Chiusura menu contestuale al click esterno o tasto ESC
  useEffect(() => {
    if (!contextMenu.varia) return;

    const handleClick = () => setContextMenu({ x: 0, y: 0, varia: null });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu({ x: 0, y: 0, varia: null });
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.varia]);

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
        countQuery = countQuery.or(`committente.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,proprieta2.ilike.%${currentSearchTerm}%,citta.ilike.%${currentSearchTerm}%,mail.ilike.%${currentSearchTerm}%,note.ilike.%${currentSearchTerm}%,telefono.ilike.%${currentSearchTerm}%,telefono2.ilike.%${currentSearchTerm}%,tipo_incarico.ilike.%${currentSearchTerm}%`);
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
        .order('registrazione', { ascending: true });

      // Applica filtri
      if (currentSearchTerm) {
        query = query.or(`committente.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,proprieta2.ilike.%${currentSearchTerm}%,citta.ilike.%${currentSearchTerm}%,mail.ilike.%${currentSearchTerm}%,note.ilike.%${currentSearchTerm}%,telefono.ilike.%${currentSearchTerm}%,telefono2.ilike.%${currentSearchTerm}%,tipo_incarico.ilike.%${currentSearchTerm}%`);
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

      // Carica tipi incarico
      const { data: tipiData, error: tipiError } = await supabase
        .from('tipi_incarico')
        .select('*')
        .order('descrizione');

      if (tipiError) {
        console.error('Errore caricamento tipi incarico:', tipiError);
      } else {
        setTipiIncarico(tipiData || []);
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

  const handleContextMenu = (e: React.MouseEvent, varia: Varie) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, varia });
  };

  const handleContextMenuAction = (action: 'edit' | 'status' | 'contact' | 'duplicate' | 'delete', varia: Varie) => {
    setContextMenu({ x: 0, y: 0, varia: null });
    if (action === 'edit') {
      openModal(varia);
    } else if (action === 'status') {
      setSelectedVariaForContextMenu(varia);
      setNewStatusForContextMenu(varia.registrazione?.toString() || '');
      setShowContextMenuActionModal('status');
    } else if (action === 'contact') {
      setSelectedVariaForContextMenu(varia);
      setShowContextMenuActionModal('contatto');
    } else if (action === 'duplicate') {
      handleDuplicateVaria(varia);
    } else if (action === 'delete') {
      handleDeleteVaria(varia.id);
    }
  };

  const handleChangeStatusFromContextMenu = async () => {
    if (!selectedVariaForContextMenu || !newStatusForContextMenu) return;
    
    const { error } = await supabase
      .from('varie')
      .update({ registrazione: parseInt(newStatusForContextMenu) })
      .eq('id', selectedVariaForContextMenu.id)
      .eq('user_id', user?.id);
      
    if (error) {
      toast.error('Errore nel cambio stato');
    } else {
      toast.success('Stato aggiornato con successo');
      setShowContextMenuActionModal(null);
      setSelectedVariaForContextMenu(null);
      fetchData();
    }
  };

  const handleDuplicateVaria = async (varia: Varie) => {
    try {
      const { id, created_at, updated_at, progressivo, ...variaData } = varia;
      
      const duplicatedData = {
        ...variaData,
        committente: `${variaData.committente}`,
        registrazione: 1,
        pagamento: false,
        created_at: new Date().toISOString(),
        user_id: user?.id
      };

      const { error } = await supabase
        .from('varie')
        .insert([duplicatedData]);

      if (error) {
        console.error('Errore duplicazione varia:', error);
        toast.error('Errore nella duplicazione della varia');
        return;
      }

      await fetchData();
      toast.success('Varia duplicata con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nella duplicazione della varia');
    }
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

  const handleToggleField = async (varia: Varie, field: 'pagamento' | 'acconto' | 'omaggio') => {
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

  // Funzione per combinare i telefoni
  const combineTelefoni = (telefono1: string | null | undefined, telefono2: string | null | undefined): string => {
    const formatted1 = telefono1 ? formatTelefono(telefono1) : '';
    const formatted2 = telefono2 ? formatTelefono(telefono2) : '';

    if (!formatted1 && !formatted2) return '-';
    if (!formatted2) return formatted1;
    if (!formatted1) return formatted2;

    return `${formatted1} / ${formatted2}`;
  };

  // Funzione per combinare le proprietà
  const combineProprieta = (proprieta1: string | null | undefined, proprieta2: string | null | undefined): string => {
    if (!proprieta1 && !proprieta2) return '-';
    if (!proprieta2) return proprieta1 || '-';
    if (!proprieta1) return proprieta2 || '-';

    return `${proprieta1} / ${proprieta2}`;
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

    if (name === 'telefono2' && type !== 'checkbox') {
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
        tipo_incarico: formData.tipo_incarico.trim() || null,
        proprieta2: formData.proprieta2.trim() || null,
        telefono2: formData.telefono2.trim() || null,
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

        // Creazione automatica pratica APE se il tipo di incarico ha il flag ape
        if (dataToSave.tipo_incarico) {
          const tipoIncaricoTrovato = tipiIncarico.find(
            t => t.descrizione.toLowerCase() === dataToSave.tipo_incarico!.toLowerCase()
          );
          if (tipoIncaricoTrovato?.ape) {
            try {
              const { error: apeError } = await supabase
                .from('ape')
                .insert([{
                  committente: formData.committente.trim(),
                  proprieta: formData.proprieta.trim() || null,
                  proprieta2: formData.proprieta2.trim() || null,
                  indirizzo: formData.indirizzo.trim() || null,
                  citta: formData.citta.trim() || null,
                  mail: formData.mail.trim() || null,
                  telefono: formData.telefono.trim() || null,
                  telefono2: formData.telefono2.trim() || null,
                  note: formData.note.trim() || null,
                  registrazione: 1,
                  progressivo: '',
                  pagamento: false,
                  user_id: user?.id
                }]);

              if (apeError) {
                console.error('Errore creazione pratica APE:', apeError);
                toast.error('Varia creata ma errore nella creazione della pratica APE');
              } else {
                toast.success('Pratica APE creata automaticamente');
              }
            } catch (apeError) {
              console.error('Errore creazione pratica APE:', apeError);
            }
          }
        }
      }

      // Sync contatto con rubrica
      await syncRubricaFromPratica(
        formData.proprieta,
        formData.telefono,
        formData.mail,
        formData.committente
      );

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
        proprieta2: varia.proprieta2 || '',
        indirizzo: varia.indirizzo || '',
        citta: varia.citta || '',
        telefono: varia.telefono || '',
        telefono2: varia.telefono2 || '',
        mail: varia.mail || '',
        registrazione: varia.registrazione?.toString() || '',
        tipo_incarico: varia.tipo_incarico || '',
        pagamento: varia.pagamento,
        acconto: varia.acconto,
        omaggio: varia.omaggio,
        note: varia.note || ''
      });
    } else {
      setEditingVaria(null);
      setFormData({
        committente: '',
        proprieta: '',
        proprieta2: '',
        indirizzo: '',
        citta: '',
        telefono: '',
        telefono2: '',
        mail: '',
        registrazione: '',
        tipo_incarico: '',
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
      proprieta2: '',
      indirizzo: '',
      citta: '',
      telefono: '',
      telefono2: '',
      mail: '',
      registrazione: '',
      tipo_incarico: '',
      pagamento: false,
      acconto: false,
      omaggio: false,
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
        className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 ${value
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
          <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${filtriAttivi.nonPagati
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}>
            <input
              type="checkbox"
              checked={filtriAttivi.nonPagati}
              onChange={() => handleFilterToggle('nonPagati')}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${filtriAttivi.nonPagati
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tipo Incarico</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Committente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Proprietario</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pagamento</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acconto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Omaggio</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Note</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading || authLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nessuna varia trovata
                  </td>
                </tr>
              ) : (
                varie.map((varia) => (
                  <tr key={varia.id} className="hover:bg-gray-50 dark:hover:bg-gray-700" onContextMenu={(e) => handleContextMenu(e, varia)}>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getStatoStyle(varia.registrazione_info)}`}
                        style={{ backgroundColor: getStatoBackgroundColor(varia.registrazione_info) }}
                      >
                        {varia.registrazione_info?.descrizione || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{varia.tipo_incarico || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{varia.committente}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{combineProprieta(varia.proprieta, varia.proprieta2)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleField(varia, 'pagamento')}
                        className="transition-colors cursor-pointer"
                        title="Clicca per cambiare stato"
                      >
                        {renderToggleButton(varia.pagamento)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleField(varia, 'acconto')}
                        className="transition-colors cursor-pointer"
                        title="Clicca per cambiare stato"
                      >
                        {renderToggleButton(varia.acconto)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleField(varia, 'omaggio')}
                        className="transition-colors cursor-pointer"
                        title="Clicca per cambiare stato"
                      >
                        {renderToggleButton(varia.omaggio)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">{varia.note || '-'}</td>
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
                          className={`px-3 py-1 text-sm border rounded ${currentPage === pageNum
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
                    <RubricaAutocomplete
                      value={formData.proprieta}
                      onChange={(val) => setFormData(prev => ({ ...prev, proprieta: val }))}
                      onSelect={(contatto: Rubrica) => {
                        setFormData(prev => ({
                          ...prev,
                          proprieta: contatto.nominativo,
                          telefono: contatto.telefono || '',
                          mail: contatto.email || ''
                        }));
                      }}
                      placeholder="Nome proprietario"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Proprietario 2
                    </label>
                    <input
                      type="text"
                      name="proprieta2"
                      value={formData.proprieta2}
                      onChange={handleInputChange}
                      placeholder="Nome secondo proprietario"
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

                <div className="space-y-4">
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Telefono 2
                    </label>
                    <input
                      type="tel"
                      name="telefono2"
                      value={formData.telefono2}
                      onChange={handleInputChange}
                      placeholder="XXX XXX XXXX"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipo Incarico
                    </label>
                    <input
                      type="text"
                      name="tipo_incarico"
                      value={formData.tipo_incarico}
                      onChange={handleInputChange}
                      placeholder="Tipo di incarico"
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border-2 ${formData.pagamento
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
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${formData.pagamento
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
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border-2 ${formData.acconto
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300 cursor-pointer'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
                      }`}>
                      <input
                        type="checkbox"
                        name="acconto"
                        checked={formData.acconto}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${formData.acconto
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 dark:border-gray-500 bg-transparent'
                        }`}>
                        {formData.acconto && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">Acconto</span>
                    </label>
                  </div>

                  <div>
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border-2 ${formData.omaggio
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300 cursor-pointer'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
                      }`}>
                      <input
                        type="checkbox"
                        name="omaggio"
                        checked={formData.omaggio}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${formData.omaggio
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 dark:border-gray-500 bg-transparent'
                        }`}>
                        {formData.omaggio && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">Omaggio</span>
                    </label>
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

      {/* Menu Contestuale */}
      {contextMenu.varia && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleContextMenuAction('edit', contextMenu.varia!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Edit className="w-4 h-4 text-blue-500" />
            Modifica
          </button>
          <button
            onClick={() => handleContextMenuAction('status', contextMenu.varia!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowRightCircle className="w-4 h-4 text-yellow-500" />
            Cambia stato
          </button>
          <button
            onClick={() => handleContextMenuAction('contact', contextMenu.varia!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <User className="w-4 h-4 text-purple-500" />
            Contatto
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-600" />
          <button
            onClick={() => handleContextMenuAction('duplicate', contextMenu.varia!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Copy className="w-4 h-4 text-green-500" />
            Duplica
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-600" />
          <button
            onClick={() => handleContextMenuAction('delete', contextMenu.varia!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Elimina
          </button>
        </div>
      )}

      {/* Modal Cambia Stato da Menu Contestuale */}
      {showContextMenuActionModal === 'status' && selectedVariaForContextMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cambia Stato - {selectedVariaForContextMenu.committente}
            </h3>
            <select
              value={newStatusForContextMenu}
              onChange={(e) => setNewStatusForContextMenu(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleziona stato</option>
              {stati.map((stato) => (
                <option key={stato.id} value={stato.id}>
                  {stato.descrizione}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowContextMenuActionModal(null);
                  setSelectedVariaForContextMenu(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleChangeStatusFromContextMenu}
                disabled={!newStatusForContextMenu}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contatto da Menu Contestuale */}
      {showContextMenuActionModal === 'contatto' && selectedVariaForContextMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Contatto - {selectedVariaForContextMenu.committente}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proprietario</label>
                <p className="text-gray-900 dark:text-white">{selectedVariaForContextMenu.proprieta || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefono</label>
                <p className="text-gray-900 dark:text-white">{selectedVariaForContextMenu.telefono || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <p className="text-gray-900 dark:text-white">{selectedVariaForContextMenu.mail || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indirizzo</label>
                <p className="text-gray-900 dark:text-white">
                  {selectedVariaForContextMenu.indirizzo || '-'}{selectedVariaForContextMenu.citta ? `, ${selectedVariaForContextMenu.citta}` : ''}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowContextMenuActionModal(null);
                  setSelectedVariaForContextMenu(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 