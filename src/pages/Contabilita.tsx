import React, { useState, useEffect } from 'react';
import { Plus, Filter, RotateCcw, Edit, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { Fattura } from '../types';
import toast from 'react-hot-toast';

export const Contabilita: React.FC = () => {
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMese, setFiltroMese] = useState('');
  const [filtroAnno, setFiltroAnno] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    const saved = localStorage.getItem('contabilita_records_per_page');
    return saved ? parseInt(saved) : 10;
  });
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Totalizzatori
  const [totals, setTotals] = useState({
    onorario: 0,
    spese: 0,
    bolli: 0,
    cassaGeometri: 0,
    tasse: 0,
    fatturato: 0,
    guadagnoNetto: 0
  });
  
  const { user } = useAuthStore();

  // Form state per nuova fattura
  const [formData, setFormData] = useState({
    mese: 'Gennaio',
    anno: new Date().getFullYear(),
    numeroFattura: '',
    onorario: '',
    spese: '',
    bolli: 2.00,
    cassaGeometri: 0,
    tasse: 0,
    fatturato: 0,
    guadagnoNetto: 0
  });
  const [parametroTasse, setParametroTasse] = useState<number>(0.22); // Default 22%

  // Lista dei mesi
  const mesi = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // Genera lista anni dal database (solo anni con fatture)
  const [anni, setAnni] = useState<number[]>([]);
  const currentYear = new Date().getFullYear();

  // Opzioni records per pagina
  const recordsPerPageOptions = [5, 10, 25, 50, 100];

  const fetchAnniDisponibili = async () => {
    try {
      const { data, error } = await supabase
        .from('fatture')
        .select('anno_fattura')
        .eq('user_id', user?.id)
        .not('anno_fattura', 'is', null);

      if (error) {
        console.error('Errore nel caricamento anni:', error);
        return;
      }

      // Estrae gli anni unici e li ordina in decrescente
      const anniUnici = [...new Set(data?.map(f => f.anno_fattura).filter(Boolean))] as number[];
      anniUnici.sort((a, b) => b - a);
      setAnni(anniUnici);
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const fetchFatture = async () => {
    try {
      setLoading(true);
      
      // Query per contare i record totali
      let countQuery = supabase
        .from('fatture')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Query per i dati - senza range, ordinamento fatto in JS
      let dataQuery = supabase
        .from('fatture')
        .select('*')
        .eq('user_id', user?.id);

      // Applica filtri
      if (filtroMese) {
        countQuery = countQuery.eq('mese_fattura', filtroMese);
        dataQuery = dataQuery.eq('mese_fattura', filtroMese);
      }

      if (filtroAnno) {
        countQuery = countQuery.eq('anno_fattura', parseInt(filtroAnno));
        dataQuery = dataQuery.eq('anno_fattura', parseInt(filtroAnno));
      }

      // Esegui le query
      const [{ count }, { data, error }] = await Promise.all([
        countQuery,
        dataQuery
      ]);

      if (error) {
        console.error('Errore nel caricamento fatture:', error);
        toast.error('Errore nel caricamento delle fatture');
        return;
      }

      // Ordina per anno desc, poi per numero_fattura desc (numericamente)
      const sortedData = (data || []).sort((a, b) => {
        const annoDiff = (b.anno_fattura || 0) - (a.anno_fattura || 0);
        if (annoDiff !== 0) return annoDiff;
        
        const numA = parseInt(a.numero_fattura) || 0;
        const numB = parseInt(b.numero_fattura) || 0;
        return numB - numA;
      });

      // Applica paginazione in JavaScript
      const start = (currentPage - 1) * recordsPerPage;
      const end = start + recordsPerPage;
      const paginatedData = sortedData.slice(start, end);

      setFatture(paginatedData);
      setTotalRecords(count || 0);
      
      // Calcola i totali (su tutti i dati filtrati, non solo la pagina corrente)
      const totaleOnorario = sortedData.reduce((sum, fattura) => sum + (fattura.onorario || 0), 0);
      const totaleSpese = sortedData.reduce((sum, fattura) => sum + (fattura.spese || 0), 0);
      const totaleBolli = sortedData.reduce((sum, fattura) => sum + fattura.bolli, 0);
      const totaleCassaGeometri = sortedData.reduce((sum, fattura) => sum + fattura.cassa_geometri, 0);
      const totaleTasse = sortedData.reduce((sum, fattura) => sum + fattura.tasse, 0);
      const totaleFatturato = sortedData.reduce((sum, fattura) => sum + fattura.fatturato, 0);
      const totaleGuadagnoNetto = sortedData.reduce((sum, fattura) => sum + fattura.guadagno_netto, 0);
      
      setTotals({
        onorario: totaleOnorario,
        spese: totaleSpese,
        bolli: totaleBolli,
        cassaGeometri: totaleCassaGeometri,
        tasse: totaleTasse,
        fatturato: totaleFatturato,
        guadagnoNetto: totaleGuadagnoNetto
      });

    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const loadParametriTasse = async () => {
    try {
      const { data, error } = await supabase
        .from('parametri_fatturazione')
        .select('*')
        .eq('user_id', user?.id)
        .eq('anno', formData.anno)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Errore caricamento parametri:', error);
        return;
      }

      if (data) {
        setParametroTasse(data.percentuale / 100); // Converte da percentuale a decimale
      } else {
        setParametroTasse(0.22); // Default 22% se non esistono parametri
      }
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const ensureParametriTasse = async (): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('parametri_fatturazione')
        .select('*')
        .eq('user_id', user?.id)
        .eq('anno', formData.anno)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Errore caricamento parametri:', error);
        return 0.22; // Default in caso di errore
      }

      if (data) {
        return data.percentuale / 100; // Converte da percentuale a decimale
      } else {
        // Crea i parametri solo quando si salva la fattura
        const { error: insertError } = await supabase
          .from('parametri_fatturazione')
          .insert({
            user_id: user?.id,
            anno: formData.anno,
            percentuale: 22.00
          });

        if (insertError) {
          console.error('Errore nella creazione dei parametri:', insertError);
          return 0.22; // Default in caso di errore
        }

        toast.success(`Parametri tasse creati per l'anno ${formData.anno} (22%)`);
        return 0.22; // 22% default
      }
    } catch (error) {
      console.error('Errore:', error);
      return 0.22; // Default in caso di errore
    }
  };

  const getNextNumeroFattura = async (anno: number) => {
    try {
      console.log('[DEBUG FATTURA] Cerco ultimo numero per anno:', anno, '| user_id:', user?.id);
      
      // Prendi tutti i numeri fattura per l'anno (numero_fattura è varchar, ordine alfabetico non funziona)
      const { data, error } = await supabase
        .from('fatture')
        .select('numero_fattura')
        .eq('user_id', user?.id)
        .eq('anno_fattura', anno);

      if (error) {
        console.error('[DEBUG FATTURA] Errore nel recupero ultimo numero fattura:', error);
        return 1;
      }

      console.log('[DEBUG FATTURA] Risultato query:', data);

      if (data && data.length > 0) {
        // Converte tutti i numeri e trova il massimo
        const numeri = data
          .map(f => parseInt(f.numero_fattura))
          .filter(n => !isNaN(n));
        
        console.log('[DEBUG FATTURA] Numeri trovati:', numeri);

        if (numeri.length > 0) {
          const ultimoNumero = Math.max(...numeri);
          const prossimoNumero = ultimoNumero + 1;
          console.log('[DEBUG FATTURA] Ultimo numero trovato:', ultimoNumero, '| Prossimo numero:', prossimoNumero);
          return prossimoNumero;
        }
      }

      console.log('[DEBUG FATTURA] Nessuna fattura trovata per anno', anno, '| Parto da 1');
      return 1;
    } catch (error) {
      console.error('[DEBUG FATTURA] Errore:', error);
      return 1;
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAnniDisponibili();
      fetchFatture();
    }
  }, [user?.id, currentPage, recordsPerPage]);

  // Ricalcola i valori quando cambiano i parametri delle tasse
  useEffect(() => {
    if (formData.onorario || formData.spese) {
      const calculatedValues = calculateValues(formData.onorario, formData.spese);
      setFormData(prev => ({ ...prev, ...calculatedValues }));
    }
  }, [parametroTasse]);

  const handleFilter = () => {
    setCurrentPage(1); // Reset alla prima pagina quando si filtra
    fetchFatture();
  };

  const handleReset = () => {
    setFiltroMese('');
    setFiltroAnno('');
    setCurrentPage(1);
  };

  const handleRecordsPerPageChange = (newValue: number) => {
    setRecordsPerPage(newValue);
    setCurrentPage(1);
    localStorage.setItem('contabilita_records_per_page', newValue.toString());
  };

  // Calcoli automatici
  const calculateValues = (onorario: number | string, spese: number | string) => {
    const onorarioNum = parseFloat(onorario as string) || 0;
    const speseNum = parseFloat(spese as string) || 0;
    const bolli = 2.00;
    const cassaGeometri = onorarioNum * 0.05; // 5% dell'onorario
    const tasse = (onorarioNum + bolli) * 0.78 * parametroTasse;
    const fatturato = onorarioNum + speseNum + bolli + cassaGeometri;
    const guadagnoNetto = fatturato - tasse - cassaGeometri - bolli - speseNum;

    return {
      bolli,
      cassaGeometri,
      tasse,
      fatturato,
      guadagnoNetto
    };
  };

  // Calcoli automatici con percentuale specifica
  const calculateValuesWithPercent = (onorario: number | string, spese: number | string, percentuale: number) => {
    const onorarioNum = parseFloat(onorario as string) || 0;
    const speseNum = parseFloat(spese as string) || 0;
    const bolli = 2.00;
    const cassaGeometri = onorarioNum * 0.05; // 5% dell'onorario
    const tasse = (onorarioNum + bolli) * 0.78 * percentuale;
    const fatturato = onorarioNum + speseNum + bolli + cassaGeometri;
    const guadagnoNetto = fatturato - tasse - cassaGeometri - bolli - speseNum;

    return {
      bolli,
      cassaGeometri,
      tasse,
      fatturato,
      guadagnoNetto
    };
  };

  const handleFormChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    
    // Se cambia onorario o spese, ricalcola tutti i valori
    if (field === 'onorario' || field === 'spese') {
      const calculatedValues = calculateValues(
        field === 'onorario' ? value : formData.onorario,
        field === 'spese' ? value : formData.spese
      );
      
      Object.assign(newFormData, calculatedValues);
    }

    // Se cambia l'anno, ricarica i parametri delle tasse
    if (field === 'anno') {
      setTimeout(() => loadParametriTasse(), 0); // Esegui dopo l'aggiornamento dello state
    }

    setFormData(newFormData);
  };

  const openModal = async () => {
    const annoCorrente = new Date().getFullYear();
    setFormData({
      mese: 'Gennaio',
      anno: annoCorrente,
      numeroFattura: '',
      onorario: '',
      spese: '',
      bolli: 2.00,
      cassaGeometri: 0,
      tasse: 0,
      fatturato: 0,
      guadagnoNetto: 0
    });
    setEditingId(null);
    await loadParametriTasse();
    setShowModal(true);
  };

  const handleEditFattura = async (fattura: Fattura) => {
    setFormData({
      mese: fattura.mese_fattura,
      anno: fattura.anno_fattura || new Date().getFullYear(),
      numeroFattura: fattura.numero_fattura || '',
      onorario: fattura.onorario ?? '',
      spese: fattura.spese ?? '',
      bolli: fattura.bolli,
      cassaGeometri: fattura.cassa_geometri,
      tasse: fattura.tasse,
      fatturato: fattura.fatturato,
      guadagnoNetto: fattura.guadagno_netto
    });
    setEditingId(fattura.id);
    await loadParametriTasse();
    setShowModal(true);
  };

  const handleSaveFattura = async () => {
    try {
      setSaving(true);

      // Assicura che i parametri fatturazione esistano per l'anno corrente
      const percentualeTasse = await ensureParametriTasse();
      setParametroTasse(percentualeTasse);

      // Ricalcola i valori con la percentuale aggiornata
      const calculatedValues = calculateValuesWithPercent(formData.onorario, formData.spese, percentualeTasse);
      setFormData(prev => ({ ...prev, ...calculatedValues }));

      // Determina il numero fattura: usa quello inserito dall'utente se presente, altrimenti auto-genera
      const isEditing = !!editingId;
      const userInsertedNumber = formData.numeroFattura ? formData.numeroFattura.toString() : null;
      let numeroFattura: string;

      if (isEditing) {
        numeroFattura = formData.numeroFattura.toString();
        console.log('[DEBUG FATTURA] Modifica - Numero:', numeroFattura, 'Anno:', formData.anno);
      } else if (userInsertedNumber) {
        numeroFattura = userInsertedNumber;
        console.log('[DEBUG FATTURA] Inserimento manuale - Numero:', numeroFattura, 'Anno:', formData.anno);
      } else {
        const autoNumber = await getNextNumeroFattura(formData.anno);
        numeroFattura = autoNumber.toString();
        console.log('[DEBUG FATTURA] Auto-generato - Numero:', numeroFattura, 'Anno:', formData.anno);
      }

      console.log('[DEBUG FATTURA] Numero finale da salvare:', numeroFattura, '| Tipo:', typeof numeroFattura);

      if (editingId) {
        // Update existing fattura
        const { error } = await supabase
          .from('fatture')
          .update({
            numero_fattura: numeroFattura.toString(),
            mese_fattura: formData.mese,
            anno_fattura: formData.anno,
            onorario: formData.onorario ? parseFloat(formData.onorario as string) : null,
            spese: formData.spese ? parseFloat(formData.spese as string) : null,
            bolli: formData.bolli,
            cassa_geometri: formData.cassaGeometri,
            tasse: formData.tasse,
            fatturato: formData.fatturato,
            guadagno_netto: formData.guadagnoNetto,
            data_modifica: new Date().toISOString()
          })
          .eq('id', editingId)
          .eq('user_id', user?.id);

        if (error) {
          console.error('[DEBUG FATTURA] Errore nell\'aggiornamento fattura:', error);
          console.error('[DEBUG FATTURA] Dettagli errore:', JSON.stringify(error, null, 2));
          toast.error('Errore nell\'aggiornamento della fattura');
          return;
        }

        toast.success('Fattura aggiornata con successo!');
      } else {
        // Create new fattura
        const { error } = await supabase
          .from('fatture')
          .insert({
            user_id: user?.id,
            numero_fattura: numeroFattura.toString(),
            mese_fattura: formData.mese,
            anno_fattura: formData.anno,
            onorario: formData.onorario ? parseFloat(formData.onorario as string) : null,
            spese: formData.spese ? parseFloat(formData.spese as string) : null,
            bolli: formData.bolli,
            cassa_geometri: formData.cassaGeometri,
            tasse: formData.tasse,
            fatturato: formData.fatturato,
            guadagno_netto: formData.guadagnoNetto,
            data_creazione: new Date().toISOString(),
            data_modifica: new Date().toISOString()
          });

        if (error) {
          console.error('[DEBUG FATTURA] Errore nel salvataggio fattura:', error);
          console.error('[DEBUG FATTURA] Dettagli errore:', JSON.stringify(error, null, 2));
          console.error('[DEBUG FATTURA] Dati inviati:', {
            numero_fattura: numeroFattura.toString(),
            mese_fattura: formData.mese,
            anno_fattura: formData.anno
          });
          toast.error('Errore nel salvataggio della fattura');
          return;
        }

        toast.success('Fattura salvata con successo!');
      }

      setShowModal(false);
      setEditingId(null);
      fetchAnniDisponibili();
      fetchFatture();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFattura = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa fattura?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('fatture')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della fattura');
        return;
      }

      toast.success('Fattura eliminata con successo');
      fetchAnniDisponibili();
      fetchFatture();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const formatCurrency = (amount: number | null) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fatture</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestione della contabilità e fatturazione</p>
        </div>
        <button
          onClick={openModal}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Fattura
        </button>
      </div>

      {/* Filtri */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          {/* Filtro Mese */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtra per Mese
            </label>
            <select
              value={filtroMese}
              onChange={(e) => setFiltroMese(e.target.value)}
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
            >
              <option value="" className="dark:bg-gray-700 dark:text-white">Tutti i mesi</option>
              {mesi.map((mese) => (
                <option key={mese} value={mese} className="dark:bg-gray-700 dark:text-white">
                  {mese}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Anno */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtra per Anno
            </label>
            <select
              value={filtroAnno}
              onChange={(e) => setFiltroAnno(e.target.value)}
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
            >
              <option value="" className="dark:bg-gray-700 dark:text-white">Tutti gli anni</option>
              {anni.map((anno) => (
                <option key={anno} value={anno} className="dark:bg-gray-700 dark:text-white">
                  {anno}
                </option>
              ))}
            </select>
          </div>

          {/* Records per pagina */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Record per pagina
            </label>
            <select
              value={recordsPerPage}
              onChange={(e) => handleRecordsPerPageChange(parseInt(e.target.value))}
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
            >
              {recordsPerPageOptions.map((option) => (
                <option key={option} value={option} className="dark:bg-gray-700 dark:text-white">
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Pulsanti */}
          <div className="flex gap-2">
            <button
              onClick={handleFilter}
              className="btn btn-primary flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtra
            </button>
            <button
              onClick={handleReset}
              className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Info paginazione */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div>
          Mostrando {fatture.length > 0 ? (currentPage - 1) * recordsPerPage + 1 : 0} - {Math.min(currentPage * recordsPerPage, totalRecords)} di {totalRecords} record
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="btn btn-outline btn-sm disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Pagina {currentPage} di {totalPages}</span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="btn btn-outline btn-sm disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabella Fatture */}
      <div className="card p-0 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Mese
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Anno
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  N° Fattura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Onorario (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Spese (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Bolli (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cassa Geometri (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tasse (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Fatturato (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Guadagno Netto (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Caricamento...</span>
                    </div>
                  </td>
                </tr>
              ) : fatture.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nessuna fattura trovata
                  </td>
                </tr>
              ) : (
                fatture.map((fattura) => (
                  <tr key={fattura.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {fattura.mese_fattura}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {fattura.anno_fattura}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {fattura.numero_fattura}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(fattura.onorario)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(fattura.spese)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(fattura.bolli)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(fattura.cassa_geometri)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(fattura.tasse)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(fattura.fatturato)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(fattura.guadagno_netto)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditFattura(fattura)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          title="Modifica"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFattura(fattura.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
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
            {/* Totalizzatore */}
            {fatture.length > 0 && (
              <tfoot className="bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                    TOTALI
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(totals.onorario)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(totals.spese)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(totals.bolli)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(totals.cassaGeometri)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-red-700 dark:text-red-400">
                    {formatCurrency(totals.tasse)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(totals.fatturato)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(totals.guadagnoNetto)}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Nuova Fattura */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingId ? 'Modifica Fattura' : 'Inserisci Nuova Fattura'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mese */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mese
                  </label>
                  <select
                    value={formData.mese}
                    onChange={(e) => handleFormChange('mese', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {mesi.map((mese) => (
                      <option key={mese} value={mese}>
                        {mese}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Anno */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Anno
                  </label>
                  <input
                    type="number"
                    value={formData.anno}
                    onChange={(e) => handleFormChange('anno', parseInt(e.target.value))}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Inserisci l'anno a 4 cifre</p>
                </div>

                {/* Numero Fattura */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Numero Fattura
                  </label>
                  <input
                    type="text"
                    value={formData.numeroFattura}
                    onChange={(e) => handleFormChange('numeroFattura', e.target.value)}
                    placeholder="Numero generato automaticamente al salvataggio"
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                {/* Onorario */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Onorario (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.onorario}
                    onChange={(e) => handleFormChange('onorario', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="0,00"
                  />
                </div>

                {/* Spese */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Spese (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.spese}
                    onChange={(e) => handleFormChange('spese', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="0,00"
                  />
                </div>

                {/* Bolli */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bolli (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.bolli}
                    className="input bg-gray-50 dark:bg-gray-600 dark:border-gray-600 dark:text-white"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">2,00€ fissi</p>
                </div>

                {/* Cassa Geometri */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cassa Geometri (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cassaGeometri.toFixed(2)}
                    className="input bg-gray-50 dark:bg-gray-600 dark:border-gray-600 dark:text-white"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">5% dell'onorario</p>
                </div>

                {/* Tasse */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tasse (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tasse.toFixed(2)}
                    className="input bg-gray-50 dark:bg-gray-600 dark:border-gray-600 dark:text-white"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    (Onorario + bolli) × 0,78 × {(parametroTasse * 100).toFixed(0)}%
                  </p>
                </div>

                {/* Fatturato */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fatturato (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fatturato.toFixed(2)}
                    className="input bg-green-50 dark:bg-green-900/20 font-semibold text-green-700 dark:text-green-400 dark:border-gray-600"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Onorario + spese + bolli + cassa</p>
                </div>

                {/* Guadagno Netto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Guadagno Netto (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.guadagnoNetto.toFixed(2)}
                    className="input bg-blue-50 dark:bg-blue-900/20 font-semibold text-blue-700 dark:text-blue-400 dark:border-gray-600"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fatturato - tasse - cassa - bolli - spese</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                }}
                className="btn btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                disabled={saving}
              >
                Annulla
              </button>
              <button
                onClick={handleSaveFattura}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvataggio...
                  </>
                ) : (
                  'Salva'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contabilita; 