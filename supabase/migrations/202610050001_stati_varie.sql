-- Applicare prima di pubblicare il frontend che usa stati_varie.
-- Duplica lo schema effettivo, compreso filtro_non_pagata, e tutti gli stati.
BEGIN;
SET LOCAL search_path = pg_catalog;

DO $migration$
DECLARE
  vincolo record;
  elemento record;
  ruoli text;
  comando text;
  colonne text;
  sequenza text;
  id_massimo bigint;
BEGIN
  -- Rieseguire lo script non ricopia stati né sovrascrive modifiche successive.
  IF to_regclass('public.stati_varie') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'registrazione'
      WHERE c.conrelid = 'public.varie'::regclass
        AND c.confrelid = 'public.stati_varie'::regclass
        AND c.contype = 'f' AND c.conkey = ARRAY[a.attnum]
    ) THEN
      RAISE NOTICE 'Migration stati_varie già applicata.';
      RETURN;
    END IF;
    RAISE EXCEPTION 'stati_varie esiste ma varie.registrazione non è collegata: verificare lo schema prima di proseguire.';
  END IF;

  -- Blocca modifiche concorrenti durante copia e sostituzione del vincolo.
  LOCK TABLE public.varie IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.stati_generali IN SHARE MODE;

  SELECT c.conname, pg_get_constraintdef(c.oid) AS definizione
  INTO STRICT vincolo
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'registrazione'
  WHERE c.conrelid = 'public.varie'::regclass
    AND c.confrelid = 'public.stati_generali'::regclass
    AND c.contype = 'f' AND c.conkey = ARRAY[a.attnum];

  CREATE TABLE public.stati_varie (LIKE public.stati_generali INCLUDING ALL);

  -- LIKE crea una nuova sequenza per IDENTITY, ma SERIAL copia il vecchio default.
  -- In quel caso crea una sequenza autonoma per evitare di condividere gli ID.
  sequenza := pg_get_serial_sequence('public.stati_varie', 'id');
  IF sequenza IS NULL THEN
    CREATE SEQUENCE public.stati_varie_id_seq OWNED BY public.stati_varie.id;
    ALTER TABLE public.stati_varie ALTER COLUMN id
      SET DEFAULT nextval('public.stati_varie_id_seq'::regclass);
    sequenza := 'public.stati_varie_id_seq';
  END IF;

  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO colonne
  FROM pg_attribute
  WHERE attrelid = 'public.stati_generali'::regclass
    AND attnum > 0 AND NOT attisdropped AND attgenerated = '';

  EXECUTE format(
    'INSERT INTO public.stati_varie (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM public.stati_generali',
    colonne, colonne
  );
  SELECT max(id) INTO id_massimo FROM public.stati_varie;
  PERFORM setval(sequenza::regclass, greatest(coalesce(id_massimo, 1), 1), id_massimo IS NOT NULL);

  -- LIKE non copia foreign key, trigger o policy: replica quelli della sorgente.
  FOR elemento IN
    SELECT conname, pg_get_constraintdef(oid) AS definizione FROM pg_constraint
    WHERE conrelid = 'public.stati_generali'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.stati_varie ADD CONSTRAINT %I %s',
      elemento.conname, elemento.definizione);
  END LOOP;

  FOR elemento IN
    SELECT pg_get_triggerdef(oid) AS definizione FROM pg_trigger
    WHERE tgrelid = 'public.stati_generali'::regclass AND NOT tgisinternal
  LOOP
    EXECUTE replace(elemento.definizione, ' ON public.stati_generali ', ' ON public.stati_varie ');
  END LOOP;

  ALTER TABLE public.stati_varie ENABLE ROW LEVEL SECURITY;
  FOR elemento IN
    SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stati_generali'
  LOOP
    SELECT string_agg(CASE WHEN ruolo = 'public' THEN 'PUBLIC' ELSE quote_ident(ruolo) END, ', ')
    INTO ruoli FROM unnest(elemento.roles) AS elenco(ruolo);
    comando := format('CREATE POLICY %I ON public.stati_varie AS %s FOR %s TO %s',
      elemento.policyname, elemento.permissive, elemento.cmd, ruoli);
    IF elemento.qual IS NOT NULL THEN
      comando := comando || format(' USING (%s)', elemento.qual);
    END IF;
    IF elemento.with_check IS NOT NULL THEN
      comando := comando || format(' WITH CHECK (%s)', elemento.with_check);
    END IF;
    EXECUTE comando;
  END LOOP;

  -- Rimuove i grant predefiniti di Supabase e copia i permessi della sorgente.
  REVOKE ALL ON public.stati_varie FROM PUBLIC, anon, authenticated, service_role;
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated, service_role', sequenza);
  FOR elemento IN
    SELECT grantee, privilege_type, is_grantable FROM information_schema.table_privileges
    WHERE table_schema = 'public' AND table_name = 'stati_generali'
  LOOP
    EXECUTE format('GRANT %s ON public.stati_varie TO %s%s', elemento.privilege_type,
      CASE WHEN elemento.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(elemento.grantee) END,
      CASE WHEN elemento.is_grantable = 'YES' THEN ' WITH GRANT OPTION' ELSE '' END);
    IF elemento.privilege_type = 'INSERT' THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO %s', sequenza,
        CASE WHEN elemento.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(elemento.grantee) END);
    END IF;
  END LOOP;

  -- Conserva nome del vincolo e comportamento ON DELETE / ON UPDATE originali.
  -- Gli ID copiati evitano qualsiasi aggiornamento dei record di varie.
  EXECUTE format('ALTER TABLE public.varie DROP CONSTRAINT %I', vincolo.conname);
  EXECUTE format('ALTER TABLE public.varie ADD CONSTRAINT %I %s', vincolo.conname,
    replace(vincolo.definizione, 'REFERENCES public.stati_generali', 'REFERENCES public.stati_varie'));
END;
$migration$;

-- Aggiorna i join disponibili nelle API REST di Supabase dopo il commit.
NOTIFY pgrst, 'reload schema';
COMMIT;
