# Separazione degli stati Varie

1. Nel SQL Editor di Supabase eseguire tutto il file `migrations/202610050001_stati_varie.sql` come amministratore (`postgres`). È anche applicabile tramite il normale flusso delle migration Supabase.
2. Eseguire le query di verifica qui sotto immediatamente dopo la migration.
3. Pubblicare il frontend aggiornato e ricaricare le schede dell'app già aperte. Da quel momento gestire gli stati delle pratiche Varie nella sezione **Parametri → Stati Varie**.

La migration usa lo schema reale di `stati_generali`, copia tutte le righe con gli stessi ID e conserva colori, ordinamento, flag e date. Gli elenchi diventano indipendenti. `varie.registrazione` mantiene i valori esistenti e la foreign key conserva il comportamento originale di cancellazione e aggiornamento. La sequenza dei nuovi ID è autonoma. Sono copiati policy RLS, permessi, foreign key e trigger della tabella sorgente.

La copia e il cambio del vincolo avvengono in un'unica transazione. Una riesecuzione dopo il successo non modifica gli stati. Uno schema già parzialmente modificato produce un errore, evitando sovrascritture implicite.

Durante il passaggio evitare modifiche alle pratiche e ai due elenchi degli stati: le vecchie versioni del frontend leggono ancora `stati_generali`. Applicare SQL e pubblicare il frontend nella stessa finestra di aggiornamento.

## Verifica dopo l'applicazione

```sql
-- I conteggi devono coincidere subito dopo la copia.
SELECT
  (SELECT count(*) FROM public.stati_generali) AS stati_generali,
  (SELECT count(*) FROM public.stati_varie) AS stati_varie;

-- Deve restituire zero righe: confronto di tutte le colonne e tutti gli ID.
SELECT sg.id AS id_generale, sv.id AS id_varie
FROM public.stati_generali sg
FULL JOIN public.stati_varie sv ON sv.id = sg.id
WHERE to_jsonb(sg) IS DISTINCT FROM to_jsonb(sv);

-- Deve restituire zero righe: nessuna pratica priva del proprio stato.
SELECT v.id, v.registrazione
FROM public.varie v
LEFT JOIN public.stati_varie sv ON sv.id = v.registrazione
WHERE v.registrazione IS NOT NULL AND sv.id IS NULL;

-- La definizione deve indicare REFERENCES stati_varie(id).
SELECT c.conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'registrazione'
WHERE c.conrelid = 'public.varie'::regclass
  AND c.contype = 'f' AND c.conkey = ARRAY[a.attnum];
```

Verificare nell'app il caricamento di Varie, il filtro per stato, il filtro “non pagata”, il cambio stato di una pratica e creazione/modifica/eliminazione da Parametri. Una modifica agli stati Varie deve lasciare invariati gli stati generali.

## Rollback manuale

Eseguire `rollback/202610050001_stati_varie.sql` e ripristinare il frontend precedente nella stessa finestra di aggiornamento. Il rollback conserva la nuova tabella e si interrompe se uno stato assegnato è stato modificato oppure non esiste più tra gli stati generali; in tal caso serve riconciliare esplicitamente i dati prima del ripristino. Dopo un rollback la migration iniziale non ricopia la tabella conservata: una nuova attivazione richiede una migration dedicata.

Riferimento PostgreSQL per la copia dello schema e delle sequenze: [CREATE TABLE — LIKE](https://www.postgresql.org/docs/current/sql-createtable.html).
