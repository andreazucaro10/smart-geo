import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faSignature, faLock, faKey, faUnlockAlt, faCheck, faSave } from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

export const UserSettings: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, surname')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        
        if (data) {
          setName(data.name || '');
          setSurname(data.surname || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento dei dati utente.' });
      }
    };

    fetchUserData();
  }, [user?.id]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name, surname })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profilo aggiornato con successo!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Errore nell\'aggiornamento del profilo.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Le nuove password non corrispondono.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'La nuova password deve essere lunga almeno 6 caratteri.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // First, re-authenticate with current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Password corrente non valida.');
      }

      // Then update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setMessage({ type: 'success', text: 'Password aggiornata con successo!' });
      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: error.message || 'Errore nel cambio password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Impostazioni Utente</h1>
      
      {message && (
        <div className={`mb-6 p-3 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Profilo</h2>
        <form onSubmit={handleProfileUpdate}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Nome"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cognome
            </label>
            <input
              type="text"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Cognome"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
          >
            <FontAwesomeIcon icon={faSave} className="mr-2" />
            {loading ? 'Salvataggio...' : 'Salva Profilo'}
          </button>
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          <FontAwesomeIcon icon={faLock} className="mr-2" />
          Cambio Password
        </h2>
        <form onSubmit={handlePasswordChange}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FontAwesomeIcon icon={faKey} className="mr-1" />
              Password Corrente
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Password Corrente"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FontAwesomeIcon icon={faUnlockAlt} className="mr-1" />
              Nuova Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Nuova Password"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FontAwesomeIcon icon={faCheck} className="mr-1" />
              Conferma Nuova Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Conferma Nuova Password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
          >
            <FontAwesomeIcon icon={faSave} className="mr-2" />
            {loading ? 'Aggiornamento...' : 'Cambia Password'}
          </button>
        </form>
      </div>
    </div>
  );
};