import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronDown, Edit, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { ComuneCatasto, StatoGenerale, TipoIncarico } from '../types';
import toast from 'react-hot-toast';

export const ComuneCatastoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pratiche, setPratiche] = useState<ComuneCatasto[]>([]);
  const [stati, setStati] = useState<StatoGenerale[]>([]);
  const [tipiIncarico, setTipiIncarico] = useState<TipoIncarico[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtroTipoIncarico, setFiltroTipoIncarico] = useState('');
  const [filtriAttivi, setFiltriAttivi] = useState({
    comune: false,
    catasto: false,
    nonCompletati: false,
    nonPagati: false,
    completateNonPagate: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    const saved = localStorage.getItem('comune-catasto-records-per-page');
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
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingPratica, setEditingPratica] = useState<ComuneCatasto | null>(null);
  const [duplicatingPratica, setDuplicatingPratica] = useState<ComuneCatasto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);
  const [formData, setFormData] = useState({
    committente: '',
    stato: '',
    proprieta: '',
    proprieta2: '',
    indirizzo: '',
    citta: '',
    telefono: '',
    telefono2: '',
    mail: '',
    tipo_incarico: '',
    comune: false,
    catasto: false,
    fine_lavori: false,
    pagamento: false,
    note: ''
  });
  const { user } = useAuthStore();

  // Gestione parametri URL per filtri automatici
  useEffect(() => {
    const filter = searchParams.get('filter');
    let newFiltriAttivi = { ...filtriAttivi };

    if (filter === 'non_completati') {
      newFiltriAttivi = { ...newFiltriAttivi, nonCompletati: true };
    } else if (filter === 'completate_non_pagate') {
      newFiltriAttivi = { ...newFiltriAttivi, completateNonPagate: true };
    } else if (filter === 'non_pagate') {
      newFiltriAttivi = { ...newFiltriAttivi, nonPagati: true };
    }

    // Solo se c'è un filtro da applicare e l'user è presente
    if (filter && user?.id) {
      setFiltriAttivi(newFiltriAttivi);
      setCurrentPage(1);
      // Esegui la ricerca con il nuovo filtro
      fetchData({
        filtriAttivi: newFiltriAttivi,
        page: 1
      });
    }
  }, [searchParams, user?.id]);

  // Gestione shortcut CTRL+INVIO per salvare
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verifica se il modale è aperto e se è stata premuta la combinazione CTRL+INVIO o CMD+INVIO
      if (showModal && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();

        // Simula il submit del form se non è già in corso un submit
        if (!submitting) {
          const form = document.querySelector('form') as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        }
      }
    };

    // Aggiunge l'event listener solo quando il modale è aperto
    if (showModal) {
      document.addEventListener('keydown', handleKeyDown);
    }

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, submitting]);

  // Protezione contro errori delle estensioni del browser
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Ignora errori provenienti da estensioni del browser
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
      // Ignora promise rejection da estensioni
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
    filtroTipoIncarico?: string;
    filtriAttivi?: typeof filtriAttivi;
    page?: number;
    perPage?: number;
  }) => {
    try {
      setLoading(true);

      // Usa i filtri personalizzati o quelli dello stato corrente
      const currentSearchTerm = customFilters?.searchTerm ?? searchTerm;
      const currentFiltroStato = customFilters?.filtroStato ?? filtroStato;
      const currentFiltroTipoIncarico = customFilters?.filtroTipoIncarico ?? filtroTipoIncarico;
      const currentFiltriAttivi = customFilters?.filtriAttivi ?? filtriAttivi;
      const currentPageParam = customFilters?.page ?? currentPage;
      const currentPerPage = customFilters?.perPage ?? recordsPerPage;

      // Prima query per contare il totale dei record
      let countQuery = supabase
        .from('comune_catasto')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Applica filtri al conteggio
      if (currentSearchTerm) {
        countQuery = countQuery.or(`committente.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,proprieta2.ilike.%${currentSearchTerm}%,citta.ilike.%${currentSearchTerm}%,mail.ilike.%${currentSearchTerm}%,note.ilike.%${currentSearchTerm}%,telefono.ilike.%${currentSearchTerm}%,telefono2.ilike.%${currentSearchTerm}%`);
      }

      if (currentFiltroStato) {
        countQuery = countQuery.eq('stato', parseInt(currentFiltroStato));
      }

      if (currentFiltroTipoIncarico) {
        countQuery = countQuery.eq('tipo_incarico', parseInt(currentFiltroTipoIncarico));
      }

      if (currentFiltriAttivi.comune) {
        countQuery = countQuery.eq('comune', true);
      }

      if (currentFiltriAttivi.catasto) {
        countQuery = countQuery.eq('catasto', true);
      }

      if (currentFiltriAttivi.nonCompletati) {
        countQuery = countQuery.neq('stato', 3);
      }

      if (currentFiltriAttivi.nonPagati) {
        countQuery = countQuery.eq('pagamento', false);
      }

      if (currentFiltriAttivi.completateNonPagate) {
        countQuery = countQuery.eq('fine_lavori', true).eq('pagamento', false);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Errore nel conteggio:', countError);
      } else {
        setTotalRecords(count || 0);
      }

      // Query principale con paginazione
      let query = supabase
        .from('comune_catasto')
        .select(`
          *,
          stato_info:stati_generali(id, descrizione, colore),
          tipo_incarico_info:tipi_incarico(id, descrizione, comune, catasto)
        `)
        .eq('user_id', user?.id)
        .order('stato', { ascending: true })
        .order('created_at', { ascending: false });

      // Applica filtri
      if (currentSearchTerm) {
        query = query.or(`committente.ilike.%${currentSearchTerm}%,indirizzo.ilike.%${currentSearchTerm}%,proprieta.ilike.%${currentSearchTerm}%,proprieta2.ilike.%${currentSearchTerm}%,citta.ilike.%${currentSearchTerm}%,mail.ilike.%${currentSearchTerm}%,note.ilike.%${currentSearchTerm}%,telefono.ilike.%${currentSearchTerm}%,telefono2.ilike.%${currentSearchTerm}%`);
      }

      if (currentFiltroStato) {
        query = query.eq('stato', parseInt(currentFiltroStato));
      }

      if (currentFiltroTipoIncarico) {
        query = query.eq('tipo_incarico', parseInt(currentFiltroTipoIncarico));
      }

      if (currentFiltriAttivi.comune) {
        query = query.eq('comune', true);
      }

      if (currentFiltriAttivi.catasto) {
        query = query.eq('catasto', true);
      }

      if (currentFiltriAttivi.nonCompletati) {
        query = query.neq('stato', 3);
      }

      if (currentFiltriAttivi.nonPagati) {
        query = query.eq('pagamento', false);
      }

      if (currentFiltriAttivi.completateNonPagate) {
        query = query.eq('stato', 3).eq('pagamento', false);
      }

      // Applica paginazione
      const from = (currentPageParam - 1) * currentPerPage;
      const to = from + currentPerPage - 1;
      query = query.range(from, to);

      const { data: praticheData, error: praticheError } = await query;

      if (praticheError) {
        console.error('Errore nel caricamento pratiche:', praticheError);
        toast.error('Errore nel caricamento delle pratiche');
        return;
      }

      // Carica stati e tipi incarico per i dropdown
      const [statiResult, tipiResult] = await Promise.all([
        supabase.from('stati_generali').select('*').order('ordinamento'),
        supabase.from('tipi_incarico').select('*').order('descrizione')
      ]);

      if (statiResult.error) {
        console.error('Errore caricamento stati:', statiResult.error);
      } else {
        setStati(statiResult.data || []);
      }

      if (tipiResult.error) {
        console.error('Errore caricamento tipi incarico:', tipiResult.error);
      } else {
        setTipiIncarico(tipiResult.data || []);
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

  // Setup Supabase Realtime subscription per i flag
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up realtime subscription for ComuneCatasto flags, user:', user.id);

    // Create a channel for realtime updates
    const channel = supabase
      .channel('comune-catasto-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'comune_catasto',
          filter: `user_id=eq.${user.id}` // Only listen to changes for current user
        },
        async (payload) => {
          console.log('Realtime update received for ComuneCatasto:', payload);
          setLastUpdateTime(new Date());

          // Simple update logic - just update the local state for any change
          if (payload.eventType === 'INSERT') {
            // For INSERT, fetch the complete record with joined data
            const { data: newRecord, error } = await supabase
              .from('comune_catasto')
              .select(`
                *,
                stato_info:stati_generali(id, descrizione, colore),
                tipo_incarico_info:tipi_incarico(id, descrizione, comune, catasto)
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
              toast.success('Nuova pratica aggiunta');
            }
          }
          else if (payload.eventType === 'UPDATE') {
            // For UPDATE, fetch the complete record with joined data
            const { data: updatedRecord, error } = await supabase
              .from('comune_catasto')
              .select(`
                *,
                stato_info:stati_generali(id, descrizione, colore),
                tipo_incarico_info:tipi_incarico(id, descrizione, comune, catasto)
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
              const oldPratica = payload.old as ComuneCatasto;
              let messaggiToast: string[] = [];

              if (oldPratica.pagamento !== updatedRecord.pagamento) {
                messaggiToast.push(updatedRecord.pagamento ? 'Pagamento marcato come effettuato' : 'Pagamento marcato come non effettuato');
              }
              if (oldPratica.comune !== updatedRecord.comune) {
                messaggiToast.push(updatedRecord.comune ? 'Comune marcato come completato' : 'Comune marcato come non completato');
              }
              if (oldPratica.catasto !== updatedRecord.catasto) {
                messaggiToast.push(updatedRecord.catasto ? 'Catasto marcato come completato' : 'Catasto marcato come non completato');
              }
              if (oldPratica.fine_lavori !== updatedRecord.fine_lavori) {
                messaggiToast.push(updatedRecord.fine_lavori ? 'Fine lavori marcato come completato' : 'Fine lavori marcato come non completato');
              }
              if (oldPratica.stato !== updatedRecord.stato) {
                const oldStato = stati.find(s => s.id === oldPratica.stato)?.descrizione || 'N/A';
                const newStato = stati.find(s => s.id === updatedRecord.stato)?.descrizione || 'N/A';
                messaggiToast.push(`Stato cambiato da "${oldStato}" a "${newStato}"`);
              }

              // Mostra i messaggi di toast
              if (messaggiToast.length > 0) {
                // Se c'è solo un messaggio, mostralo normalmente
                if (messaggiToast.length === 1) {
                  toast.success(messaggiToast[0]);
                } else {
                  // Se ci sono più messaggi (es. flag + stato), mostra il primo o un messaggio combinato
                  toast.success(messaggiToast[0]);
                  console.log('Altri aggiornamenti:', messaggiToast.slice(1));
                }
              }
            }
          }
          else if (payload.eventType === 'DELETE') {
            // Remove deleted record
            const deletedId = payload.old.id;
            setPratiche(prev => prev.filter(pratica => pratica.id !== deletedId));
            setTotalRecords(prev => Math.max(0, prev - 1));
            toast.success('Pratica eliminata');
          }
        }
      )
      .subscribe((status) => {
        console.log('ComuneCatasto subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up ComuneCatasto realtime subscription');
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [user?.id, stati, tipiIncarico]);

  const handleSearch = () => {
    setSelectedRows(new Set()); // Resetta la selezione quando si effettua una ricerca
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
    setSelectedRows(new Set()); // Resetta la selezione quando si cambia pagina
    fetchData({ page });
  };

  const handleRecordsPerPageChange = (newRecordsPerPage: number) => {
    setRecordsPerPage(newRecordsPerPage);
    localStorage.setItem('comune-catasto-records-per-page', newRecordsPerPage.toString());
    setCurrentPage(1); // Reset alla prima pagina quando cambia il numero di record
    setSelectedRows(new Set()); // Resetta la selezione quando si cambia il numero di record
    fetchData({
      perPage: newRecordsPerPage,
      page: 1
    });
  };

  const getTotalPages = () => {
    return Math.ceil(totalRecords / recordsPerPage);
  };

  const handleToggleField = async (pratica: ComuneCatasto, field: 'comune' | 'catasto' | 'fine_lavori' | 'pagamento') => {
    // Verifica se il campo può essere modificato
    if (!isFlagAbilitatoInTabella(pratica, field)) {
      toast.error(`Il campo ${field} non può essere modificato per questo tipo di incarico`);
      return;
    }

    try {
      const newValue = !pratica[field];
      console.log(`Toggling ${field} for pratica ${pratica.id} from ${pratica[field]} to ${newValue}`);

      // Se stiamo disabilitando il comune, dobbiamo anche disabilitare fine_lavori
      const updateData: any = { [field]: newValue };
      if (field === 'comune' && !newValue) {
        updateData.fine_lavori = false;
      }

      // Verifica se la pratica deve essere marcata come completata
      const praticaAggiornata = { ...pratica, ...updateData };
      const statoCompletata = await verificaEAggiornaStatoCompletata(praticaAggiornata);
      if (statoCompletata) {
        updateData.stato = statoCompletata;
      }

      const { error } = await supabase
        .from('comune_catasto')
        .update(updateData)
        .eq('id', pratica.id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error(`Errore nell'aggiornamento del campo ${field}`);
        return;
      }

      // Forza un aggiornamento locale immediato per feedback visivo istantaneo
      setPratiche(prev =>
        prev.map(p =>
          p.id === pratica.id
            ? {
              ...p,
              ...updateData,
              // Se lo stato è stato aggiornato automaticamente, includi anche quello
              ...(statoCompletata ? {
                stato: statoCompletata,
                stato_info: stati.find(s => s.id === statoCompletata) || p.stato_info
              } : {})
            }
            : p
        )
      );

      if (statoCompletata) {
        const statoAggiornato = stati.find(s => s.id === statoCompletata);
        if (statoAggiornato?.descrizione.toLowerCase().includes('completata')) {
          toast.success(`Campo ${field} aggiornato e pratica marcata come completata!`);
        } else if (statoAggiornato?.descrizione.toLowerCase().includes('corso')) {
          toast.success(`Campo ${field} aggiornato e pratica riportata in corso`);
        } else {
          toast.success(`Campo ${field} aggiornato e stato cambiato in ${statoAggiornato?.descrizione}`);
        }
      } else {
        toast.success(`Campo ${field} aggiornato con successo`);
      }
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'aggiornamento');
    }
  };

  // Funzione per verificare se la pratica deve essere marcata come completata o in corso
  const verificaEAggiornaStatoCompletata = async (pratica: ComuneCatasto): Promise<number | null> => {
    const tipoIncarico = pratica.tipo_incarico_info;
    if (!tipoIncarico) return null;

    // Trova gli stati "Completata" e "In corso" nella lista degli stati
    const statoCompletata = stati.find(stato =>
      stato.descrizione.toLowerCase().includes('completata') ||
      stato.descrizione.toLowerCase().includes('completato')
    );

    const statoInCorso = stati.find(stato =>
      stato.descrizione.toLowerCase().includes('in corso') ||
      stato.descrizione.toLowerCase().includes('corso') ||
      stato.descrizione.toLowerCase().includes('lavorazione')
    );

    if (!statoCompletata) {
      console.warn('Stato "Completata" non trovato nella tabella stati_generali');
      return null;
    }

    if (!statoInCorso) {
      console.warn('Stato "In corso" non trovato nella tabella stati_generali');
      return null;
    }

    // Verifica se tutti i flag richiesti sono a true
    let tuttiIFlagCompletati = true;

    // Controlla il flag comune se richiesto dal tipo di incarico
    if (tipoIncarico.comune && !pratica.comune) {
      tuttiIFlagCompletati = false;
    }

    // Controlla il flag catasto se richiesto dal tipo di incarico
    if (tipoIncarico.catasto && !pratica.catasto) {
      tuttiIFlagCompletati = false;
    }

    // Se il tipo di incarico prevede il comune, controlla anche fine_lavori
    if (tipoIncarico.comune && !pratica.fine_lavori) {
      tuttiIFlagCompletati = false;
    }

    // Se tutti i flag sono completati e lo stato non è già "Completata"
    if (tuttiIFlagCompletati && pratica.stato !== statoCompletata.id) {
      return statoCompletata.id;
    }

    // Se non tutti i flag sono completati e lo stato è "Completata", torna a "In corso"
    if (!tuttiIFlagCompletati && pratica.stato === statoCompletata.id) {
      return statoInCorso.id;
    }

    return null;
  };

  // Funzione per verificare se un flag è abilitato nella tabella
  const isFlagAbilitatoInTabella = (pratica: ComuneCatasto, flagName: 'comune' | 'catasto' | 'fine_lavori' | 'pagamento') => {
    const tipoIncarico = pratica.tipo_incarico_info;

    switch (flagName) {
      case 'comune':
        return tipoIncarico?.comune === true;
      case 'catasto':
        return tipoIncarico?.catasto === true;
      case 'fine_lavori':
        // Fine lavori si abilita solo se il flag comune della pratica è true
        return pratica.comune === true;
      case 'pagamento':
        // Il pagamento è sempre abilitato
        return true;
      default:
        return false;
    }
  };

  const handleDeletePratica = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa pratica?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('comune_catasto')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della pratica');
        return;
      }

      // Rimuovi l'ID dalla selezione se la pratica eliminata era selezionata
      setSelectedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });

      toast.success('Pratica eliminata con successo');
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  // Funzione per formattare il numero di telefono
  const formatTelefono = (value: string): string => {
    // Rimuove tutti i caratteri non numerici
    const numericValue = value.replace(/\D/g, '');

    // Limita a 10 cifre
    const limitedValue = numericValue.slice(0, 10);

    // Applica la formattazione XXX XXX XXXX
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


  const handleSelectAll = () => {
    if (selectedRows.size === pratiche.length) {
      // Se tutte le righe sono selezionate, deseleziona tutto
      setSelectedRows(new Set());
    } else {
      // Altrimenti seleziona tutte le righe della pagina corrente
      setSelectedRows(new Set(pratiche.map(pratica => pratica.id)));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    // Protezione contro eventi malformati da estensioni
    if (!e || !e.target) {
      console.warn('Evento malformato ignorato');
      return;
    }

    const { name, value, type } = e.target;

    // Verifica che name sia definito
    if (!name) {
      console.warn('Nome campo non definito');
      return;
    }

    let processedValue = value;

    // Formatta il telefono se è il campo telefono
    if (name === 'telefono' && type !== 'checkbox') {
      processedValue = formatTelefono(value);
    }

    // Formatta il telefono2 se è il campo telefono2
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
        stato: formData.stato ? parseInt(formData.stato) : null,
        tipo_incarico: formData.tipo_incarico ? parseInt(formData.tipo_incarico) : null,
        user_id: user?.id
      };

      // Verifica se la pratica deve essere marcata come completata
      const tipoIncaricoSelezionato = getTipoIncaricoSelezionato();
      if (tipoIncaricoSelezionato) {
        const praticaSimulata = {
          id: editingPratica?.id || 0,
          committente: formData.committente,
          stato: dataToSave.stato || undefined,
          proprieta: formData.proprieta,
          proprieta2: formData.proprieta2,
          indirizzo: formData.indirizzo,
          citta: formData.citta,
          telefono: formData.telefono,
          telefono2: formData.telefono2,
          mail: formData.mail,
          tipo_incarico: dataToSave.tipo_incarico || undefined,
          comune: formData.comune,
          catasto: formData.catasto,
          fine_lavori: formData.fine_lavori,
          pagamento: formData.pagamento,
          note: formData.note,
          created_at: editingPratica?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          stato_info: stati.find(s => s.id === dataToSave.stato),
          tipo_incarico_info: tipoIncaricoSelezionato
        } as ComuneCatasto;

        const statoCompletata = await verificaEAggiornaStatoCompletata(praticaSimulata);
        if (statoCompletata) {
          dataToSave.stato = statoCompletata;
        }
      }

      if (editingPratica) {
        // Modifica pratica esistente
        const { error } = await supabase
          .from('comune_catasto')
          .update(dataToSave)
          .eq('id', editingPratica.id)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Errore modifica:', error);
          toast.error('Errore nella modifica della pratica');
          return;
        }

        // Aggiornamento locale immediato per feedback visivo istantaneo
        if (dataToSave.stato !== undefined) {
          setPratiche(prev =>
            prev.map(p =>
              p.id === editingPratica.id
                ? {
                  ...p,
                  stato: dataToSave.stato || undefined,
                  stato_info: dataToSave.stato ? stati.find(s => s.id === dataToSave.stato) : undefined,
                  tipo_incarico: dataToSave.tipo_incarico || undefined,
                  tipo_incarico_info: dataToSave.tipo_incarico ? tipiIncarico.find(t => t.id === dataToSave.tipo_incarico) : undefined,
                  committente: dataToSave.committente,
                  proprieta: dataToSave.proprieta || null,
                  proprieta2: dataToSave.proprieta2 || null,
                  indirizzo: dataToSave.indirizzo || null,
                  citta: dataToSave.citta || null,
                  telefono: dataToSave.telefono || null,
                  telefono2: dataToSave.telefono2 || null,
                  mail: dataToSave.mail || null,
                  comune: dataToSave.comune,
                  catasto: dataToSave.catasto,
                  fine_lavori: dataToSave.fine_lavori,
                  pagamento: dataToSave.pagamento,
                  note: dataToSave.note || null,
                  updated_at: new Date().toISOString()
                } as ComuneCatasto
                : p
            )
          );
        }

        let messaggioSuccesso = 'Pratica modificata con successo';
        if (dataToSave.stato) {
          const statoAggiornato = stati.find(s => s.id === dataToSave.stato);
          if (statoAggiornato?.descrizione.toLowerCase().includes('completata')) {
            messaggioSuccesso = 'Pratica modificata e marcata come completata!';
          } else if (statoAggiornato?.descrizione.toLowerCase().includes('corso')) {
            messaggioSuccesso = 'Pratica modificata e riportata in corso';
          }
        }
        toast.success(messaggioSuccesso);
      } else {
        // Crea nuova pratica
        const { error } = await supabase
          .from('comune_catasto')
          .insert([dataToSave]);

        if (error) {
          console.error('Errore inserimento:', error);
          toast.error('Errore nel salvataggio della pratica');
          return;
        }

        let messaggioSuccesso = 'Pratica creata con successo';
        if (dataToSave.stato) {
          const statoAggiornato = stati.find(s => s.id === dataToSave.stato);
          if (statoAggiornato?.descrizione.toLowerCase().includes('completata')) {
            messaggioSuccesso = 'Pratica creata e marcata come completata!';
          } else if (statoAggiornato?.descrizione.toLowerCase().includes('corso')) {
            messaggioSuccesso = 'Pratica creata e impostata in corso';
          }
        }
        toast.success(messaggioSuccesso);
      }

      closeModal();
      // Forza il refresh del componente dopo il salvataggio
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (pratica?: ComuneCatasto, praticaToDuplicate?: ComuneCatasto) => {
    if (praticaToDuplicate || duplicatingPratica) {
      // Modalità duplicazione - usa il parametro diretto se disponibile, altrimenti lo state
      const sourcePratica = praticaToDuplicate || duplicatingPratica;

      setEditingPratica(null);

      const newFormData = {
        committente: sourcePratica!.committente,
        stato: sourcePratica!.stato?.toString() || '',
        proprieta: sourcePratica!.proprieta || '',
        proprieta2: sourcePratica!.proprieta2 || '',
        indirizzo: sourcePratica!.indirizzo || '',
        citta: sourcePratica!.citta || '',
        telefono: sourcePratica!.telefono || '',
        telefono2: sourcePratica!.telefono2 || '',
        mail: sourcePratica!.mail || '',
        tipo_incarico: sourcePratica!.tipo_incarico?.toString() || '',
        comune: sourcePratica!.comune,
        catasto: sourcePratica!.catasto,
        fine_lavori: sourcePratica!.fine_lavori,
        pagamento: sourcePratica!.pagamento,
        note: sourcePratica!.note || ''
      };

      setFormData(newFormData);
    } else if (pratica) {
      // Modalità modifica
      setEditingPratica(pratica);
      const editFormData = {
        committente: pratica.committente,
        stato: pratica.stato?.toString() || '',
        proprieta: pratica.proprieta || '',
        proprieta2: pratica.proprieta2 || '',
        indirizzo: pratica.indirizzo || '',
        citta: pratica.citta || '',
        telefono: pratica.telefono || '',
        telefono2: pratica.telefono2 || '',
        mail: pratica.mail || '',
        tipo_incarico: pratica.tipo_incarico?.toString() || '',
        comune: pratica.comune,
        catasto: pratica.catasto,
        fine_lavori: pratica.fine_lavori,
        pagamento: pratica.pagamento,
        note: pratica.note || ''
      };

      setFormData(editFormData);
    } else {
      // Modalità creazione
      setEditingPratica(null);
      const newFormData = {
        committente: '',
        stato: '',
        proprieta: '',
        proprieta2: '',
        indirizzo: '',
        citta: '',
        telefono: '',
        telefono2: '',
        mail: '',
        tipo_incarico: '',
        comune: false,
        catasto: false,
        fine_lavori: false,
        pagamento: false,
        note: ''
      };

      setFormData(newFormData);
    }

    setShowModal(true);

    // Reset duplicatingPratica after modal is opened to ensure proper cleanup
    if (duplicatingPratica || praticaToDuplicate) {
      setDuplicatingPratica(null);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPratica(null);
    setFormData({
      committente: '',
      stato: '',
      proprieta: '',
      proprieta2: '',
      indirizzo: '',
      citta: '',
      telefono: '',
      telefono2: '',
      mail: '',
      tipo_incarico: '',
      comune: false,
      catasto: false,
      fine_lavori: false,
      pagamento: false,
      note: ''
    });
  };

  // Funzione per ottenere il tipo di incarico selezionato
  const getTipoIncaricoSelezionato = () => {
    if (!formData.tipo_incarico) return null;
    return tipiIncarico.find(tipo => tipo.id === parseInt(formData.tipo_incarico));
  };

  // Funzione per verificare se un flag è abilitato
  const isFlagAbilitato = (flagName: 'comune' | 'catasto' | 'fine_lavori' | 'pagamento') => {
    const tipoSelezionato = getTipoIncaricoSelezionato();

    switch (flagName) {
      case 'comune':
        return tipoSelezionato?.comune === true;
      case 'catasto':
        return tipoSelezionato?.catasto === true;
      case 'fine_lavori':
        // Fine lavori si abilita solo se il flag comune della pratica è true
        return formData.comune === true;
      case 'pagamento':
        // Il pagamento è sempre abilitato
        return true;
      default:
        return false;
    }
  };

  // Gestione del cambio di tipo incarico
  const handleTipoIncaricoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuovoTipoIncarico = e.target.value;
    const tipoSelezionato = tipiIncarico.find(tipo => tipo.id === parseInt(nuovoTipoIncarico));

    setFormData(prev => {
      const nuovoFormData = {
        ...prev,
        tipo_incarico: nuovoTipoIncarico
      };

      // Reset dei flag se il nuovo tipo di incarico non li supporta
      if (!tipoSelezionato?.comune) {
        nuovoFormData.comune = false;
        nuovoFormData.fine_lavori = false; // Se comune diventa false, anche fine_lavori deve diventare false
      }

      if (!tipoSelezionato?.catasto) {
        nuovoFormData.catasto = false;
      }

      return nuovoFormData;
    });
  };

  // Gestione del cambio del flag comune
  const handleComuneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuovoComune = e.target.checked;

    setFormData(prev => ({
      ...prev,
      comune: nuovoComune,
      // Se comune diventa false, anche fine_lavori deve diventare false
      fine_lavori: nuovoComune ? prev.fine_lavori : false
    }));
  };

  const getStatoStyle = (stato: StatoGenerale | undefined) => {
    if (!stato || !stato.colore) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';

    // Usa direttamente il colore dalla tabella stati_generali
    return `text-white`;
  };

  const getStatoBackgroundColor = (stato: StatoGenerale | undefined) => {
    if (!stato || !stato.colore) return '#6b7280'; // gray-500 come fallback
    return stato.colore;
  };

  const renderToggleButton = (value: boolean, enabled: boolean = true) => {
    return (
      <div
        className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${enabled ? 'hover:scale-110' : ''
          } ${value
            ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50'
            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
          } ${!enabled ? 'opacity-30 cursor-not-allowed border-2 border-dashed border-gray-300 dark:border-gray-600' : ''
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
    <div className="h-full flex flex-col px-4">

      <div className="space-y-3 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Comune e Catasto</h1>
            <p className="text-gray-600 dark:text-gray-300">Gestione pratiche</p>
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
          <button
            onClick={() => openModal()}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuova Pratica
          </button>
        </div>

        {/* Filtri */}
        <div className="card space-y-4 dark:bg-gray-800 dark:border-gray-700">
          {/* Prima riga - Ricerca e dropdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  setCurrentPage(1); // Reset alla prima pagina quando cambia il filtro
                  // Trigger automatico della ricerca con il nuovo stato
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

            {/* Filtro Tipi Incarico */}
            <div className="relative">
              <select
                value={filtroTipoIncarico}
                onChange={(e) => {
                  const newFiltroTipoIncarico = e.target.value;
                  setFiltroTipoIncarico(newFiltroTipoIncarico);
                  setCurrentPage(1); // Reset alla prima pagina quando cambia il filtro
                  // Trigger automatico della ricerca con il nuovo tipo incarico
                  fetchData({
                    filtroTipoIncarico: newFiltroTipoIncarico,
                    page: 1
                  });
                }}
                className="input pr-8 appearance-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">-- Tutti i tipi di incarico --</option>
                {tipiIncarico.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.descrizione}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
          </div>

          {/* Seconda riga - Filtri toggle */}
          <div className="flex flex-wrap gap-4">
            <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${filtriAttivi.comune
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              <input
                type="checkbox"
                checked={filtriAttivi.comune}
                onChange={() => handleFilterToggle('comune')}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${filtriAttivi.comune
                  ? 'border-white bg-white'
                  : 'border-gray-400 dark:border-gray-500 bg-transparent'
                }`}>
                {filtriAttivi.comune && (
                  <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">Comune</span>
            </label>

            <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${filtriAttivi.catasto
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              <input
                type="checkbox"
                checked={filtriAttivi.catasto}
                onChange={() => handleFilterToggle('catasto')}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${filtriAttivi.catasto
                  ? 'border-white bg-white'
                  : 'border-gray-400 dark:border-gray-500 bg-transparent'
                }`}>
                {filtriAttivi.catasto && (
                  <svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">Catasto</span>
            </label>

            <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${filtriAttivi.nonCompletati
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              <input
                type="checkbox"
                checked={filtriAttivi.nonCompletati}
                onChange={() => handleFilterToggle('nonCompletati')}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${filtriAttivi.nonCompletati
                  ? 'border-white bg-white'
                  : 'border-gray-400 dark:border-gray-500 bg-transparent'
                }`}>
                {filtriAttivi.nonCompletati && (
                  <svg className="w-3 h-3 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">Non completati</span>
            </label>

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

            <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${filtriAttivi.completateNonPagate
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              <input
                type="checkbox"
                checked={filtriAttivi.completateNonPagate}
                onChange={() => handleFilterToggle('completateNonPagate')}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${filtriAttivi.completateNonPagate
                  ? 'border-white bg-white'
                  : 'border-gray-400 dark:border-gray-500 bg-transparent'
                }`}>
                {filtriAttivi.completateNonPagate && (
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">Completate non pagate</span>
            </label>
          </div>
        </div>

        {/* Sezione azioni multiple (appare solo quando ci sono righe selezionate) */}
        {selectedRows.size > 0 && (
          <div className="card bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400">
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {selectedRows.size} righe selezionate
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary flex items-center gap-2"
                    onClick={() => {
                      setShowStatusModal(true);
                      setConfirmStatusChange(false);
                    }}
                  >
                    Cambia stato
                  </button>
                  <button
                    className="btn btn-primary flex items-center gap-2"
                    disabled={selectedRows.size !== 1}
                    onClick={() => {
                      const selectedPratica = pratiche.find(p => selectedRows.has(p.id));
                      if (selectedPratica) {
                        openModal(undefined, selectedPratica);
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

        {/* Tabella - Container con altezza flessibile e scroll interno */}
        <div className="card p-0 dark:bg-gray-800 dark:border-gray-700 flex-1" style={{ height: 'calc(100vh - 400px)', overflow: 'hidden' }}>
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
                      <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${selectedRows.size === pratiche.length && pratiche.length > 0
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
                    Indirizzo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Città
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Proprietà
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
                    Tipo Incarico
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Comune
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Catasto
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fine Lavori
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Pagamento
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Caricamento...</span>
                      </div>
                    </td>
                  </tr>
                ) : pratiche.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nessuna pratica trovata
                    </td>
                  </tr>
                ) : (
                  pratiche.map((pratica) => (
                    <tr key={pratica.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-center">
                        <label className="flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(pratica.id)}
                            onChange={() => handleRowSelection(pratica.id)}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${selectedRows.has(pratica.id)
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
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getStatoStyle(pratica.stato_info)}`}
                          style={{ backgroundColor: getStatoBackgroundColor(pratica.stato_info) }}
                        >
                          {pratica.stato_info?.descrizione || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {pratica.committente}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {pratica.indirizzo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {pratica.citta || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {combineProprieta(pratica.proprieta, pratica.proprieta2)}
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
                        {pratica.tipo_incarico_info?.descrizione || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleField(pratica, 'comune')}
                          disabled={!isFlagAbilitatoInTabella(pratica, 'comune')}
                          className={`transition-colors ${isFlagAbilitatoInTabella(pratica, 'comune')
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed'
                            }`}
                          title={
                            isFlagAbilitatoInTabella(pratica, 'comune')
                              ? 'Clicca per cambiare stato'
                              : 'Non abilitato per questo tipo di incarico'
                          }
                        >
                          {renderToggleButton(pratica.comune, isFlagAbilitatoInTabella(pratica, 'comune'))}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleField(pratica, 'catasto')}
                          disabled={!isFlagAbilitatoInTabella(pratica, 'catasto')}
                          className={`transition-colors ${isFlagAbilitatoInTabella(pratica, 'catasto')
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed'
                            }`}
                          title={
                            isFlagAbilitatoInTabella(pratica, 'catasto')
                              ? 'Clicca per cambiare stato'
                              : 'Non abilitato per questo tipo di incarico'
                          }
                        >
                          {renderToggleButton(pratica.catasto, isFlagAbilitatoInTabella(pratica, 'catasto'))}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleField(pratica, 'fine_lavori')}
                          disabled={!isFlagAbilitatoInTabella(pratica, 'fine_lavori')}
                          className={`transition-colors ${isFlagAbilitatoInTabella(pratica, 'fine_lavori')
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed'
                            }`}
                          title={
                            isFlagAbilitatoInTabella(pratica, 'fine_lavori')
                              ? 'Clicca per cambiare stato'
                              : 'Abilitato solo se Comune è attivo'
                          }
                        >
                          {renderToggleButton(pratica.fine_lavori, isFlagAbilitatoInTabella(pratica, 'fine_lavori'))}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleField(pratica, 'pagamento')}
                          className="transition-colors cursor-pointer"
                          title="Clicca per cambiare stato"
                        >
                          {renderToggleButton(pratica.pagamento, true)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openModal(pratica)}
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
                  ))
                )}
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
                            className={`px-3 py-1 text-sm border rounded ${currentPage === pageNum
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

        {/* Modal Nuova Pratica */}
        {showModal && (
          <div className="modal-overlay">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl modal-scroll-container">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingPratica ? 'Modifica Pratica' : 'Nuova Pratica'}
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
                  {/* Prima colonna */}
                  <div className="space-y-4">
                    {/* Committente */}
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

                    {/* Stato */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Stato
                      </label>
                      <div className="relative">
                        <select
                          name="stato"
                          value={formData.stato}
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

                    {/* Proprietà */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Proprietà
                      </label>
                      <input
                        type="text"
                        name="proprieta"
                        value={formData.proprieta}
                        onChange={handleInputChange}
                        placeholder="Nome proprietà"
                        className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>

                    {/* Proprietà 2 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Proprietà 2
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

                    {/* Indirizzo */}
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

                    {/* Città */}
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
                  </div>

                  {/* Seconda colonna */}
                  <div className="space-y-4">
                    {/* Telefono */}
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

                    {/* Telefono 2 */}
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

                    {/* Email */}
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

                    {/* Tipo Incarico */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tipo Incarico
                      </label>
                      <div className="relative">
                        <select
                          name="tipo_incarico"
                          value={formData.tipo_incarico}
                          onChange={handleTipoIncaricoChange}
                          className="input w-full pr-8 appearance-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="">-- Seleziona tipo incarico --</option>
                          {tipiIncarico.map((tipo) => (
                            <option key={tipo.id} value={tipo.id}>
                              {tipo.descrizione}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>

                    {/* Note - Spostate sopra i flag */}
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

                    {/* Checkboxes con stile migliorato */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <label className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border-2 ${!isFlagAbilitato('comune')
                            ? 'opacity-30 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 border-dashed'
                            : formData.comune
                              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-700 dark:text-purple-300 cursor-pointer'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="comune"
                            checked={formData.comune}
                            onChange={handleComuneChange}
                            disabled={!isFlagAbilitato('comune')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${formData.comune
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300 dark:border-gray-500 bg-transparent'
                            }`}>
                            {formData.comune && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">Comune</span>
                        </label>

                        <label className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border-2 ${!isFlagAbilitato('catasto')
                            ? 'opacity-30 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 border-dashed'
                            : formData.catasto
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300 cursor-pointer'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="catasto"
                            checked={formData.catasto}
                            onChange={handleInputChange}
                            disabled={!isFlagAbilitato('catasto')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${formData.catasto
                              ? 'border-indigo-500 bg-indigo-500'
                              : 'border-gray-300 dark:border-gray-500 bg-transparent'
                            }`}>
                            {formData.catasto && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">Catasto</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <label className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border-2 ${!isFlagAbilitato('fine_lavori')
                            ? 'opacity-30 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 border-dashed'
                            : formData.fine_lavori
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300 cursor-pointer'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="fine_lavori"
                            checked={formData.fine_lavori}
                            onChange={handleInputChange}
                            disabled={!isFlagAbilitato('fine_lavori')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${formData.fine_lavori
                              ? 'border-green-500 bg-green-500'
                              : 'border-gray-300 dark:border-gray-500 bg-transparent'
                            }`}>
                            {formData.fine_lavori && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">Fine Lavori</span>
                        </label>

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
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>* Campo obbligatorio</p>
                    <p className="mt-1">
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                        {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}
                      </kbd>
                      {' + '}
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                        Invio
                      </kbd>
                      {' per salvare'}
                    </p>
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
                          {editingPratica ? 'Modifica...' : 'Salvataggio...'}
                        </div>
                      ) : (
                        editingPratica ? 'Modifica' : 'Salva'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Cambio Stato */}
        {showStatusModal && (
          <div className="modal-overlay">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md modal-scroll-container">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {confirmStatusChange ? 'Conferma Cambio Stato' : 'Seleziona Nuovo Stato'}
                </h2>
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setConfirmStatusChange(false);
                    setNewStatus('');
                  }}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {!confirmStatusChange ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nuovo Stato
                      </label>
                      <div className="relative">
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="input w-full pr-8 appearance-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="">-- Seleziona stato --</option>
                          {stati.map((stato) => (
                            <option key={stato.id} value={stato.id.toString()}>
                              {stato.descrizione}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Selezionando un nuovo stato verranno modificate {selectedRows.size} pratiche.
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowStatusModal(false);
                          setNewStatus('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmStatusChange(true)}
                        disabled={!newStatus}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Continua
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Conferma Cambio Stato
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Stai per cambiare lo stato di {selectedRows.size} pratiche a:
                      </div>
                      <div className="inline-flex px-4 py-2 text-sm font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {stati.find(s => s.id.toString() === newStatus)?.descrizione || 'N/A'}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setConfirmStatusChange(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Indietro
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            // Update all selected practices
                            const updates = Array.from(selectedRows).map(async (id) => {
                              const { error } = await supabase
                                .from('comune_catasto')
                                .update({ stato: parseInt(newStatus) })
                                .eq('id', id)
                                .eq('user_id', user?.id);

                              if (error) {
                                throw error;
                              }
                            });

                            await Promise.all(updates);

                            // Aggiornamento locale immediato per feedback visivo istantaneo
                            const newStatoInfo = stati.find(s => s.id === parseInt(newStatus));
                            setPratiche(prev =>
                              prev.map(pratica =>
                                selectedRows.has(pratica.id)
                                  ? {
                                    ...pratica,
                                    stato: parseInt(newStatus),
                                    stato_info: newStatoInfo || pratica.stato_info
                                  }
                                  : pratica
                              )
                            );

                            toast.success(`Stato modificato per ${selectedRows.size} pratiche`);
                            setShowStatusModal(false);
                            setNewStatus('');
                            setSelectedRows(new Set());
                          } catch (error) {
                            console.error('Errore nel cambio stato:', error);
                            toast.error('Errore nel cambio stato');
                          }
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        Conferma
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};