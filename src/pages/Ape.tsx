import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronDown, Edit, Trash2, Check, X, Save } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { Ape, StatoApe } from '../types';
import toast from 'react-hot-toast';

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
}

export const ApePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pratiche, setPratiche] = useState<Ape[]>([]);
  const [stati, setStati] = useState<StatoApe[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [manualRefreshNeeded, setManualRefreshNeeded] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
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
    proprieta2: '',
    indirizzo: '',
    citta: '',
    mail: '',
    telefono: '',
    telefono2: '',
    note: '',
    registrazione: null,
    progressivo: '',
    pagamento: false
  });
  const [submitting, setSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuthStore();

  // Gestione parametri URL per filtri automatici
  useEffect(() => {
    const filter = searchParams.get('filter');
    let newFiltriAttivi = { ...filtriAttivi };
    
    if (filter === 'non_pagate') {
      newFiltriAttivi = { ...newFiltriAttivi, soloNonPagate: true };
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
      proprieta2: pratica.proprieta2 || '',
      indirizzo: pratica.indirizzo || '',
      citta: pratica.citta || '',
      mail: pratica.mail || '',
      telefono: pratica.telefono || '',
      telefono2: pratica.telefono2 || '',
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
        user_id: user?.id
      };

      console.log('Data to submit:', dataToSubmit);

      if (editingPratica) {
        console.log('Updating existing pratica:', editingPratica.id);
        // Modifica - bypassa tutti i controlli e forza il refresh
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

      closeModal();
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
        .from('ape')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Applica filtri al conteggio
      if (currentSearchTerm) {
        countQuery = countQuery.or(`committente.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,proprieta2.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,progressivo.ilike.%${currentSearchTerm}%`);
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
        // Se l'errore è relativo alla sessione, mostra un messaggio specifico
        if (countError.message?.includes('JWT') || countError.message?.includes('session')) {
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
        }
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
        .order('registrazione', { ascending: false })
        .order('progressivo', { ascending: false });

      // Applica filtri
      if (currentSearchTerm) {
        query = query.or(`committente.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,proprieta2.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,progressivo.ilike.%${currentSearchTerm}%`);
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
        // Se l'errore è relativo alla sessione, mostra un messaggio specifico
        if (praticheError.message?.includes('JWT') || praticheError.message?.includes('session')) {
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
        } else {
          toast.error('Errore nel caricamento delle pratiche APE');
        }
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
                registrazione_info:stati_ape(id, descrizione, colore)
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
            }
          }
          else if (payload.eventType === 'UPDATE') {
            // For UPDATE, fetch the complete record with joined data
            const { data: updatedRecord, error } = await supabase
              .from('ape')
              .select(`
                *,
                registrazione_info:stati_ape(id, descrizione, colore)
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
    <div className="space-y-6" style={{marginTop: '0px'}}>
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
                    Telefono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Mail
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
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {combineTelefoni(pratica.telefono, pratica.telefono2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.mail || '-'}
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
                    <input
                      type="text"
                      name="proprieta"
                      value={formData.proprieta}
                      onChange={handleInputChange}
                      className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
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
    </div>
  );
}; 