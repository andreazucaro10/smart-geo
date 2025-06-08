import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Filter, Calendar, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { Scadenza } from '../types';
import toast from 'react-hot-toast';

export const Spese: React.FC = () => {
  const [spese, setSpese] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [soloNonPagate, setSoloNonPagate] = useState(false);
  const [dataDa, setDataDa] = useState('');
  const [dataA, setDataA] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    descrizione: '',
    spese: '',
    data_scadenza: '',
    pagamento: false,
    data_pagamento: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();

  const fetchSpese = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('scadenze')
        .select('*')
        .eq('user_id', user?.id)
        .order('data_scadenza', { ascending: false });

      // Filtro per testo di ricerca
      if (searchTerm) {
        query = query.ilike('descrizione', `%${searchTerm}%`);
      }

      // Filtro solo non pagate
      if (soloNonPagate) {
        query = query.eq('pagamento', false);
      }

      // Filtro data da
      if (dataDa) {
        query = query.gte('data_scadenza', dataDa);
      }

      // Filtro data a
      if (dataA) {
        query = query.lte('data_scadenza', dataA);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Errore nel caricamento spese:', error);
        toast.error('Errore nel caricamento delle spese');
        return;
      }

      setSpese(data || []);
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchSpese();
    }
  }, [user?.id]);

  const handleSearch = () => {
    fetchSpese();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSoloNonPagate(false);
    setDataDa('');
    setDataA('');
  };

  const handleDeleteSpesa = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('scadenze')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della spesa');
        return;
      }

      toast.success('Spesa eliminata con successo');
      fetchSpese();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      descrizione: '',
      spese: '',
      data_scadenza: '',
      pagamento: false,
      data_pagamento: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descrizione.trim()) {
      toast.error('La descrizione è obbligatoria');
      return;
    }

    if (!formData.spese || parseFloat(formData.spese) <= 0) {
      toast.error('L\'importo deve essere maggiore di 0');
      return;
    }

    setSubmitting(true);
    try {
      const spesaData = {
        descrizione: formData.descrizione.trim(),
        spese: parseFloat(formData.spese),
        data_scadenza: formData.data_scadenza || null,
        pagamento: formData.pagamento,
        data_pagamento: formData.pagamento && formData.data_pagamento ? formData.data_pagamento : null
      };

      const { error } = await supabase
        .from('scadenze')
        .insert([spesaData]);

      if (error) {
        console.error('Errore nella creazione:', error);
        toast.error('Errore nella creazione della scadenza');
        return;
      }

      toast.success('Scadenza creata con successo');
      setShowModal(false);
      resetForm();
      fetchSpese();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'operazione');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getStatoClass = (dataScadenza: string | null, dataPagamento: string | null) => {
    if (dataPagamento) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    }
    
    if (!dataScadenza) {
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }

    const oggi = new Date();
    const scadenza = new Date(dataScadenza);
    
    if (scadenza < oggi) {
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    } else if (scadenza <= new Date(oggi.getTime() + 7 * 24 * 60 * 60 * 1000)) {
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    }
    
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  };

  const getStatoText = (dataScadenza: string | null, dataPagamento: string | null) => {
    if (dataPagamento) {
      return 'Pagata';
    }
    
    if (!dataScadenza) {
      return 'N/A';
    }

    const oggi = new Date();
    const scadenza = new Date(dataScadenza);
    
    if (scadenza < oggi) {
      return 'Scaduta';
    } else if (scadenza <= new Date(oggi.getTime() + 7 * 24 * 60 * 60 * 1000)) {
      return 'In scadenza';
    }
    
    return 'Da pagare';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spese</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestione spese</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Scadenza
        </button>
      </div>

      {/* Filtri */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          {/* Campo di ricerca */}
          <div className="md:col-span-2">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca..."
                className="input pl-10 pr-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Toggle Solo non pagate */}
          <div className="flex items-center">
            <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
              soloNonPagate 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}>
              <input
                type="checkbox"
                checked={soloNonPagate}
                onChange={(e) => setSoloNonPagate(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
                soloNonPagate 
                  ? 'border-white bg-white' 
                  : 'border-gray-400 dark:border-gray-500 bg-transparent'
              }`}>
                {soloNonPagate && (
                  <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">Solo non pagate</span>
            </label>
          </div>

          {/* Data Da */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date:
            </label>
            <div className="relative">
              <input
                type="date"
                value={dataDa}
                onChange={(e) => setDataDa(e.target.value)}
                placeholder="Da GG/MM/AAAA"
                className="input pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
          </div>

          {/* Data A */}
          <div>
            <div className="relative">
              <input
                type="date"
                value={dataA}
                onChange={(e) => setDataA(e.target.value)}
                placeholder="A GG/MM/AAAA"
                className="input pr-10 mt-6"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
          </div>

          {/* Pulsanti */}
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="btn btn-primary flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearSearch}
              className="btn btn-outline flex items-center gap-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabella Spese */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Descrizione
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Importo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data Scadenza
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Pagamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data Pagamento
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
              ) : spese.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nessuna scadenza trovata
                  </td>
                </tr>
              ) : (
                spese.map((spesa) => (
                  <tr key={spesa.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {spesa.descrizione}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(spesa.spese)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(spesa.data_scadenza || null)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatoClass(spesa.data_scadenza || null, spesa.data_pagamento || null)}`}>
                        {getStatoText(spesa.data_scadenza || null, spesa.data_pagamento || null)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {spesa.pagamento ? 'Sì' : 'No'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(spesa.data_pagamento || null)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {/* TODO: Implementa modifica */}}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          title="Modifica"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSpesa(spesa.id)}
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
          </table>
        </div>
      </div>

      {/* Modal Nuova Scadenza */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nuova Scadenza</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrizione <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="descrizione"
                  value={formData.descrizione}
                  onChange={handleInputChange}
                  placeholder="Descrizione della scadenza"
                  className="input w-full"
                  required
                />
              </div>

              {/* Spese */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Spese
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">€</span>
                  <input
                    type="number"
                    name="spese"
                    value={formData.spese}
                    onChange={handleInputChange}
                    placeholder="Importo spese"
                    step="0.01"
                    min="0"
                    className="input w-full pl-8"
                  />
                </div>
              </div>

              {/* Data Scadenza */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Scadenza
                </label>
                <input
                  type="date"
                  name="data_scadenza"
                  value={formData.data_scadenza}
                  onChange={handleInputChange}
                  className="input w-full"
                />
              </div>

              {/* Pagamento */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="pagamento"
                  checked={formData.pagamento}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:bg-gray-700"
                />
                <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Pagamento</label>
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  Questo campo verrà automaticamente compilato quando flaggi il pagamento
                </span>
              </div>

              {/* Data Pagamento */}
              {formData.pagamento && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data Pagamento
                  </label>
                  <input
                    type="date"
                    name="data_pagamento"
                    value={formData.data_pagamento}
                    onChange={handleInputChange}
                    className="input w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Lo stato della scadenza verrà determinato automaticamente in base alla data
                  </p>
                </div>
              )}

              {/* Note informative */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <span className="font-medium">* Campo obbligatorio</span><br />
                  Lo stato della scadenza verrà determinato automaticamente in base alla data
                </p>
              </div>

              {/* Pulsanti */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
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
                      Salvataggio...
                    </div>
                  ) : (
                    'Salva'
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