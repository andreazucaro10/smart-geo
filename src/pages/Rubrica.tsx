import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Phone, Mail, Edit, Trash2, User, Building } from 'lucide-react';
import { supabase } from '../services/supabase';
import type { Rubrica as RubricaType, TipologiaContatto, TipologiaAppartenenza } from '../types';
import toast from 'react-hot-toast';

export const Rubrica: React.FC = () => {
  const [contatti, setContatti] = useState<RubricaType[]>([]);
  const [tipologie, setTipologie] = useState<TipologiaContatto[]>([]);
  const [appartenenze, setAppartenenze] = useState<TipologiaAppartenenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipologia, setSelectedTipologia] = useState<number | null>(null);
  const [selectedAppartenenza, setSelectedAppartenenza] = useState<number | null>(null);
  const [soloAttivi, setSoloAttivi] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingContatto, setEditingContatto] = useState<RubricaType | null>(null);
  const [formData, setFormData] = useState({
    nominativo: '',
    telefono: '',
    email: '',
    ufficio: '',
    tipologia_id: '',
    appartenenza_id: '',
    disattivato: false
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchTipologie = async () => {
    try {
      const { data, error } = await supabase
        .from('tipologia_contatti')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error('Errore nel caricamento tipologie:', error);
        return;
      }

      setTipologie(data || []);
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const fetchAppartenenze = async () => {
    try {
      const { data, error } = await supabase
        .from('tipologie_appartenenza')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error('Errore nel caricamento appartenenze:', error);
        return;
      }

      setAppartenenze(data || []);
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const fetchContatti = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rubrica')
        .select(`
          *,
          tipologia_info:tipologia_contatti!rubrica_tipologia_id_fkey(id, nome),
          appartenenza_info:tipologie_appartenenza(id, nome)
        `)
        .order('nominativo', { ascending: true });

      // Filtro per testo di ricerca
      if (searchTerm) {
        query = query.or(`nominativo.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,telefono.ilike.%${searchTerm}%`);
      }

      // Filtro tipologia
      if (selectedTipologia) {
        query = query.eq('tipologia_id', selectedTipologia);
      }

      // Filtro appartenenza
      if (selectedAppartenenza) {
        query = query.eq('appartenenza_id', selectedAppartenenza);
      }

      // Filtro solo attivi
      if (soloAttivi) {
        query = query.eq('disattivato', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Errore nel caricamento contatti:', error);
        toast.error('Errore nel caricamento dei contatti');
        return;
      }

      setContatti(data || []);
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTipologie();
    fetchAppartenenze();
  }, []);

  useEffect(() => {
    fetchContatti();
  }, [searchTerm, selectedTipologia, selectedAppartenenza, soloAttivi]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedTipologia(null);
    setSelectedAppartenenza(null);
    setSoloAttivi(true);
  };

  const handleDeleteContatto = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo contatto?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('rubrica')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Errore nell\'eliminazione del contatto');
        return;
      }

      toast.success('Contatto eliminato con successo');
      fetchContatti();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'eliminazione');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditContatto = (contatto: RubricaType) => {
    setEditingContatto(contatto);
    setFormData({
      nominativo: contatto.nominativo,
      telefono: contatto.telefono || '',
      email: contatto.email || '',
      ufficio: contatto.ufficio || '',
      tipologia_id: contatto.tipologia_id?.toString() || '',
      appartenenza_id: contatto.appartenenza_id?.toString() || '',
      disattivato: contatto.disattivato
    });
    setShowModal(true);
  };

  const handleToggleStato = async (contatto: RubricaType) => {
    try {
      const nuovoStato = !contatto.disattivato;
      
      const { error } = await supabase
        .from('rubrica')
        .update({ disattivato: nuovoStato })
        .eq('id', contatto.id);

      if (error) {
        toast.error('Errore nell\'aggiornamento dello stato');
        return;
      }

      toast.success(nuovoStato ? 'Contatto disattivato' : 'Contatto attivato');
      fetchContatti();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'operazione');
    }
  };

  const resetForm = () => {
    setFormData({
      nominativo: '',
      telefono: '',
      email: '',
      ufficio: '',
      tipologia_id: '',
      appartenenza_id: '',
      disattivato: false
    });
    setEditingContatto(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nominativo.trim()) {
      toast.error('Il nominativo è obbligatorio');
      return;
    }

    setSubmitting(true);
    try {
      const contattoData = {
        nominativo: formData.nominativo.trim(),
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        ufficio: formData.ufficio.trim() || null,
        tipologia_id: formData.tipologia_id ? parseInt(formData.tipologia_id) : null,
        appartenenza_id: formData.appartenenza_id ? parseInt(formData.appartenenza_id) : null,
        disattivato: formData.disattivato
      };

      if (editingContatto) {
        // Modifica contatto esistente
        const { error } = await supabase
          .from('rubrica')
          .update(contattoData)
          .eq('id', editingContatto.id);

        if (error) {
          console.error('Errore nella modifica:', error);
          toast.error('Errore nella modifica del contatto');
          return;
        }

        toast.success('Contatto modificato con successo');
      } else {
        // Crea nuovo contatto
        const { error } = await supabase
          .from('rubrica')
          .insert([contattoData]);

        if (error) {
          console.error('Errore nella creazione:', error);
          toast.error('Errore nella creazione del contatto');
          return;
        }

        toast.success('Contatto creato con successo');
      }

      setShowModal(false);
      resetForm();
      fetchContatti();
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nell\'operazione');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    
    // Rimuovi tutti i caratteri non numerici
    const cleaned = phone.replace(/\D/g, '');
    
    // Se il numero è troppo corto, restituiscilo così com'è
    if (cleaned.length < 6) return phone;
    
    // Formatta come XXX XXX XXXX
    if (cleaned.length <= 10) {
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{1,4})$/);
      if (match) {
        return `${match[1]} ${match[2]} ${match[3]}`;
      }
    }
    
    // Per numeri più lunghi, prendi le ultime 10 cifre
    if (cleaned.length > 10) {
      const last10 = cleaned.slice(-10);
      const match = last10.match(/^(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `${match[1]} ${match[2]} ${match[3]}`;
      }
    }
    
    // Se non riesce a formattare, restituisci il numero originale
    return phone;
  };

  const getTipologiaColor = (tipologia: TipologiaContatto | undefined) => {
    if (!tipologia) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    
    // Colori basati sul nome della tipologia
    const colorMap: Record<string, string> = {
      'Geometra': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      'Architetto': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      'Ingegnere': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
      'Commercialista': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      'Avvocato': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      'Cliente': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300'
    };
    
    return colorMap[tipologia.nome] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rubrica</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestione contatti</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuovo Contatto
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
                placeholder="Cerca contatto..."
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

          {/* Filtro Tipologia */}
          <div>
            <select
              value={selectedTipologia || ''}
              onChange={(e) => setSelectedTipologia(e.target.value ? parseInt(e.target.value) : null)}
              className="input"
            >
              <option value="">Tutte le tipologie</option>
              {tipologie.map((tipologia) => (
                <option key={tipologia.id} value={tipologia.id}>
                  {tipologia.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Appartenenza */}
          <div>
            <select
              value={selectedAppartenenza || ''}
              onChange={(e) => setSelectedAppartenenza(e.target.value ? parseInt(e.target.value) : null)}
              className="input"
            >
              <option value="">Tutte le appartenenze</option>
              {appartenenze.map((appartenenza) => (
                <option key={appartenenza.id} value={appartenenza.id}>
                  {appartenenza.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Solo attivi */}
          <div className="flex items-center">
            <label className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
              soloAttivi 
                ? 'bg-green-600 text-white shadow-md' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}>
              <input
                type="checkbox"
                checked={soloAttivi}
                onChange={(e) => setSoloAttivi(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
                soloAttivi 
                  ? 'border-white bg-white' 
                  : 'border-gray-400 dark:border-gray-500 bg-transparent'
              }`}>
                {soloAttivi && (
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">Solo attivi</span>
            </label>
          </div>

          {/* Pulsante clear */}
          <div className="flex gap-2">
            <button
              onClick={handleClearFilters}
              className="btn btn-outline flex items-center gap-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabella Contatti */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nominativo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ufficio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Appartenenza
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Telefono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tipologia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Caricamento...</span>
                    </div>
                  </td>
                </tr>
              ) : contatti.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nessun contatto trovato
                  </td>
                </tr>
              ) : (
                contatti.map((contatto) => (
                  <tr key={contatto.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {contatto.nominativo}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        {contatto.ufficio && <Building className="w-4 h-4 text-gray-400" />}
                        {contatto.ufficio || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {contatto.appartenenza_info?.nome || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        {contatto.telefono && (
                          <>
                            <Phone className="w-4 h-4 text-gray-400" />
                            <a 
                              href={`tel:${contatto.telefono}`}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {formatPhone(contatto.telefono)}
                            </a>
                          </>
                        )}
                        {!contatto.telefono && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        {contatto.email && (
                          <>
                            <Mail className="w-4 h-4 text-gray-400" />
                            <a 
                              href={`mailto:${contatto.email}`}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {contatto.email}
                            </a>
                          </>
                        )}
                        {!contatto.email && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contatto.tipologia_info ? (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTipologiaColor(contatto.tipologia_info)}`}>
                          {contatto.tipologia_info.nome}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStato(contatto)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                          !contatto.disattivato
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                        }`}
                        title={!contatto.disattivato ? 'Clicca per disattivare' : 'Clicca per attivare'}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          !contatto.disattivato ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        {!contatto.disattivato ? 'Attivo' : 'Disattivato'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditContatto(contatto)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          title="Modifica"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContatto(contatto.id)}
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

      {/* Modal Nuovo/Modifica Contatto */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingContatto ? 'Modifica Contatto' : 'Nuovo Contatto'}
              </h2>
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
              {/* Nominativo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nominativo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nominativo"
                  value={formData.nominativo}
                  onChange={handleInputChange}
                  placeholder="Nome e cognome"
                  className="input w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Telefono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    placeholder="Numero di telefono"
                    className="input w-full"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Indirizzo email"
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Ufficio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ufficio
                </label>
                <input
                  type="text"
                  name="ufficio"
                  value={formData.ufficio}
                  onChange={handleInputChange}
                  placeholder="Ufficio di appartenenza"
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tipologia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipologia
                  </label>
                  <select
                    name="tipologia_id"
                    value={formData.tipologia_id}
                    onChange={handleInputChange}
                    className="input w-full"
                  >
                    <option value="">Seleziona tipologia</option>
                    {tipologie.map((tipologia) => (
                      <option key={tipologia.id} value={tipologia.id}>
                        {tipologia.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Appartenenza */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Appartenenza
                  </label>
                  <select
                    name="appartenenza_id"
                    value={formData.appartenenza_id}
                    onChange={handleInputChange}
                    className="input w-full"
                  >
                    <option value="">Seleziona appartenenza</option>
                    {appartenenze.map((appartenenza) => (
                      <option key={appartenenza.id} value={appartenenza.id}>
                        {appartenenza.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stato
                </label>
                <label className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                  !formData.disattivato 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600 text-green-800 dark:text-green-300' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600 text-red-800 dark:text-red-300'
                }`}>
                  <input
                    type="checkbox"
                    name="disattivato"
                    checked={formData.disattivato}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    formData.disattivato 
                      ? 'border-red-500 bg-red-500' 
                      : 'border-green-500 bg-green-500'
                  }`}>
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {!formData.disattivato ? 'Contatto attivo' : 'Contatto disattivato'}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {!formData.disattivato 
                        ? 'Il contatto sarà visibile negli elenchi' 
                        : 'Il contatto sarà nascosto dagli elenchi'
                      }
                    </p>
                  </div>
                </label>
              </div>

              {/* Note informative */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <span className="font-medium">* Campo obbligatorio</span><br />
                  Compila almeno il nominativo per salvare il contatto
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
                      {editingContatto ? 'Modifica...' : 'Salvataggio...'}
                    </div>
                  ) : (
                    editingContatto ? 'Modifica' : 'Salva'
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