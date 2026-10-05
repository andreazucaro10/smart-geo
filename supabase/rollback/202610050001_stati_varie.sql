-- Rollback manuale: ripristinare anche il frontend precedente.
-- Mantiene stati_varie e tutti i suoi dati; non elimina tabelle o stati.
BEGIN;
SET LOCAL search_path = pg_catalog;

DO $rollback$
DECLARE
  vincolo record;
BEGIN
  LOCK TABLE public.varie IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.stati_generali, public.stati_varie IN SHARE MODE;

  -- Dopo la separazione gli elenchi possono divergere: non associare una pratica
  -- a uno stato generale diverso solo perché condivide lo stesso ID.
  IF EXISTS (
    SELECT 1 FROM public.varie v
    LEFT JOIN public.stati_varie sv ON sv.id = v.registrazione
    LEFT JOIN public.stati_generali sg ON sg.id = v.registrazione
    WHERE v.registrazione IS NOT NULL
      AND (sg.id IS NULL OR sv.id IS NULL OR
        (to_jsonb(sv) - 'created_at' - 'updated_at') IS DISTINCT FROM
        (to_jsonb(sg) - 'created_at' - 'updated_at'))
  ) THEN
    RAISE EXCEPTION 'Rollback interrotto: gli stati assegnati alle pratiche varie sono diversi dagli stati generali. Riconciliare gli stati prima di riprovare.';
  END IF;

  SELECT c.conname, pg_get_constraintdef(c.oid) AS definizione
  INTO STRICT vincolo
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'registrazione'
  WHERE c.conrelid = 'public.varie'::regclass
    AND c.confrelid = 'public.stati_varie'::regclass
    AND c.contype = 'f' AND c.conkey = ARRAY[a.attnum];

  EXECUTE format('ALTER TABLE public.varie DROP CONSTRAINT %I', vincolo.conname);
  EXECUTE format('ALTER TABLE public.varie ADD CONSTRAINT %I %s', vincolo.conname,
    replace(vincolo.definizione, 'REFERENCES public.stati_varie', 'REFERENCES public.stati_generali'));
END;
$rollback$;

NOTIFY pgrst, 'reload schema';
COMMIT;
