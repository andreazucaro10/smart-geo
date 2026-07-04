import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronDown, Edit, Trash2, Check, X, Save, Copy, ArrowRightCircle, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { RubricaAutocomplete } from '../components/RubricaAutocomplete';
import { syncRubricaFromPratica } from '../utils/rubricaSync';
import { ContextMenu } from '../components/ContextMenu';
import type { Ape, StatoApe, Rubrica } from '../types';
import toast from 'react-hot-toast';

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const TriStateFilter = ({ value, onChange }: {
  value: 'all' | 'yes' | 'no';
  onChange: (v: 'all' | 'yes' | 'no') => void;
}) => (
  <div className="flex items-center justify-center gap-0.5">
    <button
      onClick={() => onChange('all')}
      title="Tutti"
      className={`p-1 rounded transition-all ${
        value === 'all'
          ? 'bg-gray-200 dark:bg-gray-600 shadow-sm'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 opacity-50 hover:opacity-100'
      }`}
    >
      <div className="w-2.5 h-0.5 bg-gray-400 dark:bg-gray-500 rounded" />
    </button>
    <button
      onClick={() => onChange('yes')}
      title="Si"
      className={`p-1 rounded transition-all ${
        value === 'yes'
          ? 'bg-gray-200 dark:bg-gray-600 shadow-sm'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 opacity-50 hover:opacity-100'
      }`}
    >
      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
    </button>
    <button
      onClick={() => onChange('no')}
      title="No"
      className={`p-1 rounded transition-all ${
        value === 'no'
          ? 'bg-gray-200 dark:bg-gray-600 shadow-sm'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 opacity-50 hover:opacity-100'
      }`}
    >
      <X className="w-3 h-3 text-red-600 dark:text-red-400" />
    </button>
  </div>
);

interface ApeFormData {
  committente: string;
  proprieta: string;
  proprieta2: string;
  indirizzo: string;
  citta: string;
  mail: string;
  telefono: string;
  telefono2: string;
  note: string;
  registrazione: number | null;
  progressivo: string;
  pagamento: boolean;
  created_at: string;
}

export const ApePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pratiche, setPratiche] = useState<Ape[]>([]);
  const [stati, setStati] = useState<StatoApe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [manualRefreshNeeded, setManualRefreshNeeded] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [columnFilters, setColumnFilters] = useState<{
    stato: string;
    committente: string;
    proprieta: string;
    indirizzo: string;
    citta: string;
    note: string;
    progressivo: string;
  }>({
    stato: '',
    committente: '',
    proprieta: '',
    indirizzo: '',
    citta: '',
    note: '',
    progressivo: ''
  });
  const [filtriAttivi, setFiltriAttivi] = useState({
    soloNonPagate: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    const saved = localStorage.getItem('ape-records-per-page');
    if (saved) {
      const parsed = parseInt(saved);
      if ([25, 50, 100, 200].includes(parsed)) {
        return parsed;
      }
    }
    return 25;
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingPratica, setEditingPratica] = useState<Ape | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pratica: Ape | null }>({ x: 0, y: 0, pratica: null });
  const [showContextMenuActionModal, setShowContextMenuActionModal] = useState<'status' | 'contatto' | null>(null);
  const [selectedPraticaForContextMenu, setSelectedPraticaForContextMenu] = useState<Ape | null>(null);
  const [newStatusForContextMenu, setNewStatusForContextMenu] = useState<string>('');
  const [formData, setFormData] = useState<ApeFormData>({
    committente: '',
    proprieta: '',
    proprieta2: '',
    indirizzo: '',
    citta: '',
    mail: '',
    telefono: '',
    telefono2: '',
    note: '',
    registrazione: null,
    progressivo: '',
    pagamento: false,
    created_at: new Date().toISOString().split('T')[0] // Default to today's date
  });
  const [submitting, setSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuthStore();

  const debouncedCommittente = useDebounce(columnFilters.committente, 300);
  const debouncedProprieta = useDebounce(columnFilters.proprieta, 300);
  const debouncedNote = useDebounce(columnFilters.note, 300);
  const debouncedIndirizzo = useDebounce(columnFilters.indirizzo, 300);
  const debouncedCitta = useDebounce(columnFilters.citta, 300);
  const debouncedProgressivo = useDebounce(columnFilters.progressivo, 300);

  const activeFilterCount = Object.values(columnFilters).filter(val => val !== '').length;

  // Funzione per gestire la selezione di una singola riga
  const handleRowSelection = (id: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Funzione per selezionare/deselezionare tutte le righe
  const handleSelectAll = () => {
    if (selectedRows.size === pratiche.length) {
      // Se tutte le righe sono selezionate, deseleziona tutto
      setSelectedRows(new Set());
    } else {
      // Altrimenti seleziona tutte le righe
      setSelectedRows(new Set(pratiche.map(p => p.id)));
    }
  };

  // Debounce effect: trigger fetch when debounced text values change
  useEffect(() => {
    if (user?.id) {
      setColumnFilters(prev => {
        const newFilters = {
          ...prev,
          committente: debouncedCommittente,
          proprieta: debouncedProprieta,
          note: debouncedNote,
          indirizzo: debouncedIndirizzo,
          citta: debouncedCitta,
          progressivo: debouncedProgressivo
        };
        setTimeout(() => fetchData({ columnFilters: newFilters }), 0);
        return newFilters;
      });
    }
  }, [debouncedCommittente, debouncedProprieta, debouncedNote, debouncedIndirizzo, debouncedCitta, debouncedProgressivo, user?.id]);

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
    if (!contextMenu.pratica) return;

    const handleClick = () => setContextMenu({ x: 0, y: 0, pratica: null });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu({ x: 0, y: 0, pratica: null });
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.pratica]);

  const resetForm = () => {
    setFormData({
      committente: '',
      proprieta: '',
      proprieta2: '',
      indirizzo: '',
      citta: '',
      mail: '',
      telefono: '',
      telefono2: '',
      note: '',
      registrazione: null,
      progressivo: '',
      pagamento: false,
      created_at: new Date().toISOString().split('T')[0]
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
      proprieta2: pratica.proprieta2 || '',
      indirizzo: pratica.indirizzo || '',
      citta: pratica.citta || '',
      mail: pratica.mail || '',
      telefono: pratica.telefono || '',
      telefono2: pratica.telefono2 || '',
      note: pratica.note || '',
      registrazione: pratica.registrazione || null,
      progressivo: pratica.progressivo || '',
      pagamento: pratica.pagamento || false,
      created_at: pratica.created_at ? new Date(pratica.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
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

  // Funzione per combinare i telefoni
  const combineTelefoni = (telefono1: string | null | undefined, telefono2: string | null | undefined): string => {
    const formatted1 = telefono1 ? formatPhoneNumber(telefono1) : '';
    const formatted2 = telefono2 ? formatPhoneNumber(telefono2) : '';
    
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

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      processedValue = formatPhoneNumber(value);
    }
    
    if (name === 'telefono2' && type !== 'checkbox') {
      processedValue = formatPhoneNumber(value);
    }

    // Se stiamo cambiando lo stato di registrazione a "Completata" e non c'è un progressivo
    if (name === 'registrazione' && value && !formData.progressivo.trim()) {
      try {
        const statoId = parseInt(value);
        const progressivoGenerato = await generaProgressivoAutomatico(statoId);
        if (progressivoGenerato) {
          setFormData(prev => ({
            ...prev,
            [name]: statoId,
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
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : processedValue
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
      console.log('Submitting form data:', formData);
      
      // Verifica se dobbiamo generare il progressivo automatico
      let progressivoFinale = formData.progressivo.trim();
      
      // Se la registrazione è cambiata a "Completata" e non c'è già un progressivo
      if (formData.registrazione && !progressivoFinale) {
        progressivoFinale = await generaProgressivoAutomatico(formData.registrazione);
      }

      const dataToSubmit = {
        committente: formData.committente.trim(),
        proprieta: formData.proprieta.trim() || null,
        proprieta2: formData.proprieta2.trim() || null,
        indirizzo: formData.indirizzo.trim() || null,
        citta: formData.citta.trim() || null,
        mail: formData.mail.trim() || null,
        telefono: formData.telefono.trim() || null,
        telefono2: formData.telefono2.trim() || null,
        note: formData.note.trim() || null,
        registrazione: formData.registrazione || null,
        progressivo: progressivoFinale || null,
        pagamento: formData.pagamento,
        created_at: formData.created_at,
        user_id: user?.id
      };

      console.log('Data to submit:', dataToSubmit);

      if (editingPratica) {
        console.log('Updating existing pratica:', editingPratica.id);
        // Modifica - bypassa tutti i controlli e forza il refresh
        const { created_at, ...updateData } = dataToSubmit; // Exclude created_at from update
        const { error } = await supabase
          .from('ape')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPratica.id)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Errore modifica:', error);
          toast.error('Errore nella modifica della pratica APE');
          return;
        }

        // Forza un refresh completo dei dati bypassando il realtime
        console.log('Forcing complete data refresh after edit');
        setForceRefresh(true);
        await fetchData();
        setForceRefresh(false);
        
        if (progressivoFinale && !formData.progressivo.trim()) {
          toast.success('Pratica APE modificata e progressivo generato automaticamente');
        } else {
          toast.success('Pratica APE modificata con successo');
        }
      } else {
        console.log('Creating new pratica');
        // Creazione - forza anche il refresh per le nuove pratiche
        const { error } = await supabase
          .from('ape')
          .insert([dataToSubmit]);

        if (error) {
          console.error('Errore creazione:', error);
          toast.error('Errore nella creazione della pratica APE');
          return;
        }

        // Forza un refresh completo anche per le nuove pratiche
        console.log('Forcing complete data refresh after creation');
        setForceRefresh(true);
        await fetchData();
        setForceRefresh(false);

        if (progressivoFinale && !formData.progressivo.trim()) {
          toast.success('Pratica APE creata e progressivo generato automaticamente');
        } else {
          toast.success('Pratica APE creata con successo');
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
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'operazione');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async (customFilters?: {
    columnFilters?: typeof columnFilters;
    filtriAttivi?: typeof filtriAttivi;
    page?: number;
    perPage?: number;
  }) => {
    try {
      setLoading(true);
      
      if (!user?.id) {
        console.warn('Utente non autenticato, impossibile caricare i dati');
        setLoading(false);
        return;
      }
      
      const currentFilters = customFilters?.columnFilters ?? columnFilters;
      const currentFiltriAttivi = customFilters?.filtriAttivi ?? filtriAttivi;
      const currentPageParam = customFilters?.page ?? currentPage;
      const currentPerPage = customFilters?.perPage ?? recordsPerPage;
      
      const searchParts: string[] = [];
      if (currentFilters.committente.trim()) {
        searchParts.push(`committente.ilike.%${currentFilters.committente}%`);
      }
      if (currentFilters.proprieta.trim()) {
        searchParts.push(`proprieta.ilike.%${currentFilters.proprieta}%,proprieta2.ilike.%${currentFilters.proprieta}%`);
      }
      if (currentFilters.indirizzo.trim()) {
        searchParts.push(`indirizzo.ilike.%${currentFilters.indirizzo}%`);
      }
      if (currentFilters.citta.trim()) {
        searchParts.push(`citta.ilike.%${currentFilters.citta}%`);
      }
      if (currentFilters.note.trim()) {
        searchParts.push(`note.ilike.%${currentFilters.note}%`);
      }
      if (currentFilters.progressivo.trim()) {
        searchParts.push(`progressivo.ilike.%${currentFilters.progressivo}%`);
      }

      let countQuery = supabase
        .from('ape')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      if (searchParts.length > 0) {
        countQuery = countQuery.or(searchParts.join(','));
      }

      if (currentFilters.stato) {
        countQuery = countQuery.eq('registrazione', parseInt(currentFilters.stato));
      }

      let statiFiltroNonPagata: number[] = [];
      if (currentFiltriAttivi.soloNonPagate) {
        const { data: statiNonPagata } = await supabase
          .from('stati_ape')
          .select('id')
          .eq('filtro_non_pagata', 1);
        statiFiltroNonPagata = (statiNonPagata || []).map((s: { id: number }) => s.id);
      }

      if (currentFiltriAttivi.soloNonPagate) {
        if (statiFiltroNonPagata.length > 0) {
          countQuery = countQuery.eq('pagamento', false).in('registrazione', statiFiltroNonPagata);
        } else {
          countQuery = countQuery.eq('pagamento', false);
        }
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Errore nel conteggio:', countError);
        if (countError.message?.includes('JWT') || countError.message?.includes('session')) {
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
        }
      } else {
        setTotalRecords(count || 0);
      }
      
      let query = supabase
        .from('ape')
        .select(`
          *,
          registrazione_info:stati_ape(id, descrizione, colore, ordinamento)
        `)
        .eq('user_id', user?.id)
        .order('registrazione', { ascending: true })
        .order('created_at', { ascending: false })
        .order('progressivo', { ascending: false, nullsFirst: true });

      if (searchParts.length > 0) {
        query = query.or(searchParts.join(','));
      }

      if (currentFilters.stato) {
        query = query.eq('registrazione', parseInt(currentFilters.stato));
      }

      if (currentFiltriAttivi.soloNonPagate) {
        if (statiFiltroNonPagata.length > 0) {
          query = query.eq('pagamento', false).in('registrazione', statiFiltroNonPagata);
        } else {
          query = query.eq('pagamento', false);
        }
      }

      const from = (currentPageParam - 1) * currentPerPage;
      const to = from + currentPerPage - 1;
      query = query.range(from, to);

      const { data: praticheData, error: praticheError } = await query;

      if (praticheError) {
        console.error('Errore nel caricamento pratiche APE:', praticheError);
        if (praticheError.message?.includes('JWT') || praticheError.message?.includes('session')) {
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
        } else {
          toast.error('Errore nel caricamento delle pratiche APE');
        }
        return;
      }

      const { data: statiData, error: statiError } = await supabase
        .from('stati_ape')
        .select('*')
        .order('ordinamento', { ascending: true });

      if (statiError) {
        console.error('Errore caricamento stati APE:', statiError);
      } else {
        setStati(statiData || []);
      }

      const sortedData = [...(praticheData || [])].sort((a, b) => {
        const ordinamentoA = a.registrazione_info?.ordinamento ?? Infinity;
        const ordinamentoB = b.registrazione_info?.ordinamento ?? Infinity;
        if (ordinamentoA !== ordinamentoB) return ordinamentoA - ordinamentoB;

        const createdCompare = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (createdCompare !== 0) return createdCompare;

        const progressivoA = a.progressivo || '';
        const progressivoB = b.progressivo || '';
        return progressivoB.localeCompare(progressivoA, undefined, { numeric: true, sensitivity: 'base' });
      });

      setPratiche(sortedData);
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      if (authLoading) {
        console.log('Autenticazione in corso...');
        return;
      }

      if (user?.id) {
        console.log('User autenticato, caricamento dati...');
        await fetchData();
      }
      else if (user === null) {
        console.warn('User non autenticato');
        setLoading(false);
      }
    };

    initializeData();
  }, [user?.id, authLoading]);

  // Setup Supabase Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up realtime subscription for user:', user.id);

    // Create a channel for realtime updates
    const channel = supabase
      .channel('ape-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'ape',
          filter: `user_id=eq.${user.id}` // Only listen to changes for current user
        },
        async (payload) => {
          console.log('Realtime update received:', payload);
          setLastUpdateTime(new Date());
          setManualRefreshNeeded(false); // Reset manual refresh flag when realtime works
          if (forceRefresh) {
            console.log('Skipping realtime update due to force refresh');
            return; // Skip realtime updates when force refresh is active
          }
          
          // Simple update logic - just update the local state for any change
          if (payload.eventType === 'INSERT') {
            // For INSERT, fetch the complete record with joined data
            const { data: newRecord, error } = await supabase
              .from('ape')
              .select(`
                *,
                registrazione_info:stati_ape(id, descrizione, colore, ordinamento)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && newRecord) {
              setPratiche(prev => {
                // Check if it already exists to avoid duplicates
                if (prev.some(p => p.id === newRecord.id)) {
                  return prev;
                }
                return [newRecord, ...prev];
              });
              setTotalRecords(prev => prev + 1);
              toast.success('Nuova pratica APE aggiunta');
              // Refresh available years in case a new year was added
              fetchAvailableYears();
            }
          }
          else if (payload.eventType === 'UPDATE') {
            // For UPDATE, fetch the complete record with joined data
            const { data: updatedRecord, error } = await supabase
              .from('ape')
              .select(`
                *,
                registrazione_info:stati_ape(id, descrizione, colore, ordinamento)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && updatedRecord) {
              // Simple update - just replace the record in the array
              setPratiche(prev =>
                prev.map(pratica =>
                  pratica.id === updatedRecord.id ? updatedRecord : pratica
                )
              );
              
              // Show specific toast based on what changed
              const oldPratica = payload.old as Ape;
              if (oldPratica.pagamento !== updatedRecord.pagamento) {
                toast.success(updatedRecord.pagamento ? 'Pagamento marcato come effettuato' : 'Pagamento marcato come non effettuato');
              }
              if (oldPratica.registrazione !== updatedRecord.registrazione) {
                const oldStato = stati.find(s => s.id === oldPratica.registrazione)?.descrizione || 'N/A';
                const newStato = stati.find(s => s.id === updatedRecord.registrazione)?.descrizione || 'N/A';
                toast.success(`Stato cambiato da "${oldStato}" a "${newStato}"`);
              }
              // Refresh available years in case created_at was updated (though unlikely)
              fetchAvailableYears();
            }
          }
          else if (payload.eventType === 'DELETE') {
            // Remove deleted record
            const deletedId = payload.old.id;
            setPratiche(prev => prev.filter(pratica => pratica.id !== deletedId));
            setTotalRecords(prev => Math.max(0, prev - 1));
            toast.success('Pratica APE eliminata');
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [user?.id, stati]);

  const handleColumnFilterChange = useCallback((key: keyof typeof columnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleApplyFilter = (overrides: Partial<typeof columnFilters>) => {
    const newFilters = { ...columnFilters, ...overrides };
    setColumnFilters(newFilters);
    setCurrentPage(1);
    fetchData({ columnFilters: newFilters, page: 1 });
  };

  const handleResetFilters = () => {
    const defaultFilters: typeof columnFilters = {
      stato: '', committente: '', proprieta: '', indirizzo: '', citta: '', note: '', progressivo: ''
    };
    setColumnFilters(defaultFilters);
    setCurrentPage(1);
    fetchData({ columnFilters: defaultFilters, page: 1 });
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
    localStorage.setItem('ape-records-per-page', newRecordsPerPage.toString());
    setCurrentPage(1);
    fetchData({
      perPage: newRecordsPerPage,
      page: 1
    });
  };

  const handleDuplicatePratica = async (pratica: Ape) => {
    try {
      // Crea una copia della pratica escludendo id, created_at, updated_at, progressivo e campi joined
      const { id, created_at, updated_at, progressivo, registrazione_info, ...praticaData } = pratica;

      // Resetta i campi che devono essere resettati per la duplicazione
      const duplicatedData = {
        ...praticaData,
        committente: `${praticaData.committente}`,
        registrazione: 1,
        pagamento: false,
        created_at: new Date().toISOString(), // Set new creation date for duplicated record
        user_id: user?.id
      };

      // Inserisci la nuova pratica
      const { error } = await supabase
        .from('ape')
        .insert([duplicatedData]);

      if (error) {
        console.error('Errore duplicazione pratica:', error);
        toast.error('Errore nella duplicazione della pratica APE');
        return;
      }

      // Forza un refresh completo dei dati
      await fetchData();
      toast.success('Pratica APE duplicata con successo');

      // Deseleziona le righe dopo la duplicazione
      setSelectedRows(new Set());
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nella duplicazione della pratica');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, pratica: Ape) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pratica });
  };

  const handleContextMenuAction = (action: 'edit' | 'status' | 'contact' | 'duplicate' | 'delete', pratica: Ape) => {
    setContextMenu({ x: 0, y: 0, pratica: null });
    if (action === 'edit') {
      openEditModal(pratica);
    } else if (action === 'status') {
      setSelectedPraticaForContextMenu(pratica);
      setNewStatusForContextMenu(pratica.registrazione?.toString() || '');
      setShowContextMenuActionModal('status');
    } else if (action === 'contact') {
      setSelectedPraticaForContextMenu(pratica);
      setShowContextMenuActionModal('contatto');
    } else if (action === 'duplicate') {
      handleDuplicatePratica(pratica);
    } else if (action === 'delete') {
      handleDeletePratica(pratica.id);
    }
  };

  const handleChangeStatusFromContextMenu = async () => {
    if (!selectedPraticaForContextMenu || !newStatusForContextMenu) return;
    
    const { error } = await supabase
      .from('ape')
      .update({ registrazione: parseInt(newStatusForContextMenu) })
      .eq('id', selectedPraticaForContextMenu.id)
      .eq('user_id', user?.id);
      
    if (error) {
      toast.error('Errore nel cambio stato');
    } else {
      toast.success('Stato aggiornato con successo');
      setShowContextMenuActionModal(null);
      setSelectedPraticaForContextMenu(null);
      fetchData();
    }
  };

  const getTotalPages = () => {
    return Math.ceil(totalRecords / recordsPerPage);
  };

  const handleTogglePagamento = async (pratica: Ape) => {
    try {
      const nuovoPagamento = !pratica.pagamento;
      console.log('Toggling pagamento for pratica', pratica.id, 'from', pratica.pagamento, 'to', nuovoPagamento);
      
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

      // Forza un aggiornamento locale immediato per feedback visivo istantaneo
      setPratiche(prev =>
        prev.map(p =>
          p.id === pratica.id ? { ...p, pagamento: nuovoPagamento } : p
        )
      );

      toast.success(nuovoPagamento ? 'Pagamento marcato come effettuato' : 'Pagamento marcato come non effettuato');
      
      // Se il realtime non funziona o stiamo forzando il refresh, marca che serve un refresh manuale
      setTimeout(() => {
        if (!realtimeConnected || forceRefresh) {
          setManualRefreshNeeded(true);
        }
      }, 2000);
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
      console.log('Deleting pratica:', id);
      
      const { error } = await supabase
        .from('ape')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della pratica');
        return;
      }

      // Forza un refresh completo anche per l'eliminazione
      console.log('Forcing complete data refresh after deletion');
      setForceRefresh(true);
      await fetchData();
      setForceRefresh(false);

      toast.success('Pratica APE eliminata con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const getStatoStyle = (stato: StatoApe | undefined) => {
    if (!stato || !stato.colore) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    return `text-white`;
  };

  const getStatoBackgroundColor = (stato: StatoApe | undefined) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  return (
    <div className="h-full flex flex-col px-4">
      <div className="space-y-3 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestione APE</h1>
            <p className="text-gray-600 dark:text-gray-300">Gestione pratiche APE</p>
            {realtimeConnected && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 dark:text-green-400">
                  Aggiornamenti in tempo reale attivi
                  {lastUpdateTime && (
                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                      (ultimo: {lastUpdateTime.toLocaleTimeString('it-IT')})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
                Reset filtri
                <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              </button>
            )}
            {manualRefreshNeeded && (
              <button
                onClick={() => {
                  fetchData();
                  setManualRefreshNeeded(false);
                }}
                className="btn btn-outline flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                title="Aggiorna dati"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Aggiorna
              </button>
            )}
            <button
              onClick={openCreateModal}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuova Pratica APE
            </button>
          </div>
        </div>

        {/* Filtri toggle */}
        <div className="flex flex-wrap gap-4">
          <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
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

      {/* Sezione azioni multiple (appare solo quando ci sono righe selezionate) */}
      {selectedRows.size > 0 && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400">
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectedRows.size} pratica{selectedRows.size !== 1 ? 'he' : ''} selezionata{selectedRows.size !== 1 ? 'e' : ''}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary flex items-center gap-2"
                  disabled={selectedRows.size !== 1}
                  onClick={() => {
                    const selectedPratica = pratiche.find(p => selectedRows.has(p.id));
                    if (selectedPratica) {
                      handleDuplicatePratica(selectedPratica);
                    }
                  }}
                >
                  Duplica pratica
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenuto principale */}
      {loading ? (
        <div className="card p-0 dark:bg-gray-800 dark:border-gray-700 flex-1" style={{ height: 'calc(100vh - 300px)', overflow: 'hidden' }}>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-500 dark:text-gray-400">Caricamento...</span>
          </div>
        </div>
      ) : pratiche.length === 0 ? (
        <div className="card p-0 dark:bg-gray-800 dark:border-gray-700 flex-1" style={{ height: 'calc(100vh - 300px)', overflow: 'hidden' }}>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-300 text-center">Nessuna pratica APE trovata.</p>
          </div>
        </div>
      ) : (
        /* Tabella */
        <div className="card p-0 dark:bg-gray-800 dark:border-gray-700 flex-1" style={{ height: 'calc(100vh - 300px)', overflow: 'hidden' }}>
          <div className="overflow-x-auto h-full overflow-y-auto">
            <table className="w-full" style={{ minHeight: '400px' }}>
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === pratiche.length && pratiche.length > 0}
                        onChange={handleSelectAll}
                        className="sr-only"
                        title={selectedRows.size === pratiche.length ? "Deseleziona tutto" : "Seleziona tutto"}
                      />
                      <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
                        selectedRows.size === pratiche.length && pratiche.length > 0
                          ? 'border-blue-600 bg-blue-600 dark:border-blue-400 dark:bg-blue-400'
                          : 'border-gray-300 dark:border-gray-600 bg-transparent'
                      }`}>
                        {selectedRows.size === pratiche.length && pratiche.length > 0 && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </label>
                  </th>
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
                    Note
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Progressivo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Pagamento
                  </th>
                </tr>
                {/* Riga filtri inline */}
                <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                  <td className="px-2 py-1.5"></td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <select
                        value={columnFilters.stato}
                        onChange={(e) => handleApplyFilter({ stato: e.target.value })}
                        className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="" className="bg-white dark:bg-gray-700 dark:text-gray-200">Tutti</option>
                        {stati.map((stato) => (
                          <option key={stato.id} value={stato.id} className="bg-white dark:bg-gray-700 dark:text-gray-200">
                            {stato.descrizione}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={columnFilters.committente}
                      onChange={(e) => handleColumnFilterChange('committente', e.target.value)}
                      placeholder="Cerca..."
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={columnFilters.proprieta}
                      onChange={(e) => handleColumnFilterChange('proprieta', e.target.value)}
                      placeholder="Cerca..."
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={columnFilters.indirizzo}
                      onChange={(e) => handleColumnFilterChange('indirizzo', e.target.value)}
                      placeholder="Cerca..."
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={columnFilters.citta}
                      onChange={(e) => handleColumnFilterChange('citta', e.target.value)}
                      placeholder="Cerca..."
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={columnFilters.note}
                      onChange={(e) => handleColumnFilterChange('note', e.target.value)}
                      placeholder="Cerca..."
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={columnFilters.progressivo}
                      onChange={(e) => handleColumnFilterChange('progressivo', e.target.value)}
                      placeholder="Cerca..."
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-1.5"></td>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {pratiche.map((pratica) => (
                  <tr key={pratica.id} className="hover:bg-gray-50 dark:hover:bg-gray-700" onContextMenu={(e) => handleContextMenu(e, pratica)}>
                    <td className="px-4 py-3 text-center">
                      <label className="flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(pratica.id)}
                          onChange={() => handleRowSelection(pratica.id)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
                          selectedRows.has(pratica.id)
                            ? 'border-blue-600 bg-blue-600 dark:border-blue-400 dark:bg-blue-400'
                            : 'border-gray-300 dark:border-gray-600 bg-transparent'
                        }`}>
                          {selectedRows.has(pratica.id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getStatoStyle(pratica.registrazione_info)}`}
                        style={{ backgroundColor: getStatoBackgroundColor(pratica.registrazione_info) }}
                      >
                        {pratica.registrazione_info?.descrizione || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {pratica.committente}
                    </td>
                     <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                       {combineProprieta(pratica.proprieta, pratica.proprieta2)}
                     </td>
                     <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                       {pratica.indirizzo || '-'}
                     </td>
                     <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                       {pratica.citta || '-'}
                     </td>
                     <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {pratica.note || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.progressivo || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleTogglePagamento(pratica)}
                        className="transition-colors cursor-pointer"
                        title="Clicca per cambiare stato"
                      >
                        {renderToggleButton(pratica.pagamento)}
                      </button>
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

      </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Committente *
                    </label>
                    <input
                      type="text"
                      name="committente"
                      required
                      value={formData.committente}
                      onChange={handleInputChange}
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="Nome del committente"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Proprietà
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
                      placeholder="Nome del proprietario"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Proprietà 2
                    </label>
                    <input
                      type="text"
                      name="proprieta2"
                      value={formData.proprieta2}
                      onChange={handleInputChange}
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="Nome secondo proprietario"
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
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="Via, numero civico"
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
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="Città"
                    />
                  </div>

                  <div className="pt-4">
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
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="XXX XXX XXXX"
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
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="XXX XXX XXXX"
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
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="email@esempio.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stato Registrazione
                    </label>
                    <div className="relative">
                      <select
                        name="registrazione"
                        value={formData.registrazione || ''}
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
                      Data Creazione
                    </label>
                    <input
                      type="date"
                      name="created_at"
                      value={formData.created_at}
                      onChange={handleInputChange}
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
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
                      name="progressivo"
                      value={formData.progressivo}
                      onChange={handleInputChange}
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      placeholder="Sarà generato automaticamente quando 'Completata'"
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

      {/* Menu Contestuale */}
      {contextMenu.pratica && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}>
          <button
            onClick={() => handleContextMenuAction('edit', contextMenu.pratica!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Edit className="w-4 h-4 text-blue-500" />
            Modifica
          </button>
          <button
            onClick={() => handleContextMenuAction('status', contextMenu.pratica!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowRightCircle className="w-4 h-4 text-yellow-500" />
            Cambia stato
          </button>
          <button
            onClick={() => handleContextMenuAction('contact', contextMenu.pratica!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <User className="w-4 h-4 text-purple-500" />
            Contatto
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-600" />
          <button
            onClick={() => handleContextMenuAction('duplicate', contextMenu.pratica!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Copy className="w-4 h-4 text-green-500" />
            Duplica
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-600" />
          <button
            onClick={() => handleContextMenuAction('delete', contextMenu.pratica!)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Elimina
          </button>
        </ContextMenu>
      )}

      {/* Modal Cambia Stato da Menu Contestuale */}
      {showContextMenuActionModal === 'status' && selectedPraticaForContextMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cambia Stato - {selectedPraticaForContextMenu.committente}
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
                  setSelectedPraticaForContextMenu(null);
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
      {showContextMenuActionModal === 'contatto' && selectedPraticaForContextMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Contatto - {selectedPraticaForContextMenu.committente}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proprietario</label>
                <p className="text-gray-900 dark:text-white">{selectedPraticaForContextMenu.proprieta || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefono</label>
                <p className="text-gray-900 dark:text-white">{selectedPraticaForContextMenu.telefono || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <p className="text-gray-900 dark:text-white">{selectedPraticaForContextMenu.mail || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indirizzo</label>
                <p className="text-gray-900 dark:text-white">
                  {selectedPraticaForContextMenu.indirizzo || '-'}{selectedPraticaForContextMenu.citta ? `, ${selectedPraticaForContextMenu.citta}` : ''}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowContextMenuActionModal(null);
                  setSelectedPraticaForContextMenu(null);
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