import React, { useState, useEffect } from 'react';
import { Plus, Filter, RotateCcw, Edit, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { ContextMenu } from '../components/ContextMenu';
import type { Fattura } from '../types';
import toast from 'react-hot-toast';

export const Contabilita: React.FC = () => {
 const [fatture, setFatture] = useState<Fattura[]>([]);
 const [loading, setLoading] = useState(true);
 const [filtroMese, setFiltroMese] = useState('');
 const [filtroAnno, setFiltroAnno] = useState(() => new Date().getFullYear().toString());
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

  // Lista dei mesi
  const mesi = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // Form state per nuova fattura
  const [formData, setFormData] = useState({
  mese: mesi[new Date().getMonth()],
  anno: new Date().getFullYear(),
 numeroFattura: '',
 onorario: '',
 spese: '',
 bolli: 2.00,
 cassaGeometri: 0,
 tasse: 0,
 fatturato: 0,
 guadagnoNetto: 0,
 fatturaPerDetrazione: false
 });
 const [parametroTasse, setParametroTasse] = useState<number>(0.22); // Default 22%
 const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fattura: Fattura | null }>({ x: 0, y: 0, fattura: null });

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

 // Ordina per anno desc, mese desc, numero_fattura desc
 const meseOrder: Record<string, number> = {
 'Gennaio': 1, 'Febbraio': 2, 'Marzo': 3, 'Aprile': 4,
 'Maggio': 5, 'Giugno': 6, 'Luglio': 7, 'Agosto': 8,
 'Settembre': 9, 'Ottobre': 10, 'Novembre': 11, 'Dicembre': 12
 };
 const sortedData = (data || []).sort((a, b) => {
 const annoDiff = (b.anno_fattura || 0) - (a.anno_fattura || 0);
 if (annoDiff !== 0) return annoDiff;
 
 const meseDiff = (meseOrder[b.mese_fattura] || 0) - (meseOrder[a.mese_fattura] || 0);
 if (meseDiff !== 0) return meseDiff;
 
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

 // Chiudi menu contestuale quando si clicca fuori o si preme Escape
 useEffect(() => {
 if (!contextMenu.fattura) return;

 const handleClick = () => setContextMenu({ x: 0, y: 0, fattura: null });
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape') setContextMenu({ x: 0, y: 0, fattura: null });
 };

 document.addEventListener('click', handleClick);
 document.addEventListener('keydown', handleKeyDown);
 return () => {
 document.removeEventListener('click', handleClick);
 document.removeEventListener('keydown', handleKeyDown);
 };
 }, [contextMenu.fattura]);

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
 const cassaGeometri = onorarioNum * 0.05; // 5% dell'onorario
 
 // Bolli: 2€ solo se fatturato > 77,47€
 const fatturatoBase = onorarioNum + speseNum + cassaGeometri;
 const bolli = fatturatoBase > 77.47 ? 2.00 : 0;
 
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
 const cassaGeometri = onorarioNum * 0.05; // 5% dell'onorario
 
 // Bolli: 2€ solo se fatturato > 77,47€
 const fatturatoBase = onorarioNum + speseNum + cassaGeometri;
 const bolli = fatturatoBase > 77.47 ? 2.00 : 0;
 
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
  mese: mesi[new Date().getMonth()],
 anno: annoCorrente,
 numeroFattura: '',
 onorario: '',
 spese: '',
 bolli: 0,
 cassaGeometri: 0,
 tasse: 0,
 fatturato: 0,
 guadagnoNetto: 0,
 fatturaPerDetrazione: false
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
 guadagnoNetto: fattura.guadagno_netto,
 fatturaPerDetrazione: fattura.fattura_per_detrazione ?? false
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
 fattura_per_detrazione: formData.fatturaPerDetrazione,
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
 fattura_per_detrazione: formData.fatturaPerDetrazione,
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

 const handleContextMenu = (e: React.MouseEvent, fattura: Fattura) => {
 e.preventDefault();
 setContextMenu({ x: e.clientX, y: e.clientY, fattura });
 };

 const handleContextMenuAction = (action: 'edit' | 'delete', fattura: Fattura) => {
 setContextMenu({ x: 0, y: 0, fattura: null });
 if (action === 'edit') {
 handleEditFattura(fattura);
 } else if (action === 'delete') {
 handleDeleteFattura(fattura.id);
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
 <div className="flex flex-col gap-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-ink-900">Fatture</h1>
 <p className="text-ink-600">Gestione della contabilità e fatturazione</p>
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
 <div className="card">
 <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
 {/* Filtro Mese */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Filtra per Mese
 </label>
 <select
 value={filtroMese}
 onChange={(e) => setFiltroMese(e.target.value)}
 className="input"
 >
 <option value="" className="">Tutti i mesi</option>
 {mesi.map((mese) => (
 <option key={mese} value={mese} className="">
 {mese}
 </option>
 ))}
 </select>
 </div>

 {/* Filtro Anno */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Filtra per Anno
 </label>
 <select
 value={filtroAnno}
 onChange={(e) => setFiltroAnno(e.target.value)}
 className="input"
 >
 <option value="" className="">Tutti gli anni</option>
 {anni.map((anno) => (
 <option key={anno} value={anno} className="">
 {anno}
 </option>
 ))}
 </select>
 </div>

 {/* Records per pagina */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Record per pagina
 </label>
 <select
 value={recordsPerPage}
 onChange={(e) => handleRecordsPerPageChange(parseInt(e.target.value))}
 className="input"
 >
 {recordsPerPageOptions.map((option) => (
 <option key={option} value={option} className="">
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
 className="btn btn-outline flex items-center gap-2"
 >
 <RotateCcw className="w-4 h-4" />
 Reset
 </button>
 </div>
 </div>
 </div>

 {/* Info paginazione */}
 <div className="flex items-center justify-between text-sm text-ink-600">
 <div>
 Mostrando {fatture.length > 0 ? (currentPage - 1) * recordsPerPage + 1 : 0} - {Math.min(currentPage * recordsPerPage, totalRecords)} di {totalRecords} record
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
 disabled={currentPage === 1}
 className="btn btn-outline btn-sm disabled:opacity-50"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span>Pagina {currentPage} di {totalPages}</span>
 <button
 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
 disabled={currentPage === totalPages}
 className="btn btn-outline btn-sm disabled:opacity-50"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Tabella Fatture */}
 <div className="card p-0 overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-ink-50 border-b border-ink-200">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 Mese
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 Anno
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 N° Fattura
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 Onorario (€)
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 Spese (€)
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 Cassa Geometri (€)
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 Bolli (€)
 </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
            Fatturato (€)
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
            Tasse (€)
          </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
 Guadagno Netto (€)
 </th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-ink-200">
 {loading ? (
 <tr>
 <td colSpan={10} className="px-6 py-8 text-center text-ink-500">
 <div className="flex items-center justify-center">
 <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-signal-500"></div>
 <span className="ml-2">Caricamento...</span>
 </div>
 </td>
 </tr>
 ) : fatture.length === 0 ? (
 <tr>
 <td colSpan={10} className="px-6 py-8 text-center text-ink-500">
 Nessuna fattura trovata
 </td>
 </tr>
 ) : (
 (() => {
 // Calcola totali per ogni mese
 const monthlyTotals: Record<string, { onorario: number; spese: number; cassaGeometri: number; bolli: number; tasse: number; fatturato: number; guadagnoNetto: number; count: number }> = {};
 fatture.forEach(f => {
 const key = `${f.mese_fattura}-${f.anno_fattura}`;
 if (!monthlyTotals[key]) {
 monthlyTotals[key] = { onorario: 0, spese: 0, cassaGeometri: 0, bolli: 0, tasse: 0, fatturato: 0, guadagnoNetto: 0, count: 0 };
 }
 const t = monthlyTotals[key];
 t.onorario += f.onorario || 0;
 t.spese += f.spese || 0;
 t.cassaGeometri += f.cassa_geometri;
 t.bolli += f.bolli;
 t.tasse += f.tasse;
 t.fatturato += f.fatturato;
 t.guadagnoNetto += f.guadagno_netto;
 t.count++;
 });

 // Costruisci le righe con separatori e totali mensili
 const rows: React.ReactNode[] = [];
 fatture.forEach((fattura, index) => {
 const prevFattura = index > 0 ? fatture[index - 1] : null;
 const showSeparator = prevFattura && 
 (prevFattura.mese_fattura !== fattura.mese_fattura || prevFattura.anno_fattura !== fattura.anno_fattura);

 const nextFattura = index < fatture.length - 1 ? fatture[index + 1] : null;
 const isLastInMonth = !nextFattura || 
 nextFattura.mese_fattura !== fattura.mese_fattura || 
 nextFattura.anno_fattura !== fattura.anno_fattura;

 const monthKey = `${fattura.mese_fattura}-${fattura.anno_fattura}`;
 const mTotals = monthlyTotals[monthKey];

 rows.push(
 <React.Fragment key={fattura.id}>
 {showSeparator && (
 <tr className="bg-ink-100">
 <td colSpan={10} className="px-6 py-2">
 <div className="border-t border-ink-300"></div>
 </td>
 </tr>
 )}
 <tr 
 className={`hover:bg-ink-50 ${(index % 2 === 0 ? '' : 'bg-ink-50')}`}
 onContextMenu={(e) => handleContextMenu(e, fattura)}
 >
 <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-900">
 {fattura.mese_fattura}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-900">
 {fattura.anno_fattura}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink-900">
 {fattura.numero_fattura}
 {fattura.fattura_per_detrazione && (
 <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
 Detrazione
 </span>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-900">
 {formatCurrency(fattura.onorario)}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-900">
 {formatCurrency(fattura.spese)}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-900">
 {formatCurrency(fattura.cassa_geometri)}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-900">
{formatCurrency(fattura.bolli)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">
{formatCurrency(fattura.fatturato)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 dark:text-red-400">
{formatCurrency(fattura.tasse)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(fattura.guadagno_netto)}
 </td>
 </tr>
{/* Riga totali mensili */}
          {isLastInMonth && (
             <tr className="bg-ink-100 border-t border-ink-300">
              <td className="px-6 py-3 text-sm font-bold text-ink-900" colSpan={2}>
                Totale {fattura.mese_fattura} {fattura.anno_fattura}
              </td>
              <td className="px-6 py-3 text-xs text-ink-600">
                {mTotals.count} {mTotals.count === 1 ? 'fattura' : 'fatture'}
              </td>
              <td className="px-6 py-3 text-sm font-bold text-ink-900">
                {formatCurrency(mTotals.onorario)}
              </td>
              <td className="px-6 py-3 text-sm font-bold text-ink-900">
                {formatCurrency(mTotals.spese)}
              </td>
              <td className="px-6 py-3 text-sm font-bold text-ink-900">
                {formatCurrency(mTotals.cassaGeometri)}
              </td>
              <td className="px-6 py-3 text-sm font-bold text-ink-900">
                {formatCurrency(mTotals.bolli)}
              </td>
              <td className="px-6 py-3 text-sm font-bold text-ink-900">
                {formatCurrency(mTotals.fatturato)}
              </td>
              <td className="px-6 py-3 text-sm font-bold text-ink-900">
                {formatCurrency(mTotals.tasse)}
              </td>
              <td className="px-6 py-3 text-sm font-bold text-ink-900">
                {formatCurrency(mTotals.guadagnoNetto)}
              </td>
            </tr>
          )}
 </React.Fragment>
 );
 });
 return rows;
 })()
 )}
 </tbody>
 {/* Totalizzatore */}
 {fatture.length > 0 && (
  <tfoot className="bg-ink-200 border-t-2 border-ink-300">
 <tr>
 <td className="px-6 py-4 text-sm font-bold text-ink-900">
 TOTALI
 </td>
 <td className="px-6 py-4"></td>
 <td className="px-6 py-4"></td>
 <td className="px-6 py-4 text-sm font-bold text-ink-900">
 {formatCurrency(totals.onorario)}
 </td>
 <td className="px-6 py-4 text-sm font-bold text-ink-900">
 {formatCurrency(totals.spese)}
 </td>
 <td className="px-6 py-4 text-sm font-bold text-ink-900">
 {formatCurrency(totals.cassaGeometri)}
 </td>
 <td className="px-6 py-4 text-sm font-bold text-ink-900">
 {formatCurrency(totals.bolli)}
 </td>
<td className="px-6 py-4 text-sm font-bold text-blue-700 dark:text-blue-400">
              {formatCurrency(totals.fatturato)}
  </td>
<td className="px-6 py-4 text-sm font-bold text-red-700 dark:text-red-400">
              {formatCurrency(totals.tasse)}
  </td>
<td className="px-6 py-4 text-sm font-bold text-green-700 dark:text-green-400">
              {formatCurrency(totals.guadagnoNetto)}
 </td>
 </tr>
 </tfoot>
 )}
 </table>
 </div>
 </div>

 {/* Modal Nuova Fattura */}
  {showModal && (
  <div className="modal-overlay">
 <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-ink-200">
 <h2 className="text-xl font-bold text-ink-900">
 {editingId ? 'Modifica Fattura' : 'Inserisci Nuova Fattura'}
 </h2>
 <button
 onClick={() => {
 setShowModal(false);
 setEditingId(null);
 }}
 className="text-ink-400 hover:text-ink-600 transition-colors"
 >
 <X className="w-6 h-6" />
 </button>
 </div>

 {/* Form */}
 <div className="p-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Mese */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Mese
 </label>
 <select
 value={formData.mese}
 onChange={(e) => handleFormChange('mese', e.target.value)}
 className="input"
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
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Anno
 </label>
 <input
 type="number"
 value={formData.anno}
 onChange={(e) => handleFormChange('anno', parseInt(e.target.value))}
 className="input"
 />
 <p className="text-xs text-ink-500 mt-1">Inserisci l'anno a 4 cifre</p>
 </div>

 {/* Numero Fattura */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Numero Fattura
 </label>
 <input
 type="text"
 value={formData.numeroFattura}
 onChange={(e) => handleFormChange('numeroFattura', e.target.value)}
 placeholder="Numero generato automaticamente al salvataggio"
 className="input"
 />
 </div>

 {/* Onorario */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Onorario (€)
 </label>
 <input
 type="number"
 step="0.01"
 value={formData.onorario}
 onChange={(e) => handleFormChange('onorario', e.target.value)}
 className="input"
 placeholder="0,00"
 />
 </div>

 {/* Spese */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Spese (€)
 </label>
 <input
 type="number"
 step="0.01"
 value={formData.spese}
 onChange={(e) => handleFormChange('spese', e.target.value)}
 className="input"
 placeholder="0,00"
 />
 </div>

 {/* Cassa Geometri */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Cassa Geometri (€)
 </label>
 <input
 type="number"
 step="0.01"
 value={formData.cassaGeometri.toFixed(2)}
 className="input bg-ink-50"
 readOnly
 />
 <p className="text-xs text-ink-500 mt-1">5% dell'onorario</p>
 </div>

 {/* Bolli */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Bolli (€)
 </label>
 <input
 type="number"
 step="0.01"
 value={formData.bolli.toFixed(2)}
 className="input bg-ink-50"
 readOnly
 />
 <p className="text-xs text-ink-500 mt-1">2,00€ se fatturato {'>'} 77,47€</p>
 </div>

 {/* Tasse */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Tasse (€)
 </label>
 <input
 type="number"
 step="0.01"
 value={formData.tasse.toFixed(2)}
 className="input bg-ink-50"
 readOnly
 />
 <p className="text-xs text-ink-500 mt-1">
 (Onorario + bolli) × 0,78 × {(parametroTasse * 100).toFixed(0)}%
 </p>
 </div>

 {/* Fatturato */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Fatturato (€)
 </label>
 <input
 type="number"
 step="0.01"
 value={formData.fatturato.toFixed(2)}
 className="input bg-blue-50 font-semibold text-blue-700"
 readOnly
 />
 <p className="text-xs text-ink-500 mt-1">Onorario + spese + bolli + cassa</p>
 </div>

 {/* Guadagno Netto */}
 <div>
 <label className="block text-sm font-medium text-ink-700 mb-2">
 Guadagno Netto (€)
 </label>
 <input
 type="number"
 step="0.01"
 value={formData.guadagnoNetto.toFixed(2)}
 className="input bg-green-50 font-semibold text-green-700"
 readOnly
 />
 <p className="text-xs text-ink-500 mt-1">Fatturato - tasse - cassa - bolli - spese</p>
 </div>

 {/* Fattura per detrazione */}
 <div className="flex items-center gap-3 md:col-span-2">
 <input
 type="checkbox"
 id="fatturaPerDetrazione"
 checked={formData.fatturaPerDetrazione}
 onChange={(e) => handleFormChange('fatturaPerDetrazione', e.target.checked)}
 className="w-4 h-4 text-error-500 bg-ink-100 border-ink-300 rounded focus:ring-red-500"
 />
 <label htmlFor="fatturaPerDetrazione" className="text-sm font-medium text-ink-700">
 Fattura per detrazione
 </label>
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="flex justify-end gap-3 p-6 border-t border-ink-200">
 <button
 onClick={() => {
 setShowModal(false);
 setEditingId(null);
 }}
 className="btn btn-outline"
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

      {/* Menu Contestuale */}
      {contextMenu.fattura && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}>
          <button
            onClick={() => handleContextMenuAction('edit', contextMenu.fattura!)}
            className="context-menu-item"
          >
            <Edit className="w-4 h-4 text-signal-500" />
            Modifica
          </button>
          <div className="context-menu-separator" />
          <button
            onClick={() => handleContextMenuAction('delete', contextMenu.fattura!)}
            className="context-menu-item context-menu-danger"
          >
            <Trash2 className="w-4 h-4" />
            Elimina
          </button>
        </ContextMenu>
      )}
 </div>
 );
};

export default Contabilita; 