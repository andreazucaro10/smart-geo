import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, ChevronDown, Edit, Trash2, Check, X, Save } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import type { Ape, StatoApe } from '../types';
import toast from 'react-hot-toast';

interface ApeFormData {
  committente: string;
  proprieta: string;
  indirizzo: string;
  citta: string;
  mail: string;
  telefono: string;
  note: string;
  registrazione: number | null;
  progressivo: string;
  pagamento: boolean;
}

export const ApePage: React.FC = () => {
  const [pratiche, setPratiche] = useState<Ape[]>([]);
  const [stati, setStati] = useState<StatoApe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataDa, setDataDa] = useState('');
  const [dataA, setDataA] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtriAttivi, setFiltriAttivi] = useState({
    soloNonPagate: false,
    completateNonPagate: false
  });
  const [showModal, setShowModal] = useState(false);
  const [editingPratica, setEditingPratica] = useState<Ape | null>(null);
  const [formData, setFormData] = useState<ApeFormData>({
    committente: '',
    proprieta: '',
    indirizzo: '',
    citta: '',
    mail: '',
    telefono: '',
    note: '',
    registrazione: null,
    progressivo: '',
    pagamento: false
  });
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();

  const resetForm = () => {
    setFormData({
      committente: '',
      proprieta: '',
      indirizzo: '',
      citta: '',
      mail: '',
      telefono: '',
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
      indirizzo: pratica.indirizzo || '',
      citta: pratica.citta || '',
      mail: pratica.mail || '',
      telefono: pratica.telefono || '',
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

  const handleInputChange = (field: keyof ApeFormData, value: string | number | boolean | null) => {
    // Formatta il numero di telefono se il campo è 'telefono'
    if (field === 'telefono' && typeof value === 'string') {
      value = formatPhoneNumber(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.committente.trim()) {
      toast.error('Il committente è obbligatorio');
      return;
    }

    setSubmitting(true);

    try {
      const dataToSubmit = {
        committente: formData.committente.trim(),
        proprieta: formData.proprieta.trim() || null,
        indirizzo: formData.indirizzo.trim() || null,
        citta: formData.citta.trim() || null,
        mail: formData.mail.trim() || null,
        telefono: formData.telefono.trim() || null,
        note: formData.note.trim() || null,
        registrazione: formData.registrazione || null,
        progressivo: formData.progressivo.trim() || null,
        pagamento: formData.pagamento,
        user_id: user?.id
      };

      if (editingPratica) {
        // Modifica
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

        toast.success('Pratica APE modificata con successo');
      } else {
        // Creazione
        const { error } = await supabase
          .from('ape')
          .insert([dataToSubmit]);

        if (error) {
          console.error('Errore creazione:', error);
          toast.error('Errore nella creazione della pratica APE');
          return;
        }

        toast.success('Pratica APE creata con successo');
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'operazione');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Carica pratiche APE con relazioni
      let query = supabase
        .from('ape')
        .select(`
          *,
          registrazione_info:stati_ape(id, descrizione, colore)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      // Applica filtri
      if (searchTerm) {
        query = query.or(`committente.ilike.%${searchTerm}%,proprieta.ilike.%${searchTerm}%,indirizzo.ilike.%${searchTerm}%,progressivo.ilike.%${searchTerm}%`);
      }

      if (dataDa) {
        query = query.gte('created_at', dataDa);
      }

      if (dataA) {
        query = query.lte('created_at', dataA + 'T23:59:59.999Z');
      }

      if (filtroStato) {
        query = query.eq('registrazione', parseInt(filtroStato));
      }

      if (filtriAttivi.soloNonPagate) {
        query = query.eq('pagamento', false);
      }

      if (filtriAttivi.completateNonPagate) {
        // Assumiamo che "completate" significhi che hanno uno stato di registrazione diverso da null/vuoto
        query = query.not('registrazione', 'is', null).eq('pagamento', false);
      }

      const { data: praticheData, error: praticheError } = await query;

      if (praticheError) {
        console.error('Errore nel caricamento pratiche APE:', praticheError);
        toast.error('Errore nel caricamento delle pratiche APE');
        return;
      }

      // Carica stati APE per il dropdown
      const { data: statiData, error: statiError } = await supabase
        .from('stati_ape')
        .select('*')
        .order('ordinamento');

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
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const handleSearch = () => {
    fetchData();
  };

  const handleFilterToggle = (filterName: keyof typeof filtriAttivi) => {
    setFiltriAttivi(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const handleDeletePratica = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa pratica APE?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ape')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Errore nell\'eliminazione della pratica');
        return;
      }

      toast.success('Pratica APE eliminata con successo');
      fetchData();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const getStatoStyle = (stato: StatoApe | undefined) => {
    if (!stato) return 'bg-gray-100 text-gray-800';
    
    // Mappiamo i colori comuni a classi Tailwind
    const colorMap: { [key: string]: string } = {
      '#10b981': 'bg-green-500 text-white',
      '#22c55e': 'bg-green-500 text-white', 
      '#ef4444': 'bg-red-500 text-white',
      '#f59e0b': 'bg-yellow-500 text-white',
      '#3b82f6': 'bg-blue-500 text-white',
      '#8b5cf6': 'bg-purple-500 text-white',
      '#06b6d4': 'bg-cyan-500 text-white',
      '#84cc16': 'bg-lime-500 text-white',
      'green': 'bg-green-500 text-white',
      'red': 'bg-red-500 text-white',
      'blue': 'bg-blue-500 text-white',
      'yellow': 'bg-yellow-500 text-white',
      'purple': 'bg-purple-500 text-white',
    };
    
    return colorMap[stato.colore] || 'bg-gray-500 text-white';
  };

  const renderCheckIcon = (value: boolean) => {
    return value ? (
      <Check className="w-4 h-4 text-green-600" />
    ) : (
      <X className="w-4 h-4 text-gray-400" />
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
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Pratica APE
        </button>
      </div>

      {/* Filtri */}
      <div className="card space-y-4 dark:bg-gray-800 dark:border-gray-700">
        {/* Prima riga - Ricerca, date e dropdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Campo di ricerca */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Cerca..."
              className="input pl-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-emerald-500 text-white p-1 rounded"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Data Da */}
          <div className="relative">
            <input
              type="date"
              value={dataDa}
              onChange={(e) => setDataDa(e.target.value)}
              placeholder="gg/mm/aaaa"
              className="input pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>

          {/* Data A */}
          <div className="relative">
            <input
              type="date"
              value={dataA}
              onChange={(e) => setDataA(e.target.value)}
              placeholder="gg/mm/aaaa"
              className="input pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>

          {/* Filtro Stati APE */}
          <div className="relative">
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
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

        {/* Seconda riga - Filtri toggle */}
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
            <span className="text-sm font-medium">Solo non pagate</span>
          </label>

          <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
            filtriAttivi.completateNonPagate 
              ? 'bg-green-600 text-white shadow-md' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}>
            <input
              type="checkbox"
              checked={filtriAttivi.completateNonPagate}
              onChange={() => handleFilterToggle('completateNonPagate')}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
              filtriAttivi.completateNonPagate 
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
                    Mail
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Telefono
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
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getStatoStyle(pratica.registrazione_info)}`}>
                        {pratica.registrazione_info?.descrizione || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {pratica.committente}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.proprieta || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.indirizzo || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.citta || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.mail || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.telefono || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {pratica.note || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {pratica.progressivo || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderCheckIcon(pratica.pagamento)}
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
              {/* Prima riga - Committente e Proprietà */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Committente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.committente}
                    onChange={(e) => handleInputChange('committente', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Nome del committente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Proprietà
                  </label>
                  <input
                    type="text"
                    value={formData.proprieta}
                    onChange={(e) => handleInputChange('proprieta', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Nome del proprietario"
                  />
                </div>
              </div>

              {/* Seconda riga - Indirizzo e Città */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Indirizzo
                  </label>
                  <input
                    type="text"
                    value={formData.indirizzo}
                    onChange={(e) => handleInputChange('indirizzo', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Via, numero civico"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Città
                  </label>
                  <input
                    type="text"
                    value={formData.citta}
                    onChange={(e) => handleInputChange('citta', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Città"
                  />
                </div>
              </div>

              {/* Terza riga - Email e Telefono */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.mail}
                    onChange={(e) => handleInputChange('mail', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="email@esempio.com"
                  />
                </div>
                                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                     Telefono
                   </label>
                   <input
                     type="tel"
                     value={formData.telefono}
                     onChange={(e) => handleInputChange('telefono', e.target.value)}
                     className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                     placeholder="123 456 7890"
                     maxLength={12}
                   />
                 </div>
              </div>

              {/* Quarta riga - Stato e Progressivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Stato Registrazione
                  </label>
                  <select
                    value={formData.registrazione || ''}
                    onChange={(e) => handleInputChange('registrazione', e.target.value ? parseInt(e.target.value) : null)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">-- Seleziona stato --</option>
                    {stati.map((stato) => (
                      <option key={stato.id} value={stato.id}>
                        {stato.descrizione}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Progressivo
                  </label>
                  <input
                    type="text"
                    value={formData.progressivo}
                    onChange={(e) => handleInputChange('progressivo', e.target.value)}
                    className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Numero progressivo"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Note
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                  rows={3}
                  className="input dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                  placeholder="Note aggiuntive..."
                />
              </div>

              {/* Checkbox Pagamento */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stato Pagamento
                </label>
                <div className="flex items-center gap-4">
                  <label className={`relative inline-flex items-center cursor-pointer p-3 rounded-lg border-2 transition-all duration-200 ${
                    formData.pagamento 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.pagamento}
                        onChange={(e) => handleInputChange('pagamento', e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                        formData.pagamento 
                          ? 'bg-green-500 border-green-500' 
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      }`}>
                        {formData.pagamento && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className={`text-sm font-medium transition-colors ${
                        formData.pagamento 
                          ? 'text-green-700 dark:text-green-300' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {formData.pagamento ? 'Pagamento effettuato' : 'Pagamento in sospeso'}
                      </div>
                      <div className={`text-xs transition-colors ${
                        formData.pagamento 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formData.pagamento ? 'La pratica è stata saldata' : 'In attesa di pagamento'}
                      </div>
                    </div>
                  </label>
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