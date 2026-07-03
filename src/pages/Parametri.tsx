import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Building, Calculator, Briefcase, Calendar, FileCheck, Settings, CreditCard, Tag } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface DatiAzienda {
  id?: number;
  denominazione: string;
  indirizzo: string;
  citta: string;
  cap: string;
  nazione: string;
  partita_iva: string;
  codice_fiscale: string;
  codice_ape: string;
}

interface ParametroFatturazione {
  id: number;
  anno: number;
  percentuale: number;
  created_at: string;
  updated_at: string;
}

interface TipoIncarico {
  id: number;
  descrizione: string;
  comune: boolean;
  catasto: boolean;
  ape: boolean;
  created_at: string;
  updated_at: string;
}

interface CategoriaPlanner {
  id: number;
  slug: string;
  name: string;
  color: string;
  order_position: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TipoPratica {
  id: number;
  descrizione: string;
  created_at: string;
  updated_at: string;
}

interface StatoApe {
  id: number;
  descrizione: string;
  colore: string;
  created_at: string;
  updated_at: string;
}

interface StatoGenerale {
  id: number;
  descrizione: string;
  colore: string;
  created_at: string;
  updated_at: string;
}

interface StatoScadenza {
  id: number;
  descrizione: string;
  colore: string;
  created_at: string;
  updated_at: string;
}

export const Parametri: React.FC = () => {
  const { user } = useAuthStore();
  
  // Stati per Dati Azienda
  const [datiAzienda, setDatiAzienda] = useState<DatiAzienda>({
    denominazione: '',
    indirizzo: '',
    citta: '',
    cap: '',
    nazione: 'Italia',
    partita_iva: '',
    codice_fiscale: '',
    codice_ape: ''
  });
  const [editingAzienda, setEditingAzienda] = useState(false);

  // Stati per Parametri Fatturazione
  const [parametriFatturazione, setParametriFatturazione] = useState<ParametroFatturazione[]>([]);
  const [showModalParametri, setShowModalParametri] = useState(false);
  const [editingParametro, setEditingParametro] = useState<ParametroFatturazione | null>(null);
  const [formParametri, setFormParametri] = useState({ anno: new Date().getFullYear(), percentuale: 22 });

  // Stati per Tipi Incarico
  const [tipiIncarico, setTipiIncarico] = useState<TipoIncarico[]>([]);
  const [showModalTipi, setShowModalTipi] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoIncarico | null>(null);
  const [formTipi, setFormTipi] = useState({ descrizione: '', comune: false, catasto: false, ape: false });

  // Stati per Categorie Planner
  const [categoriePlanner, setCategoriePlanner] = useState<CategoriaPlanner[]>([]);
  const [showModalCategorie, setShowModalCategorie] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaPlanner | null>(null);
  const [formCategorie, setFormCategorie] = useState({ slug: '', name: '', color: '#3b82f6', order_position: 1, active: true });

  // Stati per Stati APE
  const [statiApe, setStatiApe] = useState<StatoApe[]>([]);
  const [showModalStatiApe, setShowModalStatiApe] = useState(false);
  const [editingStatoApe, setEditingStatoApe] = useState<StatoApe | null>(null);
  const [formStatiApe, setFormStatiApe] = useState({ descrizione: '', colore: '#10b981' });

  // Stati per Stati Generali
  const [statiGenerali, setStatiGenerali] = useState<StatoGenerale[]>([]);
  const [showModalStatiGenerali, setShowModalStatiGenerali] = useState(false);
  const [editingStatoGenerale, setEditingStatoGenerale] = useState<StatoGenerale | null>(null);
  const [formStatiGenerali, setFormStatiGenerali] = useState({ descrizione: '', colore: '#6366f1' });

  // Stati per Stati Scadenze
  const [statiScadenze, setStatiScadenze] = useState<StatoScadenza[]>([]);
  const [showModalStatiScadenze, setShowModalStatiScadenze] = useState(false);
  const [editingStatoScadenza, setEditingStatoScadenza] = useState<StatoScadenza | null>(null);
  const [formStatiScadenze, setFormStatiScadenze] = useState({ descrizione: '', colore: '#f43f5e' });

  // Stati per Tipi Pratica
  const [tipiPratica, setTipiPratica] = useState<TipoPratica[]>([]);
  const [showModalTipiPratica, setShowModalTipiPratica] = useState(false);
  const [editingTipoPratica, setEditingTipoPratica] = useState<TipoPratica | null>(null);
  const [formTipiPratica, setFormTipiPratica] = useState({ descrizione: '' });

  // Funzione per ottenere la prossima posizione disponibile
  const getNextOrderPosition = () => {
    if (categoriePlanner.length === 0) return 1;
    const maxPosition = Math.max(...categoriePlanner.map(cat => cat.order_position));
    return maxPosition + 1;
  };

  // Funzione per generare slug dal nome
  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const [loading, setLoading] = useState(true);

  // Caricamento dati iniziale
  useEffect(() => {
    if (user?.id) {
      loadAllData();
    }
  }, [user?.id]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDatiAzienda(),
      loadParametriFatturazione(),
      loadTipiIncarico(),
      loadCategoriePlanner(),
      loadStatiApe(),
      loadStatiGenerali(),
      loadStatiScadenze(),
      loadTipiPratica()
    ]);
    setLoading(false);
  };

  // === DATI AZIENDA ===
  const loadDatiAzienda = async () => {
    try {
      const { data, error } = await supabase
        .from('parametri_azienda')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Errore caricamento dati azienda:', error);
        // Se la tabella non è accessibile, usa valori di default
        setDatiAzienda({
          denominazione: '',
          indirizzo: '',
          citta: '',
          cap: '',
          nazione: 'Italia',
          partita_iva: '',
          codice_fiscale: '',
          codice_ape: ''
        });
        return;
      }

      if (data && data.length > 0) {
        setDatiAzienda(data[0]);
      } else {
        // Se non ci sono dati, usa valori di default
        setDatiAzienda({
          denominazione: '',
          indirizzo: '',
          citta: '',
          cap: '',
          nazione: 'Italia',
          partita_iva: '',
          codice_fiscale: '',
          codice_ape: ''
        });
      }
    } catch (error) {
      console.error('Errore:', error);
      // Fallback ai valori di default
      setDatiAzienda({
        denominazione: '',
        indirizzo: '',
        citta: '',
        cap: '',
        nazione: 'Italia',
        partita_iva: '',
        codice_fiscale: '',
        codice_ape: ''
      });
    }
  };

  const saveDatiAzienda = async () => {
    try {
      const dataToSave = { ...datiAzienda };

      if (datiAzienda.id) {
        const { error } = await supabase
          .from('parametri_azienda')
          .update(dataToSave)
          .eq('id', datiAzienda.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('parametri_azienda')
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        setDatiAzienda(data);
      }

      setEditingAzienda(false);
      toast.success('Dati azienda salvati con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio dei dati azienda');
    }
  };

  // === PARAMETRI FATTURAZIONE ===
  const loadParametriFatturazione = async () => {
    try {
      const { data, error } = await supabase
        .from('parametri_fatturazione')
        .select('*')
        .eq('user_id', user?.id)
        .order('anno', { ascending: false });

      if (error) throw error;
      setParametriFatturazione(data || []);
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const saveParametroFatturazione = async () => {
    try {
      if (editingParametro) {
        const { error } = await supabase
          .from('parametri_fatturazione')
          .update(formParametri)
          .eq('id', editingParametro.id);

        if (error) throw error;
        toast.success('Parametro modificato con successo');
      } else {
        const { error } = await supabase
          .from('parametri_fatturazione')
          .insert([{ ...formParametri, user_id: user?.id }]);

        if (error) throw error;
        toast.success('Parametro aggiunto con successo');
      }

      setShowModalParametri(false);
      setEditingParametro(null);
      setFormParametri({ anno: new Date().getFullYear(), percentuale: 22 });
      loadParametriFatturazione();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio del parametro');
    }
  };

  const deleteParametroFatturazione = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo parametro?')) return;

    try {
      const { error } = await supabase
        .from('parametri_fatturazione')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadParametriFatturazione();
      toast.success('Parametro eliminato con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione del parametro');
    }
  };

  // === TIPI INCARICO ===
  const loadTipiIncarico = async () => {
    try {
      const { data, error } = await supabase
        .from('tipi_incarico')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Errore caricamento tipi incarico:', error);
        setTipiIncarico([]);
        return;
      }
      
      setTipiIncarico(data || []);
    } catch (error) {
      console.error('Errore:', error);
      setTipiIncarico([]);
    }
  };

  const saveTipoIncarico = async () => {
    try {
      if (editingTipo) {
        const { error } = await supabase
          .from('tipi_incarico')
          .update(formTipi)
          .eq('id', editingTipo.id);

        if (error) throw error;
        toast.success('Tipo incarico modificato con successo');
      } else {
        const { error } = await supabase
          .from('tipi_incarico')
          .insert([formTipi]);

        if (error) throw error;
        toast.success('Tipo incarico aggiunto con successo');
      }

      setShowModalTipi(false);
      setEditingTipo(null);
      setFormTipi({ descrizione: '', comune: false, catasto: false, ape: false });
      loadTipiIncarico();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio del tipo incarico');
    }
  };

  const deleteTipoIncarico = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo tipo di incarico?')) return;

    try {
      const { error } = await supabase
        .from('tipi_incarico')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadTipiIncarico();
      toast.success('Tipo incarico eliminato con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione del tipo incarico');
    }
  };

  // === CATEGORIE PLANNER ===
  const loadCategoriePlanner = async () => {
    try {
      const { data, error } = await supabase
        .from('planner_categories')
        .select('*')
        .eq('user_id', user?.id)
        .order('order_position', { ascending: true });

      if (error) {
        console.error('Errore caricamento categorie planner:', error);
        setCategoriePlanner([]);
        return;
      }
      
      setCategoriePlanner(data || []);
    } catch (error) {
      console.error('Errore:', error);
      setCategoriePlanner([]);
    }
  };

  const saveCategoriaPlanner = async () => {
    try {
      // Validazione dei dati
      if (!formCategorie.slug.trim()) {
        toast.error('Lo slug è obbligatorio');
        return;
      }

      // Validazione formato slug
      const slugPattern = /^[a-z0-9-_]+$/;
      const cleanSlug = formCategorie.slug.trim().toLowerCase();
      if (!slugPattern.test(cleanSlug)) {
        toast.error('Lo slug può contenere solo lettere minuscole, numeri, trattini e underscore');
        return;
      }
      
      if (!formCategorie.name.trim()) {
        toast.error('Il nome è obbligatorio');
        return;
      }

      // Verifica che lo slug sia unico (solo per nuove categorie o se lo slug è cambiato)
      if (!editingCategoria || (editingCategoria && editingCategoria.slug !== formCategorie.slug)) {
        try {
          const { data: existingCategories, error } = await supabase
            .from('planner_categories')
            .select('id')
            .eq('user_id', user?.id)
            .eq('slug', formCategorie.slug.trim().toLowerCase());

          // Se c'è un errore di accesso, procedi comunque (potrebbe essere un problema di policy)
          if (error && error.code !== 'PGRST116') {
            console.warn('Impossibile verificare unicità slug:', error);
          } else if (existingCategories && existingCategories.length > 0) {
            toast.error('Esiste già una categoria con questo slug');
            return;
          }
        } catch (slugError) {
          console.warn('Errore verifica slug:', slugError);
          // Procedi comunque, il database gestirà l'unicità con il constraint
        }
      }

      const categoryData = {
        ...formCategorie,
        slug: formCategorie.slug.trim().toLowerCase(),
        name: formCategorie.name.trim()
      };

      if (editingCategoria) {
        const { error } = await supabase
          .from('planner_categories')
          .update(categoryData)
          .eq('id', editingCategoria.id);

        if (error) throw error;
        toast.success('Categoria modificata con successo');
      } else {
        const { error } = await supabase
          .from('planner_categories')
          .insert([{ ...categoryData, user_id: user?.id }]);

        if (error) throw error;
        toast.success('Categoria aggiunta con successo');
      }

      setShowModalCategorie(false);
      setEditingCategoria(null);
      setFormCategorie({ slug: '', name: '', color: '#3b82f6', order_position: getNextOrderPosition(), active: true });
      loadCategoriePlanner();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio della categoria');
    }
  };

  const deleteCategoriaPlanner = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa categoria?')) return;

    try {
      const { error } = await supabase
        .from('planner_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadCategoriePlanner();
      toast.success('Categoria eliminata con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione della categoria');
    }
  };

  // === STATI APE ===
  const loadStatiApe = async () => {
    try {
      const { data, error } = await supabase
        .from('stati_ape')
        .select('*')
        .order('id');

      if (error) throw error;
      setStatiApe(data || []);
    } catch (error) {
      console.error('Errore caricamento stati APE:', error);
      toast.error('Errore nel caricamento degli stati APE');
    }
  };

  const saveStatoApe = async () => {
    if (!formStatiApe.descrizione.trim()) {
      toast.error('La descrizione è obbligatoria');
      return;
    }

    try {
      const dataToSave = {
        descrizione: formStatiApe.descrizione.trim(),
        colore: formStatiApe.colore
      };

      if (editingStatoApe) {
        const { error } = await supabase
          .from('stati_ape')
          .update(dataToSave)
          .eq('id', editingStatoApe.id);

        if (error) throw error;
        toast.success('Stato APE modificato con successo');
      } else {
        const { error } = await supabase
          .from('stati_ape')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Stato APE creato con successo');
      }

      setShowModalStatiApe(false);
      setEditingStatoApe(null);
      setFormStatiApe({ descrizione: '', colore: '#10b981' });
      loadStatiApe();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio dello stato APE');
    }
  };

  const deleteStatoApe = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo stato APE?')) return;

    try {
      const { error } = await supabase
        .from('stati_ape')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadStatiApe();
      toast.success('Stato APE eliminato con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione dello stato APE');
    }
  };

  // === STATI GENERALI ===
  const loadStatiGenerali = async () => {
    try {
      const { data, error } = await supabase
        .from('stati_generali')
        .select('*')
        .order('id');

      if (error) throw error;
      setStatiGenerali(data || []);
    } catch (error) {
      console.error('Errore caricamento stati generali:', error);
      toast.error('Errore nel caricamento degli stati generali');
    }
  };

  const saveStatoGenerale = async () => {
    if (!formStatiGenerali.descrizione.trim()) {
      toast.error('La descrizione è obbligatoria');
      return;
    }

    try {
      const dataToSave = {
        descrizione: formStatiGenerali.descrizione.trim(),
        colore: formStatiGenerali.colore
      };

      if (editingStatoGenerale) {
        const { error } = await supabase
          .from('stati_generali')
          .update(dataToSave)
          .eq('id', editingStatoGenerale.id);

        if (error) throw error;
        toast.success('Stato generale modificato con successo');
      } else {
        const { error } = await supabase
          .from('stati_generali')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Stato generale creato con successo');
      }

      setShowModalStatiGenerali(false);
      setEditingStatoGenerale(null);
      setFormStatiGenerali({ descrizione: '', colore: '#6366f1' });
      loadStatiGenerali();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio dello stato generale');
    }
  };

  const deleteStatoGenerale = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo stato generale?')) return;

    try {
      const { error } = await supabase
        .from('stati_generali')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadStatiGenerali();
      toast.success('Stato generale eliminato con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione dello stato generale');
    }
  };

  // === STATI SCADENZE ===
  const loadStatiScadenze = async () => {
    try {
      const { data, error } = await supabase
        .from('stati_scadenze')
        .select('*')
        .order('id');

      if (error) throw error;
      setStatiScadenze(data || []);
    } catch (error) {
      console.error('Errore caricamento stati scadenze:', error);
      toast.error('Errore nel caricamento degli stati scadenze');
    }
  };

  const saveStatoScadenza = async () => {
    if (!formStatiScadenze.descrizione.trim()) {
      toast.error('La descrizione è obbligatoria');
      return;
    }

    try {
      const dataToSave = {
        descrizione: formStatiScadenze.descrizione.trim(),
        colore: formStatiScadenze.colore
      };

      if (editingStatoScadenza) {
        const { error } = await supabase
          .from('stati_scadenze')
          .update(dataToSave)
          .eq('id', editingStatoScadenza.id);

        if (error) throw error;
        toast.success('Stato scadenza modificato con successo');
      } else {
        const { error } = await supabase
          .from('stati_scadenze')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Stato scadenza creato con successo');
      }

      setShowModalStatiScadenze(false);
      setEditingStatoScadenza(null);
      setFormStatiScadenze({ descrizione: '', colore: '#f43f5e' });
      loadStatiScadenze();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio dello stato scadenza');
    }
  };

  const deleteStatoScadenza = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo stato scadenza?')) return;

    try {
      const { error } = await supabase
        .from('stati_scadenze')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadStatiScadenze();
      toast.success('Stato scadenza eliminato con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione dello stato scadenza');
    }
  };

  // === TIPI PRATICA ===
  const loadTipiPratica = async () => {
    try {
      const { data, error } = await supabase
        .from('tipi_pratica')
        .select('*')
        .order('id');

      if (error) {
        console.error('Errore caricamento tipi pratica:', error);
        setTipiPratica([]);
        return;
      }

      setTipiPratica(data || []);
    } catch (error) {
      console.error('Errore:', error);
      setTipiPratica([]);
    }
  };

  const saveTipoPratica = async () => {
    if (!formTipiPratica.descrizione.trim()) {
      toast.error('La descrizione è obbligatoria');
      return;
    }

    try {
      const dataToSave = {
        descrizione: formTipiPratica.descrizione.trim()
      };

      if (editingTipoPratica) {
        const { error } = await supabase
          .from('tipi_pratica')
          .update(dataToSave)
          .eq('id', editingTipoPratica.id);

        if (error) throw error;
        toast.success('Tipo pratica modificato con successo');
      } else {
        const { error } = await supabase
          .from('tipi_pratica')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Tipo pratica creato con successo');
      }

      setShowModalTipiPratica(false);
      setEditingTipoPratica(null);
      setFormTipiPratica({ descrizione: '' });
      loadTipiPratica();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio del tipo pratica');
    }
  };

  const deleteTipoPratica = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo tipo di pratica?')) return;

    try {
      const { error } = await supabase
        .from('tipi_pratica')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadTipiPratica();
      toast.success('Tipo pratica eliminato con successo');
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione del tipo pratica');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parametri</h1>
        <p className="text-gray-600 dark:text-gray-300">Gestione configurazioni e impostazioni</p>
      </div>

      {/* Dati Azienda */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dati Azienda</h2>
          </div>
          <button
            onClick={() => setEditingAzienda(!editingAzienda)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            {editingAzienda ? 'Annulla' : 'Modifica'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Denominazione
            </label>
            <input
              type="text"
              value={datiAzienda.denominazione}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, denominazione: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Nome azienda"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Indirizzo
            </label>
            <input
              type="text"
              value={datiAzienda.indirizzo}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, indirizzo: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Indirizzo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Città
            </label>
            <input
              type="text"
              value={datiAzienda.citta}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, citta: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Città"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              CAP
            </label>
            <input
              type="text"
              value={datiAzienda.cap}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, cap: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="CAP"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nazione
            </label>
            <input
              type="text"
              value={datiAzienda.nazione}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, nazione: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Nazione"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Partita IVA
            </label>
            <input
              type="text"
              value={datiAzienda.partita_iva}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, partita_iva: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Partita IVA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Codice Fiscale
            </label>
            <input
              type="text"
              value={datiAzienda.codice_fiscale}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, codice_fiscale: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Codice Fiscale"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Codice APE
            </label>
            <input
              type="text"
              value={datiAzienda.codice_ape}
              onChange={(e) => setDatiAzienda(prev => ({ ...prev, codice_ape: e.target.value }))}
              disabled={!editingAzienda}
              className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              placeholder="Codice APE"
            />
          </div>
        </div>

        {editingAzienda && (
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setEditingAzienda(false)}
              className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Annulla
            </button>
            <button
              onClick={saveDatiAzienda}
              className="btn btn-primary"
            >
              Salva
            </button>
          </div>
        )}
      </div>

      {/* Parametri Fatturazione */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calculator className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Parametri Fatturazione</h2>
          </div>
          <button
            onClick={() => setShowModalParametri(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Aggiungi
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Anno</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Percentuale Tasse (%)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {parametriFatturazione.map((param) => (
                <tr key={param.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{param.anno}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{param.percentuale.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingParametro(param);
                          setFormParametri({
                            anno: param.anno,
                            percentuale: param.percentuale
                          });
                          setShowModalParametri(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteParametroFatturazione(param.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
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
      </div>

      {/* Tipi di Incarico */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tipi di Incarico</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gestione tipi di incarico per le pratiche</p>
            </div>
          </div>
          <button
            onClick={() => setShowModalTipi(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuovo Tipo Incarico
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Descrizione</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Comune</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Catasto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">APE</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data creazione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ultima modifica</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {tipiIncarico.map((tipo) => (
                <tr key={tipo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{tipo.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{tipo.descrizione}</td>
                  <td className="px-4 py-3 text-center">
                    {tipo.comune ? <Check className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" /> : <X className="w-4 h-4 text-gray-400 dark:text-gray-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tipo.catasto ? <Check className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" /> : <X className="w-4 h-4 text-gray-400 dark:text-gray-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tipo.ape ? <Check className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" /> : <X className="w-4 h-4 text-gray-400 dark:text-gray-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(tipo.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(tipo.updated_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTipo(tipo);
                          setFormTipi({
                            descrizione: tipo.descrizione,
                            comune: tipo.comune,
                            catasto: tipo.catasto,
                            ape: tipo.ape
                          });
                          setShowModalTipi(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTipoIncarico(tipo.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
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
      </div>

      {/* Tipi di Pratica */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tipi di Pratica</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gestione tipi di pratica per Comune e Catasto</p>
            </div>
          </div>
          <button
            onClick={() => setShowModalTipiPratica(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuovo Tipo Pratica
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Descrizione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data creazione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ultima modifica</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {tipiPratica.map((tipo) => (
                <tr key={tipo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{tipo.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{tipo.descrizione}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(tipo.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(tipo.updated_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTipoPratica(tipo);
                          setFormTipiPratica({ descrizione: tipo.descrizione });
                          setShowModalTipiPratica(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTipoPratica(tipo.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
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
      </div>

      {/* Gestione Categorie Planner */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gestione Categorie</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gestisci le categorie del planner</p>
            </div>
          </div>
          <button
            onClick={() => {
              setFormCategorie({ slug: '', name: '', color: '#3b82f6', order_position: getNextOrderPosition(), active: true });
              setShowModalCategorie(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuova Categoria
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Colore</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Posizione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stato</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {categoriePlanner.map((categoria) => (
                <tr key={categoria.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{categoria.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{categoria.slug}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{categoria.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: categoria.color }}
                      ></div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{categoria.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{categoria.order_position}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                      categoria.active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                    }`}>
                      {categoria.active ? 'Attiva' : 'Inattiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCategoria(categoria);
                          setFormCategorie({
                            slug: categoria.slug,
                            name: categoria.name,
                            color: categoria.color,
                            order_position: categoria.order_position,
                            active: categoria.active
                          });
                          setShowModalCategorie(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCategoriaPlanner(categoria.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
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
      </div>

      {/* Stati APE */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stati APE</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gestione stati per le pratiche APE</p>
            </div>
          </div>
          <button
            onClick={() => setShowModalStatiApe(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuovo Stato APE
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Descrizione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Colore</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data creazione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ultima modifica</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {statiApe.map((stato) => (
                <tr key={stato.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{stato.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{stato.descrizione}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: stato.colore }}
                      ></div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{stato.colore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(stato.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(stato.updated_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingStatoApe(stato);
                          setFormStatiApe({ descrizione: stato.descrizione, colore: stato.colore });
                          setShowModalStatiApe(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteStatoApe(stato.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
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
      </div>

      {/* Stati Generali */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stati Generali</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gestione stati generali del sistema</p>
            </div>
          </div>
          <button
            onClick={() => setShowModalStatiGenerali(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuovo Stato Generale
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Descrizione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Colore</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data creazione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ultima modifica</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {statiGenerali.map((stato) => (
                <tr key={stato.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{stato.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{stato.descrizione}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: stato.colore }}
                      ></div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{stato.colore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(stato.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(stato.updated_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingStatoGenerale(stato);
                          setFormStatiGenerali({ descrizione: stato.descrizione, colore: stato.colore });
                          setShowModalStatiGenerali(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteStatoGenerale(stato.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
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
      </div>

      {/* Stati Spese */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stati Spese</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gestione stati per le scadenze delle spese</p>
            </div>
          </div>
          <button
            onClick={() => setShowModalStatiScadenze(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuovo Stato Spesa
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Descrizione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Colore</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data creazione</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ultima modifica</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {statiScadenze.map((stato) => (
                <tr key={stato.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{stato.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{stato.descrizione}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: stato.colore }}
                      ></div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{stato.colore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(stato.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {new Date(stato.updated_at).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingStatoScadenza(stato);
                          setFormStatiScadenze({ descrizione: stato.descrizione, colore: stato.colore });
                          setShowModalStatiScadenze(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteStatoScadenza(stato.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
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
      </div>

      {/* Modal Parametri Fatturazione */}
      {showModalParametri && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingParametro ? 'Modifica Parametro' : 'Nuovo Parametro'}
              </h3>
              <button
                onClick={() => {
                  setShowModalParametri(false);
                  setEditingParametro(null);
                  setFormParametri({ anno: new Date().getFullYear(), percentuale: 22 });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anno</label>
                <input
                  type="number"
                  value={formParametri.anno}
                  onChange={(e) => setFormParametri(prev => ({ ...prev, anno: parseInt(e.target.value) }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Percentuale (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formParametri.percentuale}
                  onChange={(e) => setFormParametri(prev => ({ ...prev, percentuale: parseFloat(e.target.value) }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModalParametri(false);
                  setEditingParametro(null);
                  setFormParametri({ anno: new Date().getFullYear(), percentuale: 22 });
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={saveParametroFatturazione}
                className="btn btn-primary"
              >
                {editingParametro ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tipi Incarico */}
      {showModalTipi && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingTipo ? 'Modifica Tipo Incarico' : 'Nuovo Tipo Incarico'}
              </h3>
              <button
                onClick={() => {
                  setShowModalTipi(false);
                  setEditingTipo(null);
                  setFormTipi({ descrizione: '', comune: false, catasto: false, ape: false });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formTipi.descrizione}
                  onChange={(e) => setFormTipi(prev => ({ ...prev, descrizione: e.target.value }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Descrizione tipo incarico"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formTipi.comune}
                    onChange={(e) => setFormTipi(prev => ({ ...prev, comune: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Comune</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formTipi.catasto}
                    onChange={(e) => setFormTipi(prev => ({ ...prev, catasto: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Catasto</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formTipi.ape}
                    onChange={(e) => setFormTipi(prev => ({ ...prev, ape: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">APE</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModalTipi(false);
                  setEditingTipo(null);
                  setFormTipi({ descrizione: '', comune: false, catasto: false, ape: false });
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={saveTipoIncarico}
                className="btn btn-primary"
              >
                {editingTipo ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Categorie Planner */}
      {showModalCategorie && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingCategoria ? 'Modifica Categoria' : 'Nuova Categoria'}
              </h3>
              <button
                onClick={() => {
                  setShowModalCategorie(false);
                  setEditingCategoria(null);
                  setFormCategorie({ slug: '', name: '', color: '#3b82f6', order_position: getNextOrderPosition(), active: true });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formCategorie.slug}
                    onChange={(e) => {
                      // Normalizza lo slug in tempo reale
                      const normalizedSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                      setFormCategorie(prev => ({ ...prev, slug: normalizedSlug }));
                    }}
                    className="input flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    placeholder="slug-categoria"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (formCategorie.name.trim()) {
                        const generatedSlug = generateSlugFromName(formCategorie.name);
                        setFormCategorie(prev => ({ ...prev, slug: generatedSlug }));
                      }
                    }}
                    className="btn btn-outline px-3 py-2 text-sm dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    title="Genera slug dal nome"
                  >
                    Auto
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Solo lettere minuscole, numeri, trattini e underscore
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                <input
                  type="text"
                  value={formCategorie.name}
                  onChange={(e) => setFormCategorie(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Nome categoria"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colore</label>
                <input
                  type="color"
                  value={formCategorie.color}
                  onChange={(e) => setFormCategorie(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Posizione</label>
                <input
                  type="number"
                  value={formCategorie.order_position}
                  onChange={(e) => setFormCategorie(prev => ({ ...prev, order_position: parseInt(e.target.value) }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formCategorie.active}
                    onChange={(e) => setFormCategorie(prev => ({ ...prev, active: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Attiva</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModalCategorie(false);
                  setEditingCategoria(null);
                  setFormCategorie({ slug: '', name: '', color: '#3b82f6', order_position: getNextOrderPosition(), active: true });
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={saveCategoriaPlanner}
                className="btn btn-primary"
              >
                {editingCategoria ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Stati APE */}
      {showModalStatiApe && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingStatoApe ? 'Modifica Stato APE' : 'Nuovo Stato APE'}
              </h3>
              <button
                onClick={() => {
                  setShowModalStatiApe(false);
                  setEditingStatoApe(null);
                  setFormStatiApe({ descrizione: '', colore: '#10b981' });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formStatiApe.descrizione}
                  onChange={(e) => setFormStatiApe(prev => ({ ...prev, descrizione: e.target.value }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Descrizione stato APE"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colore</label>
                <input
                  type="color"
                  value={formStatiApe.colore}
                  onChange={(e) => setFormStatiApe(prev => ({ ...prev, colore: e.target.value }))}
                  className="w-full h-10 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModalStatiApe(false);
                  setEditingStatoApe(null);
                  setFormStatiApe({ descrizione: '', colore: '#10b981' });
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={saveStatoApe}
                className="btn btn-primary"
              >
                {editingStatoApe ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Stati Generali */}
      {showModalStatiGenerali && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingStatoGenerale ? 'Modifica Stato Generale' : 'Nuovo Stato Generale'}
              </h3>
              <button
                onClick={() => {
                  setShowModalStatiGenerali(false);
                  setEditingStatoGenerale(null);
                  setFormStatiGenerali({ descrizione: '', colore: '#6366f1' });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formStatiGenerali.descrizione}
                  onChange={(e) => setFormStatiGenerali(prev => ({ ...prev, descrizione: e.target.value }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Descrizione stato generale"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colore</label>
                <input
                  type="color"
                  value={formStatiGenerali.colore}
                  onChange={(e) => setFormStatiGenerali(prev => ({ ...prev, colore: e.target.value }))}
                  className="w-full h-10 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModalStatiGenerali(false);
                  setEditingStatoGenerale(null);
                  setFormStatiGenerali({ descrizione: '', colore: '#6366f1' });
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={saveStatoGenerale}
                className="btn btn-primary"
              >
                {editingStatoGenerale ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Stati Scadenze */}
      {showModalStatiScadenze && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingStatoScadenza ? 'Modifica Stato Spesa' : 'Nuovo Stato Spesa'}
              </h3>
              <button
                onClick={() => {
                  setShowModalStatiScadenze(false);
                  setEditingStatoScadenza(null);
                  setFormStatiScadenze({ descrizione: '', colore: '#f43f5e' });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formStatiScadenze.descrizione}
                  onChange={(e) => setFormStatiScadenze(prev => ({ ...prev, descrizione: e.target.value }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Descrizione stato spesa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colore</label>
                <input
                  type="color"
                  value={formStatiScadenze.colore}
                  onChange={(e) => setFormStatiScadenze(prev => ({ ...prev, colore: e.target.value }))}
                  className="w-full h-10 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModalStatiScadenze(false);
                  setEditingStatoScadenza(null);
                  setFormStatiScadenze({ descrizione: '', colore: '#f43f5e' });
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={saveStatoScadenza}
                className="btn btn-primary"
              >
                {editingStatoScadenza ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tipi Pratica */}
      {showModalTipiPratica && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingTipoPratica ? 'Modifica Tipo Pratica' : 'Nuovo Tipo Pratica'}
              </h3>
              <button
                onClick={() => {
                  setShowModalTipiPratica(false);
                  setEditingTipoPratica(null);
                  setFormTipiPratica({ descrizione: '' });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formTipiPratica.descrizione}
                  onChange={(e) => setFormTipiPratica(prev => ({ ...prev, descrizione: e.target.value }))}
                  className="input w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Descrizione tipo pratica"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModalTipiPratica(false);
                  setEditingTipoPratica(null);
                  setFormTipiPratica({ descrizione: '' });
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Annulla
              </button>
              <button
                onClick={saveTipoPratica}
                className="btn btn-primary"
              >
                {editingTipoPratica ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Parametri;