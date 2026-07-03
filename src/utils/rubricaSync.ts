import { supabase } from '../services/supabase';

export const syncRubricaFromPratica = async (
  proprieta: string | null | undefined,
  telefono: string | null | undefined,
  mail: string | null | undefined,
  committente: string | null | undefined
): Promise<void> => {
  if (!proprieta || !proprieta.trim()) return;

  try {
    const nominativo = proprieta.trim();

    // Cerca se il contatto esiste già in rubrica
    const { data: existing, error: searchError } = await supabase
      .from('rubrica')
      .select('id')
      .ilike('nominativo', nominativo)
      .limit(1);

    if (searchError) {
      console.error('Errore ricerca contatto in rubrica:', searchError);
      return;
    }

    // Se il contatto esiste, non fare nulla
    if (existing && existing.length > 0) return;

    // Inserisci nuovo contatto in rubrica
    const { error: insertError } = await supabase
      .from('rubrica')
      .insert([{
        nominativo,
        telefono: telefono?.trim() || null,
        email: mail?.trim() || null,
        riferimento: committente?.trim() || null,
        disattivato: false
      }]);

    if (insertError) {
      console.error('Errore creazione contatto in rubrica:', insertError);
    }
  } catch (error) {
    console.error('Errore sync rubrica:', error);
  }
};
