import React, { useState, useEffect } from 'react';
import { Plus, Filter, RotateCcw, Edit, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { FatturaNonContabilizzata } from '../types';
import toast from 'react-hot-toast';

interface FormData {
  nome: string;
  totale: string;
  spese: string;
  note: string;
  data_emissione: string;
}

export const FattureNonContabilizzate: React.FC = () => {
  const [fatture, setFatture] = useState<FatturaNonContabilizzata[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroProprietario, setFiltroProprietario] = useState('');
  const [filtroMese, setFiltroMese] = useState('');
  const [filtroAnno, setFiltroAnno] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFattura, setEditingFattura] = useState<FatturaNonContabilizzata | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    totale: '',
    spese: '',
    note: '',
    data_emissione: new Date().toISOString().split('T')[0]
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    const saved = localStorage.getItem('fatture_non_contabilizzate_records_per_page');
    return saved ? parseInt(saved) : 10;
  });
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Totalizzatori
  const [totals, setTotals] = useState<{
    totale: number;
    spese: number;
    netProfit: number;
  }>({
    totale: 0,
    spese: 0,
    netProfit: 0
  });
  
  const { user } = useAuthStore();

  // Lista dei mesi
  const mesi = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // Genera lista anni (da 5 anni fa a 2 anni nel futuro)
  const currentYear = new Date().getFullYear();
  const anni = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);

  // Opzioni records per pagina
  const recordsPerPageOptions = [5, 10, 25, 50, 100];

  const fetchFatture = async () => {
    try {
      setLoading(true);
      
      // Query per contare i record totali
      let countQuery = supabase
        .from('fatture_non_contabilizzate')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Query per i dati
      let dataQuery = supabase
        .from('fatture_non_contabilizzate')
        .select('*')
        .eq('user_id', user?.id)
        .order('data_creazione', { ascending: false })
        .range((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage - 1);

      // Applica filtri
      if (filtroProprietario) {
        countQuery = countQuery.ilike('nome', `%${filtroProprietario}%`);
        dataQuery = dataQuery.ilike('nome', `%${filtroProprietario}%`);
      }

      if (filtroMese && filtroAnno) {
        const startDate = new Date(parseInt(filtroAnno), mesi.indexOf(filtroMese), 1);
        const endDate = new Date(parseInt(filtroAnno), mesi.indexOf(filtroMese) + 1, 0);
        countQuery = countQuery
          .gte('data_emissione', startDate.toISOString().split('T')[0])
          .lte('data_emissione', endDate.toISOString().split('T')[0]);
        dataQuery = dataQuery
          .gte('data_emissione', startDate.toISOString().split('T')[0])
          .lte('data_emissione', endDate.toISOString().split('T')[0]);
      } else if (filtroAnno) {
        const startDate = new Date(parseInt(filtroAnno), 0, 1);
        const endDate = new Date(parseInt(filtroAnno), 11, 31);
        countQuery = countQuery
          .gte('data_emissione', startDate.toISOString().split('T')[0])
          .lte('data_emissione', endDate.toISOString().split('T')[0]);
        dataQuery = dataQuery
          .gte('data_emissione', startDate.toISOString().split('T')[0])
          .lte('data_emissione', endDate.toISOString().split('T')[0]);
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

      setFatture(data || []);
      setTotalRecords(count || 0);
      
      // Calcola i totali
      const totaleTotale = (data || []).reduce((sum, fattura) => sum + fattura.totale, 0);
      const totaleSpese = (data || []).reduce((sum, fattura) => sum + fattura.spese, 0);
      const totaleNetProfit = totaleTotale - totaleSpese;

      setTotals({
        totale: totaleTotale,
        spese: totaleSpese,
        netProfit: totaleNetProfit
      });

    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchFatture();
    }
  }, [user?.id, currentPage, recordsPerPage]);

  const handleFilter = () => {
    setCurrentPage(1); // Reset alla prima pagina quando si filtra
    fetchFatture();
  };

  const handleReset = () => {
    setFiltroProprietario('');
    setFiltroMese('');
    setFiltroAnno('');
    setCurrentPage(1);
  };

  const handleRecordsPerPageChange = (newValue: number) => {
    setRecordsPerPage(newValue);
    setCurrentPage(1);
    localStorage.setItem('fatture_non_contabilizzate_records_per_page', newValue.toString());
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      totale: '',
      spese: '',
      note: '',
      data_emissione: new Date().toISOString().split('T')[0]
    });
    setEditingFattura(null);
  };

  const openModal = (fattura?: FatturaNonContabilizzata) => {
    if (fattura) {
      setEditingFattura(fattura);
      setFormData({
        nome: fattura.nome,
        totale: fattura.totale.toString(),
        spese: fattura.spese.toString(),
        note: fattura.note || '',
        data_emissione: fattura.data_emissione || new Date().toISOString().split('T')[0]
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.nome.trim()) {
      toast.error('Il nome della proprietà è obbligatorio');
      return false;
    }
    if (!formData.totale || parseFloat(formData.totale) <= 0) {
      toast.error('Il totale deve essere maggiore di 0');
      return false;
    }
    if (!formData.spese || parseFloat(formData.spese) < 0) {
      toast.error('Le spese non possono essere negative');
      return false;
    }
    if (!formData.data_emissione) {
      toast.error('La data di emissione è obbligatoria');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const fatturaData = {
        nome: formData.nome.trim(),
        totale: parseFloat(formData.totale),
        spese: parseFloat(formData.spese),
        note: formData.note.trim() || null,
        data_emissione: formData.data_emissione
      };

      if (editingFattura) {
        // Modifica fattura esistente
        const { error } = await supabase
          .from('fatture_non_contabilizzate')
          .update({
            ...fatturaData,
            data_modifica: new Date().toISOString()
          })
          .eq('id', editingFattura.id)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Errore nella modifica:', error);
          toast.error('Errore nella modifica della fattura');
          return;
        }

        toast.success('Fattura modificata con successo');
      } else {
        // Crea nuova fattura
        const { error } = await supabase
          .from('fatture_non_contabilizzate')
          .insert([fatturaData]);

        if (error) {
          console.error('Errore nella creazione:', error);
          toast.error('Errore nella creazione della fattura');
          return;
        }

        toast.success('Fattura creata con successo');
      }

      closeModal();
      fetchFatture();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'operazione');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFattura = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa fattura?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('fatture_non_contabilizzate')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della fattura');
        return;
      }

      toast.success('Fattura eliminata con successo');
      fetchFatture();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fatture Non Contabilizzate</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestione delle fatture non ancora contabilizzate</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Fattura
        </button>
      </div>

      {/* Filtri */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          {/* Filtro Proprietà */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtra per Proprietà
            </label>
            <input
              type="text"
              value={filtroProprietario}
              onChange={(e) => setFiltroProprietario(e.target.value)}
              placeholder="Proprietà fattura"
              className="input"
            />
          </div>

          {/* Filtro Mese */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtra per Mese
            </label>
            <select
              value={filtroMese}
              onChange={(e) => setFiltroMese(e.target.value)}
              className="input"
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
              className="input"
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
              className="input"
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
              className="btn btn-outline flex items-center gap-2"
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
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Proprietà
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data Emissione
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Totale (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Spese (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Guadagno netto (€)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Note
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Caricamento...</span>
                    </div>
                  </td>
                </tr>
              ) : fatture.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nessuna fattura trovata
                  </td>
                </tr>
              ) : (
                fatture.map((fattura) => (
                  <tr key={fattura.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {fattura.nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(fattura.data_emissione)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(fattura.totale)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(fattura.spese)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(fattura.totale - fattura.spese)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {fattura.note || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(fattura)}
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
                  <td className="px-6 py-4 text-sm font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(totals.totale)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(totals.spese)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(totals.netProfit)}
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingFattura ? 'Modifica Fattura' : 'Inserisci Nuova Fattura'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Proprietà */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proprietà <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    placeholder="Nome della proprietà"
                    className="input w-full"
                    required
                  />
                </div>

                {/* Data Emissione */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data Emissione <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="data_emissione"
                    value={formData.data_emissione}
                    onChange={handleInputChange}
                    className="input w-full"
                    required
                  />
                </div>

                {/* Totale */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Totale (€) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="totale"
                    value={formData.totale}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="input w-full"
                    required
                  />
                </div>

                {/* Spese */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Spese (€) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="spese"
                    value={formData.spese}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="input w-full"
                    required
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Note
                </label>
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleInputChange}
                  placeholder="Note aggiuntive..."
                  rows={4}
                  className="input w-full resize-none"
                />
              </div>

              {/* Pulsanti */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-outline"
                  disabled={submitting}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {editingFattura ? 'Modifica...' : 'Salvataggio...'}
                    </div>
                  ) : (
                    editingFattura ? 'Modifica' : 'Salva'
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