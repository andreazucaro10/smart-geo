import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../services/supabase';
import type { AuthUser, AuthState } from '../types';
import toast from 'react-hot-toast';

interface AuthStore extends AuthState {
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  initialize: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      error: null,

      setUser: (user) => set({ user, error: null }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      initialize: async () => {
        try {
          set({ loading: true });
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Errore nel recupero della sessione:', error);
            set({ user: null, loading: false });
            return;
          }

          if (session?.user) {
            // Recupera il profilo utente
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profileError && profileError.code !== 'PGRST116') {
              console.error('Errore nel recupero del profilo:', profileError);
            }

            // Se il profilo non esiste, crealo
            if (!profile && session.user.email) {
              const username = session.user.email.split('@')[0];
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  username
                });

              if (insertError) {
                console.error('Errore nella creazione del profilo:', insertError);
              }

              set({
                user: {
                  id: session.user.id,
                  email: session.user.email,
                  username
                },
                loading: false
              });
            } else {
              set({
                user: {
                  id: session.user.id,
                  email: session.user.email,
                  username: profile?.username || session.user.email?.split('@')[0]
                },
                loading: false
              });
            }
          } else {
            set({ user: null, loading: false });
          }

          // Ascolta i cambiamenti di auth
          supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (profileError && profileError.code !== 'PGRST116') {
                console.error('Errore nel recupero del profilo:', profileError);
              }

              set({
                user: {
                  id: session.user.id,
                  email: session.user.email,
                  username: profile?.username || session.user.email?.split('@')[0]
                },
                loading: false
              });
            } else if (event === 'SIGNED_OUT') {
              set({ user: null, loading: false });
            }
          });
        } catch (error) {
          console.error('Errore nell\'inizializzazione:', error);
          set({ user: null, loading: false });
        }
      },

      signIn: async (email, password) => {
        try {
          set({ loading: true, error: null });

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) {
            set({ error: error.message, loading: false });
            toast.error('Errore durante il login: ' + error.message);
            return false;
          }

          if (data.user) {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (profileError && profileError.code !== 'PGRST116') {
              console.error('Errore nel recupero del profilo:', profileError);
            }

            set({
              user: {
                id: data.user.id,
                email: data.user.email,
                username: profile?.username || data.user.email?.split('@')[0]
              },
              loading: false
            });

            toast.success('Login effettuato con successo!');
            return true;
          }

          return false;
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Errore imprevisto durante il login');
          return false;
        }
      },

      signUp: async (email, password, username) => {
        try {
          set({ loading: true, error: null });

          const { data, error } = await supabase.auth.signUp({
            email,
            password
          });

          if (error) {
            set({ error: error.message, loading: false });
            toast.error('Errore durante la registrazione: ' + error.message);
            return false;
          }

          if (data.user) {
            // Crea il profilo utente
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                username
              });

            if (profileError) {
              console.error('Errore nella creazione del profilo:', profileError);
            }

            toast.success('Registrazione completata! Controlla la tua email per confermare l\'account.');
            set({ loading: false });
            return true;
          }

          return false;
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Errore imprevisto durante la registrazione');
          return false;
        }
      },

      signOut: async () => {
        try {
          set({ loading: true });
          
          const { error } = await supabase.auth.signOut();
          
          if (error) {
            console.error('Errore durante il logout:', error);
            toast.error('Errore durante il logout');
          } else {
            set({ user: null });
            toast.success('Logout effettuato con successo!');
          }
        } catch (error) {
          console.error('Errore imprevisto durante il logout:', error);
          toast.error('Errore imprevisto durante il logout');
        } finally {
          set({ loading: false });
        }
      },

      resetPassword: async (email) => {
        try {
          set({ loading: true, error: null });

          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`
          });

          if (error) {
            set({ error: error.message, loading: false });
            toast.error('Errore nell\'invio dell\'email: ' + error.message);
            return false;
          }

          toast.success('Email di reset password inviata!');
          set({ loading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, loading: false });
          toast.error('Errore imprevisto');
          return false;
        }
      }
    }),
    {
      name: 'smart-geo-auth',
      partialize: (state) => ({ user: state.user })
    }
  )
); 