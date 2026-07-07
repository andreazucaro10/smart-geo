import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronDown, Edit, Trash2, Check, X, Copy, ArrowRightCircle, User, Search } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { RubricaAutocomplete } from '../components/RubricaAutocomplete';
import { syncRubricaFromPratica } from '../utils/rubricaSync';
import { ContextMenu } from '../components/ContextMenu';
import type { ComuneCatasto, StatoGenerale, TipoIncarico, TipoPratica, Rubrica } from '../types';
import toast from 'react-hot-toast';

const TriStateFilter = ({ value, onChange }: {
  value: 'all' | 'yes' | 'no';
  onChange: (v: 'all' | 'yes' | 'no') => void;
}) => (
  <div className="flex items-center justify-center gap-0.5">
    <button
      onClick={() => onChange('all')}
      title="Tutti"
      className={`p-1 rounded-md transition-all duration-150 ${
        value === 'all'
          ? 'bg-ink-200 shadow-sm'
          : 'hover:bg-ink-100 opacity-50 hover:opacity-100'
      }`}
    >
      <div className="w-2.5 h-0.5 bg-ink-400 rounded" />
    </button>
    <button
      onClick={() => onChange('yes')}
      title="Si"
      className={`p-1 rounded-md transition-all duration-150 ${
        value === 'yes'
          ? 'bg-ink-200 shadow-sm'
          : 'hover:bg-ink-100 opacity-50 hover:opacity-100'
      }`}
    >
      <Check className="w-3 h-3 text-topo-500" />
    </button>
    <button
      onClick={() => onChange('no')}
      title="No"
      className={`p-1 rounded-md transition-all duration-150 ${
        value === 'no'
          ? 'bg-ink-200 shadow-sm'
          : 'hover:bg-ink-100 opacity-50 hover:opacity-100'
      }`}
    >
      <X className="w-3 h-3 text-error-500" />
    </button>
  </div>
);

export const ComuneCatastoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pratiche, setPratiche] = useState<ComuneCatasto[]>([]);
  const [stati, setStati] = useState<StatoGenerale[]>([]);
  const [tipiIncarico, setTipiIncarico] = useState<TipoIncarico[]>([]);
  const [tipiPratica, setTipiPratica] = useState<TipoPratica[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [columnFilters, setColumnFilters] = useState<{
    stato: string;
    committente: string;
    proprieta: string;
    indirizzo: string;
    citta: string;
    note: string;
    tipo_incarico: string;
    tipo_pratica: string;
    comune: 'all' | 'yes' | 'no';
    catasto: 'all' | 'yes' | 'no';
    fine_lavori: 'all' | 'yes' | 'no';
    acconto: 'all' | 'yes' | 'no';
    saldo: 'all' | 'yes' | 'no';
  }>({
    stato: '',
    committente: '',
    proprieta: '',
    indirizzo: '',
    citta: '',
    note: '',
    tipo_incarico: '',
    tipo_pratica: '',
    comune: 'all',
    catasto: 'all',
    fine_lavori: 'all',
    acconto: 'all',
    saldo: 'all'
  });
  const [presetFilters, setPresetFilters] = useState({
    nonCompletati: false,
    nonPagate: false,
    omaggio: false
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
  const [editingPratica, setEditingPratica] = useState<ComuneCatasto | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pratica: ComuneCatasto | null }>({ x: 0, y: 0, pratica: null });
  const [showContextMenuActionModal, setShowContextMenuActionModal] = useState<'status' | 'contatto' | null>(null);
  const [selectedPraticaForContextMenu, setSelectedPraticaForContextMenu] = useState<ComuneCatasto | null>(null);
  const [newStatusForContextMenu, setNewStatusForContextMenu] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
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
    tipo_pratica: '',
    comune: false,
    catasto: false,
    fine_lavori: false,
    acconto: false,
    saldo: false,
    omaggio: false,
    note: ''
  });
  const { user } = useAuthStore();

  const activeFilterCount = Object.entries(columnFilters).filter(([key, val]) => {
    if (key === 'comune' || key === 'catasto' || key === 'fine_lavori' || key === 'acconto' || key === 'saldo') {
      return val !== 'all';
    }
    return val !== '';
  }).length + Object.values(presetFilters).filter(Boolean).length;

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (!filter || !user?.id) return;

    const newPresetFilters = { ...presetFilters };
    if (filter === 'non_completati') {
      newPresetFilters.nonCompletati = true;
    }

    setPresetFilters(newPresetFilters);
    setCurrentPage(1);
    fetchData({ presetFilters: newPresetFilters, page: 1 });
  }, [searchParams, user?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showModal && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (!submitting) {
          const form = document.querySelector('form') as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        }
      }
    };
    if (showModal) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, submitting]);

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

  const fetchData = async (customFilters?: {
    columnFilters?: typeof columnFilters;
    presetFilters?: typeof presetFilters;
    page?: number;
    perPage?: number;
  }) => {
    try {
      setLoading(true);

      const currentFilters = customFilters?.columnFilters ?? columnFilters;
      const currentPresetFilters = customFilters?.presetFilters ?? presetFilters;
      const currentPageParam = customFilters?.page ?? currentPage;
      const currentPerPage = customFilters?.perPage ?? recordsPerPage;

      let countQuery = supabase
        .from('comune_catasto')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      let query = supabase
        .from('comune_catasto')
        .select(`
          *,
          stato_info:stati_generali(id, descrizione, colore),
          tipo_incarico_info:tipi_incarico(id, descrizione, comune, catasto),
          tipo_pratica_info:tipi_pratica(id, descrizione, blocco_fine_lavori)
        `)
        .eq('user_id', user?.id)
        .order('stato', { ascending: true })
        .order('created_at', { ascending: false });

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
      if (searchParts.length > 0) {
        const searchFilter = searchParts.join(',');
        countQuery = countQuery.or(searchFilter);
        query = query.or(searchFilter);
      }

      if (currentFilters.stato) {
        countQuery = countQuery.eq('stato', parseInt(currentFilters.stato));
        query = query.eq('stato', parseInt(currentFilters.stato));
      }

      if (currentFilters.tipo_incarico) {
        countQuery = countQuery.eq('tipo_incarico', parseInt(currentFilters.tipo_incarico));
        query = query.eq('tipo_incarico', parseInt(currentFilters.tipo_incarico));
      }

      if (currentFilters.tipo_pratica) {
        countQuery = countQuery.eq('tipo_pratica', parseInt(currentFilters.tipo_pratica));
        query = query.eq('tipo_pratica', parseInt(currentFilters.tipo_pratica));
      }

      if (currentFilters.comune === 'yes') {
        countQuery = countQuery.eq('comune', true);
        query = query.eq('comune', true);
      } else if (currentFilters.comune === 'no') {
        countQuery = countQuery.eq('comune', false);
        query = query.eq('comune', false);
      }

      if (currentFilters.catasto === 'yes') {
        countQuery = countQuery.eq('catasto', true);
        query = query.eq('catasto', true);
      } else if (currentFilters.catasto === 'no') {
        countQuery = countQuery.eq('catasto', false);
        query = query.eq('catasto', false);
      }

      if (currentFilters.fine_lavori === 'yes') {
        countQuery = countQuery.eq('fine_lavori', true);
        query = query.eq('fine_lavori', true);
      } else if (currentFilters.fine_lavori === 'no') {
        countQuery = countQuery.eq('fine_lavori', false);
        query = query.eq('fine_lavori', false);
      }

      if (currentFilters.acconto === 'yes') {
        countQuery = countQuery.eq('acconto', true);
        query = query.eq('acconto', true);
      } else if (currentFilters.acconto === 'no') {
        countQuery = countQuery.eq('acconto', false);
        query = query.eq('acconto', false);
      }

      if (currentFilters.saldo === 'yes') {
        countQuery = countQuery.eq('saldo', true);
        query = query.eq('saldo', true);
      } else if (currentFilters.saldo === 'no') {
        countQuery = countQuery.eq('saldo', false);
        query = query.eq('saldo', false);
      }

      if (currentPresetFilters.omaggio) {
        countQuery = countQuery.eq('omaggio', true);
        query = query.eq('omaggio', true);
      }

      if (currentPresetFilters.nonCompletati) {
        countQuery = countQuery.neq('stato', 3);
        query = query.neq('stato', 3);
      }

      if (currentPresetFilters.nonPagate) {
        const { data: statiNonPagata } = await supabase
          .from('stati_generali')
          .select('id')
          .eq('filtro_non_pagata', 1);
        const ids = (statiNonPagata || []).map(s => s.id);
        countQuery = countQuery.eq('saldo', false);
        query = query.eq('saldo', false);
        if (ids.length > 0) {
          countQuery = countQuery.in('stato', ids);
          query = query.in('stato', ids);
        }
      }

      const { count, error: countError } = await countQuery;
      if (countError) {
        console.error('Errore nel conteggio:', countError);
      } else {
        setTotalRecords(count || 0);
      }

      const from = (currentPageParam - 1) * currentPerPage;
      const to = from + currentPerPage - 1;
      query = query.range(from, to);

      const { data: praticheData, error: praticheError } = await query;

      if (praticheError) {
        console.error('Errore nel caricamento pratiche:', praticheError);
        toast.error('Errore nel caricamento delle pratiche');
        return;
      }

      if (stati.length === 0 || tipiIncarico.length === 0 || tipiPratica.length === 0) {
        const [statiResult, tipiResult, tipiPraticaResult] = await Promise.all([
          supabase.from('stati_generali').select('*').order('ordinamento'),
          supabase.from('tipi_incarico').select('*').order('descrizione'),
          supabase.from('tipi_pratica').select('*').order('descrizione')
        ]);

        if (!statiResult.error) setStati(statiResult.data || []);
        if (!tipiResult.error) setTipiIncarico(tipiResult.data || []);
        if (!tipiPraticaResult.error) setTipiPratica(tipiPraticaResult.data || []);
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

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('comune-catasto-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comune_catasto',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          setLastUpdateTime(new Date());

          if (payload.eventType === 'INSERT') {
            const { data: newRecord, error } = await supabase
              .from('comune_catasto')
              .select(`
                *,
                stato_info:stati_generali(id, descrizione, colore),
                tipo_incarico_info:tipi_incarico(id, descrizione, comune, catasto),
                tipo_pratica_info:tipi_pratica(id, descrizione, blocco_fine_lavori)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && newRecord) {
              setPratiche(prev => {
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
            const { data: updatedRecord, error } = await supabase
              .from('comune_catasto')
              .select(`
                *,
                stato_info:stati_generali(id, descrizione, colore),
                tipo_incarico_info:tipi_incarico(id, descrizione, comune, catasto),
                tipo_pratica_info:tipi_pratica(id, descrizione, blocco_fine_lavori)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && updatedRecord) {
              setPratiche(prev =>
                prev.map(pratica =>
                  pratica.id === updatedRecord.id ? updatedRecord : pratica
                )
              );

              const oldPratica = payload.old as ComuneCatasto;
              const messaggiToast: string[] = [];

              if (oldPratica.comune !== updatedRecord.comune) {
                messaggiToast.push(updatedRecord.comune ? 'Comune marcato come completato' : 'Comune marcato come non completato');
              }
              if (oldPratica.catasto !== updatedRecord.catasto) {
                messaggiToast.push(updatedRecord.catasto ? 'Catasto marcato come completato' : 'Catasto marcato come non completato');
              }
              if (oldPratica.fine_lavori !== updatedRecord.fine_lavori) {
                messaggiToast.push(updatedRecord.fine_lavori ? 'Fine lavori marcato come completato' : 'Fine lavori marcato come non completato');
              }
              if (oldPratica.acconto !== updatedRecord.acconto) {
                messaggiToast.push(updatedRecord.acconto ? 'Acconto marcato come ricevuto' : 'Acconto marcato come non ricevuto');
              }
              if (oldPratica.saldo !== updatedRecord.saldo) {
                messaggiToast.push(updatedRecord.saldo ? 'Saldo marcato come ricevuto' : 'Saldo marcato come non ricevuto');
              }
              if (oldPratica.omaggio !== updatedRecord.omaggio) {
                messaggiToast.push(updatedRecord.omaggio ? 'Omaggio marcato come consegnato' : 'Omaggio marcato come non consegnato');
              }
              if (oldPratica.stato !== updatedRecord.stato) {
                const oldStato = stati.find(s => s.id === oldPratica.stato)?.descrizione || 'N/A';
                const newStato = stati.find(s => s.id === updatedRecord.stato)?.descrizione || 'N/A';
                messaggiToast.push(`Stato cambiato da "${oldStato}" a "${newStato}"`);
              }

              if (messaggiToast.length > 0) {
                if (messaggiToast.length === 1) {
                  toast.success(messaggiToast[0]);
                } else {
                  toast.success(messaggiToast[0]);
                }
              }
            }
          }
          else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setPratiche(prev => prev.filter(pratica => pratica.id !== deletedId));
            setTotalRecords(prev => Math.max(0, prev - 1));
            toast.success('Pratica eliminata');
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [user?.id, stati, tipiIncarico, tipiPratica]);

  const handleColumnFilterChange = useCallback((key: keyof typeof columnFilters, value: string | 'all' | 'yes' | 'no') => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleResetFilters = () => {
    const defaultFilters: typeof columnFilters = {
      stato: '', committente: '', proprieta: '', indirizzo: '', citta: '', note: '',
      tipo_incarico: '', tipo_pratica: '',
      comune: 'all', catasto: 'all', fine_lavori: 'all', acconto: 'all', saldo: 'all'
    };
    const defaultPresetFilters = { nonCompletati: false, nonPagate: false, omaggio: false };
    setColumnFilters(defaultFilters);
    setPresetFilters(defaultPresetFilters);
    setCurrentPage(1);
    fetchData({ columnFilters: defaultFilters, presetFilters: defaultPresetFilters, page: 1 });
  };

  const handleApplyFilter = (overrides: Partial<typeof columnFilters>) => {
    const newFilters = { ...columnFilters, ...overrides };
    setColumnFilters(newFilters);
    setCurrentPage(1);
    fetchData({ columnFilters: newFilters, page: 1 });
  };

  const handlePresetFilterToggle = (filterName: keyof typeof presetFilters) => {
    const newPresetFilters = {
      ...presetFilters,
      [filterName]: !presetFilters[filterName]
    };
    setPresetFilters(newPresetFilters);
    setCurrentPage(1);
    fetchData({ presetFilters: newPresetFilters, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData({ page });
  };

  const handleRecordsPerPageChange = (newRecordsPerPage: number) => {
    setRecordsPerPage(newRecordsPerPage);
    localStorage.setItem('comune-catasto-records-per-page', newRecordsPerPage.toString());
    setCurrentPage(1);
    fetchData({ perPage: newRecordsPerPage, page: 1 });
  };

  const getTotalPages = () => {
    return Math.ceil(totalRecords / recordsPerPage);
  };

  const handleToggleField = async (pratica: ComuneCatasto, field: 'comune' | 'catasto' | 'fine_lavori' | 'acconto' | 'saldo' | 'omaggio') => {
    if (!isFlagAbilitatoInTabella(pratica, field)) {
      toast.error(`Il campo ${field} non può essere modificato per questo tipo di incarico`);
      return;
    }

    try {
      const newValue = !pratica[field];

      const updateData: any = { [field]: newValue };
      if (field === 'comune' && !newValue) {
        updateData.fine_lavori = false;
      }
      if (field === 'saldo') {
        if (newValue) {
          updateData.acconto = true;
        }
      }

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

      setPratiche(prev =>
        prev.map(p =>
          p.id === pratica.id
            ? {
              ...p,
              ...updateData,
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

  const verificaEAggiornaStatoCompletata = async (pratica: ComuneCatasto): Promise<number | null> => {
    const tipoIncarico = pratica.tipo_incarico_info;
    if (!tipoIncarico) return null;

    const statoCompletata = stati.find(stato =>
      stato.descrizione.toLowerCase().includes('completata') ||
      stato.descrizione.toLowerCase().includes('completato')
    );

    const statoInCorso = stati.find(stato =>
      stato.descrizione.toLowerCase().includes('in corso') ||
      stato.descrizione.toLowerCase().includes('corso') ||
      stato.descrizione.toLowerCase().includes('lavorazione')
    );

    if (!statoCompletata || !statoInCorso) return null;

    let tuttiIFlagCompletati = true;

    if (tipoIncarico.comune && !pratica.comune) {
      tuttiIFlagCompletati = false;
    }

    if (tipoIncarico.catasto && !pratica.catasto) {
      tuttiIFlagCompletati = false;
    }

    if (tipoIncarico.comune && !pratica.tipo_pratica_info?.blocco_fine_lavori && !pratica.fine_lavori) {
      tuttiIFlagCompletati = false;
    }

    if (tuttiIFlagCompletati && pratica.stato !== statoCompletata.id) {
      return statoCompletata.id;
    }

    if (!tuttiIFlagCompletati && pratica.stato === statoCompletata.id) {
      return statoInCorso.id;
    }

    return null;
  };

  const isFlagAbilitatoInTabella = (pratica: ComuneCatasto, flagName: 'comune' | 'catasto' | 'fine_lavori' | 'acconto' | 'saldo' | 'omaggio') => {
    const tipoIncarico = pratica.tipo_incarico_info;

    switch (flagName) {
      case 'comune':
        return tipoIncarico?.comune === true;
      case 'catasto':
        return tipoIncarico?.catasto === true;
      case 'fine_lavori':
        return pratica.comune === true && !pratica.tipo_pratica_info?.blocco_fine_lavori;
      case 'acconto':
        return pratica.saldo !== true; // Disabilita acconto se saldo è flaggato
      case 'saldo':
      case 'omaggio':
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

      toast.success('Pratica eliminata con successo');
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

  const combineTelefoni = (telefono1: string | null | undefined, telefono2: string | null | undefined): string => {
    const formatted1 = telefono1 ? formatTelefono(telefono1) : '';
    const formatted2 = telefono2 ? formatTelefono(telefono2) : '';

    if (!formatted1 && !formatted2) return '-';
    if (!formatted2) return formatted1;
    if (!formatted1) return formatted2;

    return `${formatted1} / ${formatted2}`;
  };

  const combineProprieta = (proprieta1: string | null | undefined, proprieta2: string | null | undefined): string => {
    if (!proprieta1 && !proprieta2) return '-';
    if (!proprieta2) return proprieta1 || '-';
    if (!proprieta1) return proprieta2 || '-';

    return `${proprieta1} / ${proprieta2}`;
  };

  const handleContextMenu = (e: React.MouseEvent, pratica: ComuneCatasto) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pratica });
  };

  const handleContextMenuAction = (action: 'edit' | 'status' | 'contact' | 'duplicate' | 'delete', pratica: ComuneCatasto) => {
    setContextMenu({ x: 0, y: 0, pratica: null });
    if (action === 'edit') {
      openModal(pratica);
    } else if (action === 'status') {
      setSelectedPraticaForContextMenu(pratica);
      setNewStatusForContextMenu(pratica.stato?.toString() || '');
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
      .from('comune_catasto')
      .update({ stato: parseInt(newStatusForContextMenu) })
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

  const handleDuplicatePratica = async (pratica: ComuneCatasto) => {
    try {
      const { id, created_at, updated_at, progressivo, ...praticaData } = pratica;
      
      const duplicatedData = {
        ...praticaData,
        committente: `${praticaData.committente}`,
        stato: 1,
        acconto: false,
        saldo: false,
        omaggio: false,
        created_at: new Date().toISOString(),
        user_id: user?.id
      };

      const { error } = await supabase
        .from('comune_catasto')
        .insert([duplicatedData]);

      if (error) {
        console.error('Errore duplicazione pratica:', error);
        toast.error('Errore nella duplicazione della pratica');
        return;
      }

      await fetchData();
      toast.success('Pratica duplicata con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nella duplicazione della pratica');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!e || !e.target) {
      return;
    }

    const { name, value, type } = e.target;

    if (!name) {
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
        stato: formData.stato ? parseInt(formData.stato) : null,
        tipo_incarico: formData.tipo_incarico ? parseInt(formData.tipo_incarico) : null,
        tipo_pratica: formData.tipo_pratica ? parseInt(formData.tipo_pratica) : null,
        user_id: user?.id
      };

      const tipoPraticaSelezionata = dataToSave.tipo_pratica
        ? tipiPratica.find(t => t.id === dataToSave.tipo_pratica)
        : null;
      if (tipoPraticaSelezionata?.blocco_fine_lavori) {
        dataToSave.fine_lavori = false;
      }

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
          acconto: formData.acconto,
          saldo: formData.saldo,
          omaggio: formData.omaggio,
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
                  tipo_pratica: dataToSave.tipo_pratica ?? undefined,
                  tipo_pratica_info: dataToSave.tipo_pratica ? tipiPratica.find(t => t.id === dataToSave.tipo_pratica) : undefined,
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
                  acconto: dataToSave.acconto,
                  saldo: dataToSave.saldo,
                  omaggio: dataToSave.omaggio,
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

        if (tipoIncaricoSelezionato?.ape) {
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
                user_id: user?.id
              }]);

            if (apeError) {
              console.error('Errore creazione pratica APE:', apeError);
              toast.error('Pratica creata ma errore nella creazione della pratica APE');
            } else {
              toast.success('Pratica APE creata automaticamente');
            }
          } catch (apeError) {
            console.error('Errore creazione pratica APE:', apeError);
          }
        }
      }

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

  const openModal = (pratica?: ComuneCatasto) => {
    if (pratica) {
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
        tipo_pratica: pratica.tipo_pratica?.toString() || '',
        comune: pratica.comune,
        catasto: pratica.catasto,
        fine_lavori: pratica.tipo_pratica_info?.blocco_fine_lavori ? false : pratica.fine_lavori,
        acconto: pratica.acconto,
        saldo: pratica.saldo,
        omaggio: pratica.omaggio,
        note: pratica.note || ''
      };

      setFormData(editFormData);
    } else {
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
        tipo_pratica: '',
        comune: false,
        catasto: false,
        fine_lavori: false,
        acconto: false,
        saldo: false,
        omaggio: false,
        note: ''
      };

      setFormData(newFormData);
    }

    setShowModal(true);
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
      tipo_pratica: '',
      comune: false,
      catasto: false,
      fine_lavori: false,
      acconto: false,
      saldo: false,
      omaggio: false,
      note: ''
    });
  };

  const getTipoIncaricoSelezionato = () => {
    if (!formData.tipo_incarico) return null;
    return tipiIncarico.find(tipo => tipo.id === parseInt(formData.tipo_incarico));
  };

  const getTipoPraticaSelezionata = () => {
    if (!formData.tipo_pratica) return null;
    return tipiPratica.find(tipo => tipo.id === parseInt(formData.tipo_pratica));
  };

  const isFlagAbilitato = (flagName: 'comune' | 'catasto' | 'fine_lavori' | 'acconto' | 'saldo' | 'omaggio') => {
    const tipoSelezionato = getTipoIncaricoSelezionato();
    const tipoPraticaSelezionata = getTipoPraticaSelezionata();

    switch (flagName) {
      case 'comune':
        return tipoSelezionato?.comune === true;
      case 'catasto':
        return tipoSelezionato?.catasto === true;
      case 'fine_lavori':
        return formData.comune === true && !tipoPraticaSelezionata?.blocco_fine_lavori;
      case 'acconto':
        return formData.saldo !== true; // Disabilita acconto se saldo è flaggato
      case 'saldo':
      case 'omaggio':
        return true;
      default:
        return false;
    }
  };

  const handleTipoIncaricoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuovoTipoIncarico = e.target.value;
    const tipoSelezionato = tipiIncarico.find(tipo => tipo.id === parseInt(nuovoTipoIncarico));

    setFormData(prev => {
      const nuovoFormData = {
        ...prev,
        tipo_incarico: nuovoTipoIncarico
      };

      if (!tipoSelezionato?.comune) {
        nuovoFormData.comune = false;
        nuovoFormData.fine_lavori = false;
      }

      if (!tipoSelezionato?.catasto) {
        nuovoFormData.catasto = false;
      }

      return nuovoFormData;
    });
  };

  const handleTipoPraticaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuovoTipoPratica = e.target.value;
    const tipoSelezionato = tipiPratica.find(tipo => tipo.id === parseInt(nuovoTipoPratica));

    setFormData(prev => ({
      ...prev,
      tipo_pratica: nuovoTipoPratica,
      fine_lavori: tipoSelezionato?.blocco_fine_lavori ? false : prev.fine_lavori
    }));
  };

  const handleComuneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuovoComune = e.target.checked;
    const tipoPraticaSelezionata = getTipoPraticaSelezionata();

    setFormData(prev => ({
      ...prev,
      comune: nuovoComune,
      fine_lavori: (nuovoComune && !tipoPraticaSelezionata?.blocco_fine_lavori) ? prev.fine_lavori : false
    }));
  };

  const handleSaldoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuovoSaldo = e.target.checked;

    setFormData(prev => ({
      ...prev,
      saldo: nuovoSaldo,
      acconto: nuovoSaldo ? true : prev.acconto
    }));
  };

  const getStatoStyle = (stato: StatoGenerale | undefined) => {
    if (!stato || !stato.colore) return 'bg-ink-100 text-ink-800';
    return 'text-white';
  };

  const getStatoBackgroundColor = (stato: StatoGenerale | undefined) => {
    if (!stato || !stato.colore) return '#6b7280';
    return stato.colore;
  };

  const renderToggleButton = (value: boolean, enabled: boolean = true) => {
    return (
      <div
        className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 ${enabled ? 'hover:scale-105' : ''
          } ${value
            ? 'bg-topo-100 hover:bg-topo-200'
            : 'bg-ink-100 hover:bg-ink-200'
          } ${!enabled ? 'opacity-70 cursor-not-allowed border-2 border-dashed border-ink-300' : ''
          }`}
      >
        {value ? (
          <Check className="w-4 h-4 text-topo-600" />
        ) : (
          <X className="w-4 h-4 text-ink-400" />
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">

      <div className="gap-3 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-ink-700">Comune e Catasto</h1>
            <p className="text-ink-500">Gestione pratiche</p>
            {realtimeConnected && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-topo-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-topo-600">
                  Aggiornamenti in tempo reale attivi
                  {lastUpdateTime && (
                    <span className="ml-1 text-ink-400">
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
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink-600 bg-ink-100 rounded-md hover:bg-ink-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Reset filtri
                <span className="bg-signal-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openModal()}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuova Pratica
            </button>
          </div>
        </div>

        {/* Filtri preimpostati */}
        <div className="flex flex-wrap gap-3">
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 ${
            presetFilters.nonCompletati
              ? 'bg-signal-500 text-white shadow-md'
              : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
          }`}>
            <input
              type="checkbox"
              checked={presetFilters.nonCompletati}
              onChange={() => handlePresetFilterToggle('nonCompletati')}
              className="sr-only"
            />
            Non completati
          </label>

          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 ${
            presetFilters.nonPagate
              ? 'bg-red-500 text-white shadow-md'
              : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
          }`}>
            <input
              type="checkbox"
              checked={presetFilters.nonPagate}
              onChange={() => handlePresetFilterToggle('nonPagate')}
              className="sr-only"
            />
            Non pagate
          </label>
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 ${
            presetFilters.omaggio
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
          }`}>
            <input
              type="checkbox"
              checked={presetFilters.omaggio}
              onChange={() => handlePresetFilterToggle('omaggio')}
              className="sr-only"
            />
            Omaggio
          </label>
        </div>

        {/* Tabella - Container con altezza flessibile e scroll interno */}
        <div className="card card-flush p-0 flex-1" style={{ height: 'calc(100vh - 300px)', overflow: 'hidden' }}>
          <div className="overflow-x-auto h-full overflow-y-auto">
            <table className="w-full table" style={{ minHeight: '400px' }}>
              <thead className="table-header">
                <tr>
                  <th className="table-cell text-left">
                    Stato
                  </th>
                  <th className="table-cell text-left">
                    Committente
                  </th>
                  <th className="table-cell text-left">
                    Proprietà
                  </th>
                  <th className="table-cell text-left">
                    Città
                  </th>
                  <th className="table-cell text-left">
                    Indirizzo
                  </th>
                  <th className="table-cell text-left">
                    Note
                  </th>
                  <th className="table-cell text-left">
                    Tipo Incarico
                  </th>
                  <th className="table-cell text-left">
                    Tipo Pratica
                  </th>
                  <th className="table-cell text-center">
                    Comune
                  </th>
                  <th className="table-cell text-center">
                    Catasto
                  </th>
                  <th className="table-cell text-center">
                    Fine Lavori
                  </th>
                  <th className="table-cell text-center">
                    Acconto
                  </th>
                  <th className="table-cell text-center">
                    Saldo
                  </th>
                </tr>
                {/* Riga filtri inline */}
                <tr className="bg-ink-100 border-b border-ink-200">
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <select
                        value={columnFilters.stato}
                        onChange={(e) => handleApplyFilter({ stato: e.target.value })}
                        className="w-full text-xs px-2 py-1.5 border border-ink-300 rounded-md bg-white text-ink-700 appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      >
                        <option value="" className="bg-white">Tutti</option>
                        {stati.map((stato) => (
                          <option key={stato.id} value={stato.id} className="bg-white">
                            {stato.descrizione}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-ink-400 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={columnFilters.committente}
                        onChange={(e) => handleColumnFilterChange('committente', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                            handleApplyFilter({ committente: (e.target as HTMLInputElement).value });
                          }
                        }}
                        placeholder="Cerca..."
                        className="w-full text-xs px-2 py-1.5 pr-7 border border-ink-300 rounded-md bg-white text-ink-700 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyFilter({ committente: columnFilters.committente })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-600 hover:bg-ink-200 transition-colors"
                        title="Cerca"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={columnFilters.proprieta}
                        onChange={(e) => handleColumnFilterChange('proprieta', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                            handleApplyFilter({ proprieta: (e.target as HTMLInputElement).value });
                          }
                        }}
                        placeholder="Cerca..."
                        className="w-full text-xs px-2 py-1.5 pr-7 border border-ink-300 rounded-md bg-white text-ink-700 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyFilter({ proprieta: columnFilters.proprieta })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-600 hover:bg-ink-200 transition-colors"
                        title="Cerca"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={columnFilters.citta}
                        onChange={(e) => handleColumnFilterChange('citta', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                            handleApplyFilter({ citta: (e.target as HTMLInputElement).value });
                          }
                        }}
                        placeholder="Cerca..."
                        className="w-full text-xs px-2 py-1.5 pr-7 border border-ink-300 rounded-md bg-white text-ink-700 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyFilter({ citta: columnFilters.citta })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-600 hover:bg-ink-200 transition-colors"
                        title="Cerca"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={columnFilters.indirizzo}
                        onChange={(e) => handleColumnFilterChange('indirizzo', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                            handleApplyFilter({ indirizzo: (e.target as HTMLInputElement).value });
                          }
                        }}
                        placeholder="Cerca..."
                        className="w-full text-xs px-2 py-1.5 pr-7 border border-ink-300 rounded-md bg-white text-ink-700 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyFilter({ indirizzo: columnFilters.indirizzo })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-600 hover:bg-ink-200 transition-colors"
                        title="Cerca"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={columnFilters.note}
                        onChange={(e) => handleColumnFilterChange('note', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                            handleApplyFilter({ note: (e.target as HTMLInputElement).value });
                          }
                        }}
                        placeholder="Cerca..."
                        className="w-full text-xs px-2 py-1.5 pr-7 border border-ink-300 rounded-md bg-white text-ink-700 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyFilter({ note: columnFilters.note })}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-600 hover:bg-ink-200 transition-colors"
                        title="Cerca"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <select
                        value={columnFilters.tipo_incarico}
                        onChange={(e) => handleApplyFilter({ tipo_incarico: e.target.value })}
                        className="w-full text-xs px-2 py-1.5 border border-ink-300 rounded-md bg-white text-ink-700 appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      >
                        <option value="" className="bg-white">Tutti</option>
                        {tipiIncarico.map((tipo) => (
                          <option key={tipo.id} value={tipo.id} className="bg-white">
                            {tipo.descrizione}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-ink-400 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <select
                        value={columnFilters.tipo_pratica}
                        onChange={(e) => handleApplyFilter({ tipo_pratica: e.target.value })}
                        className="w-full text-xs px-2 py-1.5 border border-ink-300 rounded-md bg-white text-ink-700 appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-signal-500/20 focus:border-signal-500"
                      >
                        <option value="" className="bg-white">Tutti</option>
                        {tipiPratica.map((tipo) => (
                          <option key={tipo.id} value={tipo.id} className="bg-white">
                            {tipo.descrizione}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-ink-400 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <TriStateFilter
                      value={columnFilters.comune}
                      onChange={(v) => handleApplyFilter({ comune: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <TriStateFilter
                      value={columnFilters.catasto}
                      onChange={(v) => handleApplyFilter({ catasto: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <TriStateFilter
                      value={columnFilters.fine_lavori}
                      onChange={(v) => handleApplyFilter({ fine_lavori: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <TriStateFilter
                      value={columnFilters.acconto}
                      onChange={(v) => handleApplyFilter({ acconto: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <TriStateFilter
                      value={columnFilters.saldo}
                      onChange={(v) => handleApplyFilter({ saldo: v })}
                    />
                  </td>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ink-100">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-8 text-center text-ink-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-signal-500"></div>
                        <span className="ml-2">Caricamento...</span>
                      </div>
                    </td>
                  </tr>
                ) : pratiche.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-8 text-center text-ink-500">
                      Nessuna pratica trovata
                    </td>
                  </tr>
                ) : (
                  pratiche.map((pratica) => (
                    <tr key={pratica.id} className="table-row hover:bg-ink-50" onContextMenu={(e) => handleContextMenu(e, pratica)}>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getStatoStyle(pratica.stato_info)}`}
                          style={{ backgroundColor: getStatoBackgroundColor(pratica.stato_info) }}
                        >
                          {pratica.stato_info?.descrizione || 'N/A'}
                        </span>
                      </td>
                      <td className="table-cell font-medium text-ink-700">
                        {pratica.committente}
                      </td>
                      <td className="table-cell text-ink-600">
                        {combineProprieta(pratica.proprieta, pratica.proprieta2)}
                      </td>
                      <td className="table-cell text-ink-600 max-w-xs truncate">
                        {pratica.citta || '-'}
                      </td>
                      <td className="table-cell text-ink-600 max-w-xs truncate">
                        {pratica.indirizzo || '-'}
                      </td>
                      <td className="table-cell text-ink-600 max-w-xs truncate">
                        {pratica.note || '-'}
                      </td>
                      <td className="table-cell text-ink-600">
                        {pratica.tipo_incarico_info?.descrizione || '-'}
                      </td>
                      <td className="table-cell text-ink-600">
                        {pratica.tipo_pratica_info?.descrizione || '-'}
                      </td>
                      <td className="table-cell text-center">
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
                      <td className="table-cell text-center">
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
                      <td className="table-cell text-center">
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
                              : pratica.tipo_pratica_info?.blocco_fine_lavori
                                ? 'Bloccato dal tipo pratica'
                                : 'Abilitato solo se Comune è attivo'
                          }
                        >
                          {renderToggleButton(pratica.fine_lavori, isFlagAbilitatoInTabella(pratica, 'fine_lavori'))}
                        </button>
                      </td>
                      <td className="table-cell text-center">
                        <button
                          onClick={() => handleToggleField(pratica, 'acconto')}
                          className="transition-colors cursor-pointer"
                          title="Clicca per cambiare stato"
                        >
                          {renderToggleButton(pratica.acconto, pratica.saldo !== true)}
                        </button>
                      </td>
                      <td className="table-cell text-center">
                        <button
                          onClick={() => handleToggleField(pratica, 'saldo')}
                          className="transition-colors cursor-pointer"
                          title="Clicca per cambiare stato"
                        >
                          {renderToggleButton(pratica.saldo, true)}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Controlli Paginazione */}
          {pratiche.length > 0 && (
            <div className="px-6 py-4 border-t border-ink-200 bg-ink-50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-ink-500">
                  Mostrando {Math.min((currentPage - 1) * recordsPerPage + 1, totalRecords)} - {Math.min(currentPage * recordsPerPage, totalRecords)} di {totalRecords} pratiche
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-ink-500">Record:</span>
                    <select
                      value={recordsPerPage}
                      onChange={(e) => handleRecordsPerPageChange(parseInt(e.target.value))}
                      className="input py-1 px-2 text-sm"
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
                        className="px-3 py-1 text-sm border border-ink-300 rounded-md hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed text-ink-600"
                      >
                        ««
                      </button>

                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-ink-300 rounded-md hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed text-ink-600"
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
                            className={`px-3 py-1 text-sm border rounded-md ${currentPage === pageNum
                                ? 'bg-signal-500 text-white border-signal-500'
                                : 'border-ink-300 hover:bg-ink-100 text-ink-600'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === getTotalPages()}
                        className="px-3 py-1 text-sm border border-ink-300 rounded-md hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed text-ink-600"
                      >
                        ›
                      </button>

                      <button
                        onClick={() => handlePageChange(getTotalPages())}
                        disabled={currentPage === getTotalPages()}
                        className="px-3 py-1 text-sm border border-ink-300 rounded-md hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed text-ink-600"
                      >
                        »»
                      </button>
                    </div>
                  )}
                </div>

                {getTotalPages() > 1 && (
                  <div className="text-sm text-ink-500">
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
            <div className="modal w-full max-w-4xl modal-scroll-container">
              <div className="modal-header">
                <h2 className="text-xl font-display font-bold text-ink-700">
                  {editingPratica ? 'Modifica Pratica' : 'Nuova Pratica'}
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 rounded-md text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-body">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Prima colonna */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Committente *
                      </label>
                      <input
                        type="text"
                        name="committente"
                        value={formData.committente}
                        onChange={handleInputChange}
                        placeholder="Nome committente"
                        className="input w-full"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Stato
                      </label>
                      <div className="relative">
                        <select
                          name="stato"
                          value={formData.stato}
                          onChange={handleInputChange}
                          className="input w-full pr-8 appearance-none"
                        >
                          <option value="">-- Seleziona stato --</option>
                          {stati.map((stato) => (
                            <option key={stato.id} value={stato.id}>
                              {stato.descrizione}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
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
                        placeholder="Nome proprietà"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Proprietà 2
                      </label>
                      <input
                        type="text"
                        name="proprieta2"
                        value={formData.proprieta2}
                        onChange={handleInputChange}
                        placeholder="Nome secondo proprietario"
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Indirizzo
                      </label>
                      <input
                        type="text"
                        name="indirizzo"
                        value={formData.indirizzo}
                        onChange={handleInputChange}
                        placeholder="Indirizzo"
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Città
                      </label>
                      <input
                        type="text"
                        name="citta"
                        value={formData.citta}
                        onChange={handleInputChange}
                        placeholder="Città"
                        className="input w-full"
                      />
                    </div>
                  </div>

                  {/* Seconda colonna */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Telefono
                      </label>
                      <input
                        type="tel"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleInputChange}
                        placeholder="XXX XXX XXXX"
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Telefono 2
                      </label>
                      <input
                        type="tel"
                        name="telefono2"
                        value={formData.telefono2}
                        onChange={handleInputChange}
                        placeholder="XXX XXX XXXX"
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="mail"
                        value={formData.mail}
                        onChange={handleInputChange}
                        placeholder="Indirizzo email"
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Tipo Incarico
                      </label>
                      <div className="relative">
                        <select
                          name="tipo_incarico"
                          value={formData.tipo_incarico}
                          onChange={handleTipoIncaricoChange}
                          className="input w-full pr-8 appearance-none"
                        >
                          <option value="">-- Seleziona tipo incarico --</option>
                          {tipiIncarico.map((tipo) => (
                            <option key={tipo.id} value={tipo.id}>
                              {tipo.descrizione}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Tipo Pratica
                      </label>
                      <div className="relative">
                        <select
                          name="tipo_pratica"
                          value={formData.tipo_pratica}
                          onChange={handleTipoPraticaChange}
                          className="input w-full pr-8 appearance-none"
                        >
                          <option value="">-- Seleziona tipo pratica --</option>
                          {tipiPratica.map((tipo) => (
                            <option key={tipo.id} value={tipo.id}>
                              {tipo.descrizione}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">
                        Note
                      </label>
                      <textarea
                        name="note"
                        value={formData.note}
                        onChange={handleInputChange}
                        placeholder="Note aggiuntive"
                        rows={4}
                        className="input w-full resize-none"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <label className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-150 border-2 ${!isFlagAbilitato('comune')
                            ? 'opacity-30 cursor-not-allowed bg-ink-100 border-ink-300 text-ink-400 border-dashed'
                            : formData.comune
                              ? 'bg-signal-50 border-signal-500 text-signal-700 cursor-pointer'
                              : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="comune"
                            checked={formData.comune}
                            onChange={handleComuneChange}
                            disabled={!isFlagAbilitato('comune')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${formData.comune
                              ? 'border-signal-500 bg-signal-500'
                              : 'border-ink-300 bg-transparent'
                            }`}>
                            {formData.comune && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">Comune</span>
                        </label>

                        <label className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-150 border-2 ${!isFlagAbilitato('catasto')
                            ? 'opacity-30 cursor-not-allowed bg-ink-100 border-ink-300 text-ink-400 border-dashed'
                            : formData.catasto
                              ? 'bg-info-50 border-info-500 text-info-700 cursor-pointer'
                              : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="catasto"
                            checked={formData.catasto}
                            onChange={handleInputChange}
                            disabled={!isFlagAbilitato('catasto')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${formData.catasto
                              ? 'border-info-500 bg-info-500'
                              : 'border-ink-300 bg-transparent'
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
                        <label className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-150 border-2 ${!isFlagAbilitato('fine_lavori')
                            ? 'opacity-30 cursor-not-allowed bg-ink-100 border-ink-300 text-ink-400 border-dashed'
                            : formData.fine_lavori
                              ? 'bg-topo-50 border-topo-500 text-topo-700 cursor-pointer'
                              : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="fine_lavori"
                            checked={formData.fine_lavori}
                            onChange={handleInputChange}
                            disabled={!isFlagAbilitato('fine_lavori')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${formData.fine_lavori
                              ? 'border-topo-500 bg-topo-500'
                              : 'border-ink-300 bg-transparent'
                            }`}>
                            {formData.fine_lavori && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">Fine Lavori</span>
                        </label>

                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <label className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-150 border-2 ${formData.acconto
                            ? 'bg-info-50 border-info-500 text-info-700 cursor-pointer'
                            : formData.saldo
                            ? 'bg-ink-50 border-ink-200 text-ink-400 cursor-not-allowed opacity-50'
                            : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="acconto"
                            checked={formData.acconto}
                            onChange={handleInputChange}
                            disabled={formData.saldo}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${formData.acconto
                              ? 'border-info-500 bg-info-500'
                              : 'border-ink-300 bg-transparent'
                            }`}>
                            {formData.acconto && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">Acconto</span>
                        </label>

                        <label className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-150 border-2 ${formData.saldo
                            ? 'bg-topo-50 border-topo-500 text-topo-700 cursor-pointer'
                            : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="saldo"
                            checked={formData.saldo}
                            onChange={handleSaldoChange}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${formData.saldo
                              ? 'border-topo-500 bg-topo-500'
                              : 'border-ink-300 bg-transparent'
                            }`}>
                            {formData.saldo && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">Saldo</span>
                        </label>

                        <label className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-150 border-2 ${formData.omaggio
                            ? 'bg-warning-50 border-warning-500 text-warning-700 cursor-pointer'
                            : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100 cursor-pointer'
                          }`}>
                          <input
                            type="checkbox"
                            name="omaggio"
                            checked={formData.omaggio}
                            onChange={handleInputChange}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${formData.omaggio
                              ? 'border-warning-500 bg-warning-500'
                              : 'border-ink-300 bg-transparent'
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
                </div>
                
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-ink-200">
                  <div className="text-sm text-ink-500">
                    <p>* Campo obbligatorio</p>
                    <p className="mt-1">
                      <kbd className="px-2 py-1 text-xs font-semibold text-ink-600 bg-ink-100 border border-ink-200 rounded-md">
                        {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}
                      </kbd>
                      {' + '}
                      <kbd className="px-2 py-1 text-xs font-semibold text-ink-600 bg-ink-100 border border-ink-200 rounded-md">
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
                      className="btn btn-ghost"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-primary"
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
      </div>

      {/* Menu Contestuale */}
      {contextMenu.pratica && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}>
          <button
            onClick={() => handleContextMenuAction('edit', contextMenu.pratica!)}
            className="context-menu-item"
          >
            <Edit className="w-4 h-4 text-signal-500" />
            Modifica
          </button>
          <button
            onClick={() => handleContextMenuAction('status', contextMenu.pratica!)}
            className="context-menu-item"
          >
            <ArrowRightCircle className="w-4 h-4 text-warning-500" />
            Cambia stato
          </button>
          <button
            onClick={() => handleContextMenuAction('contact', contextMenu.pratica!)}
            className="context-menu-item"
          >
            <User className="w-4 h-4 text-info-500" />
            Contatto
          </button>
          <div className="context-menu-separator" />
          <button
            onClick={() => handleContextMenuAction('duplicate', contextMenu.pratica!)}
            className="context-menu-item"
          >
            <Copy className="w-4 h-4 text-topo-500" />
            Duplica
          </button>
          <div className="context-menu-separator" />
          <button
            onClick={() => handleContextMenuAction('delete', contextMenu.pratica!)}
            className="context-menu-item context-menu-danger"
          >
            <Trash2 className="w-4 h-4" />
            Elimina
          </button>
        </ContextMenu>
      )}

      {/* Modal Cambia Stato da Menu Contestuale */}
      {showContextMenuActionModal === 'status' && selectedPraticaForContextMenu && (
        <div className="modal-overlay">
          <div className="modal w-full max-w-sm">
            <div className="modal-header">
              <h3 className="text-lg font-display font-semibold text-ink-700">
                Cambia Stato - {selectedPraticaForContextMenu.committente}
              </h3>
            </div>
            <div className="modal-body">
              <select
                value={newStatusForContextMenu}
                onChange={(e) => setNewStatusForContextMenu(e.target.value)}
                className="input w-full"
              >
                <option value="">Seleziona stato</option>
                {stati.map((stato) => (
                  <option key={stato.id} value={stato.id}>
                    {stato.descrizione}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => {
                  setShowContextMenuActionModal(null);
                  setSelectedPraticaForContextMenu(null);
                }}
                className="btn btn-ghost"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleChangeStatusFromContextMenu}
                disabled={!newStatusForContextMenu}
                className="btn btn-primary"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Contatto da Menu Contestuale */}
      {showContextMenuActionModal === 'contatto' && selectedPraticaForContextMenu && (
        <div className="modal-overlay">
          <div className="modal w-full max-w-md">
            <div className="modal-header">
              <h3 className="text-lg font-display font-semibold text-ink-700">
                Contatto - {selectedPraticaForContextMenu.committente}
              </h3>
            </div>
            <div className="modal-body">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">Proprietario</label>
                  <p className="text-ink-700">{selectedPraticaForContextMenu.proprieta || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">Telefono</label>
                  <p className="text-ink-700 font-mono">{selectedPraticaForContextMenu.telefono || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">Email</label>
                  <p className="text-ink-700">{selectedPraticaForContextMenu.mail || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 uppercase tracking-wider mb-1">Indirizzo</label>
                  <p className="text-ink-700">
                    {selectedPraticaForContextMenu.indirizzo || '-'}{selectedPraticaForContextMenu.citta ? `, ${selectedPraticaForContextMenu.citta}` : ''}
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => {
                  setShowContextMenuActionModal(null);
                  setSelectedPraticaForContextMenu(null);
                }}
                className="btn btn-ghost"
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
