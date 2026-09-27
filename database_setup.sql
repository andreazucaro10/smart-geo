-- Script di setup database per Smart-Geo
-- Eseguire questo script nel Supabase SQL Editor

-- Tabella profili utente (estende auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS per profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Parametri azienda
CREATE TABLE parametri_azienda (
  id SERIAL PRIMARY KEY,
  denominazione VARCHAR(255) NOT NULL,
  indirizzo VARCHAR(255),
  citta VARCHAR(100),
  cap VARCHAR(10),
  nazione VARCHAR(50) DEFAULT 'Italia',
  partita_iva VARCHAR(20),
  codice_fiscale VARCHAR(20),
  codice_ape VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE parametri_azienda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage company params" ON parametri_azienda FOR ALL USING (true);

-- Stati generali
CREATE TABLE stati_generali (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(100) NOT NULL,
  colore VARCHAR(20) DEFAULT '#3a86ff',
  ordinamento INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE stati_generali ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage general states" ON stati_generali FOR ALL USING (true);

-- Stati APE
CREATE TABLE stati_ape (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(100) NOT NULL,
  colore VARCHAR(64) DEFAULT '#3a86ff',
  ordinamento INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE stati_ape ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage APE states" ON stati_ape FOR ALL USING (true);

-- Stati scadenze
CREATE TABLE stati_scadenze (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(255) NOT NULL,
  colore VARCHAR(7) DEFAULT '#3a86ff'
);

ALTER TABLE stati_scadenze ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage deadline states" ON stati_scadenze FOR ALL USING (true);

-- Tipi incarico
CREATE TABLE tipi_incarico (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(255) NOT NULL,
  comune BOOLEAN DEFAULT FALSE,
  catasto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tipi_incarico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage assignment types" ON tipi_incarico FOR ALL USING (true);

-- Tipologie contatti
CREATE TABLE tipologia_contatti (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descrizione TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tipologia_contatti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage contact types" ON tipologia_contatti FOR ALL USING (true);

-- Tipologie appartenenza
CREATE TABLE tipologie_appartenenza (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tipologie_appartenenza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage belonging types" ON tipologie_appartenenza FOR ALL USING (true);

-- Pratiche comune e catasto
CREATE TABLE comune_catasto (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  committente VARCHAR(1024) NOT NULL,
  indirizzo VARCHAR(255),
  citta VARCHAR(100),
  proprieta VARCHAR(255),
  proprieta2 VARCHAR(255),
  mail VARCHAR(100),
  telefono VARCHAR(50),
  note TEXT,
  comune BOOLEAN DEFAULT FALSE,
  catasto BOOLEAN DEFAULT FALSE,
  fine_lavori BOOLEAN DEFAULT FALSE,
  stato INTEGER REFERENCES stati_generali(id),
  pagamento BOOLEAN DEFAULT FALSE,
  tipo_incarico INTEGER REFERENCES tipi_incarico(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE comune_catasto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own comune_catasto" ON comune_catasto FOR ALL USING (auth.uid() = user_id);

-- APE
CREATE TABLE ape (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  committente VARCHAR(255) NOT NULL,
  proprieta VARCHAR(255),
  proprieta2 VARCHAR(255),
  indirizzo VARCHAR(255),
  citta VARCHAR(100),
  mail VARCHAR(255),
  telefono VARCHAR(50),
  note TEXT,
  registrazione INTEGER REFERENCES stati_ape(id),
  progressivo VARCHAR(100),
  pagamento BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE ape ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ape" ON ape FOR ALL USING (auth.uid() = user_id);

-- Pratiche varie
CREATE TABLE varie (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  committente VARCHAR(255) NOT NULL,
  proprieta VARCHAR(255),
  proprieta2 VARCHAR(255),
  indirizzo VARCHAR(255),
  citta VARCHAR(100),
  mail VARCHAR(100),
  telefono VARCHAR(20),
  note TEXT,
  registrazione INTEGER REFERENCES stati_generali(id),
  tipo_incarico_id INTEGER REFERENCES tipi_incarico(id),
  pagamento BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE varie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own varie" ON varie FOR ALL USING (auth.uid() = user_id);

-- Rubrica
CREATE TABLE rubrica (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  nominativo VARCHAR(100) NOT NULL,
  tipologia INTEGER REFERENCES tipologia_contatti(id),
  telefono VARCHAR(20),
  email VARCHAR(100),
  ufficio VARCHAR(255),
  tipologia_id INTEGER REFERENCES tipologia_contatti(id),
  appartenenza_id INTEGER REFERENCES tipologie_appartenenza(id),
  disattivato BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE rubrica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own rubrica" ON rubrica FOR ALL USING (auth.uid() = user_id);

-- Scadenze
CREATE TABLE scadenze (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  descrizione VARCHAR(255) NOT NULL,
  spese DECIMAL(10,2) DEFAULT 0,
  data_scadenza DATE,
  pagamento BOOLEAN DEFAULT FALSE,
  data_pagamento DATE,
  stato_id INTEGER REFERENCES stati_scadenze(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE scadenze ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own scadenze" ON scadenze FOR ALL USING (auth.uid() = user_id);

-- Fatture
CREATE TABLE fatture (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  numero_fattura VARCHAR(50) NOT NULL,
  mese_fattura VARCHAR(20) NOT NULL,
  anno_fattura INTEGER,
  onorario DECIMAL(10,2) NOT NULL,
  spese DECIMAL(10,2) NOT NULL,
  bolli DECIMAL(10,2) NOT NULL,
  cassa_geometri DECIMAL(10,2) NOT NULL,
  tasse DECIMAL(10,2) NOT NULL,
  fatturato DECIMAL(10,2) NOT NULL,
  guadagno_netto DECIMAL(10,2) NOT NULL,
  data_creazione TIMESTAMP NOT NULL,
  data_modifica TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, numero_fattura)
);

ALTER TABLE fatture ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own fatture" ON fatture FOR ALL USING (auth.uid() = user_id);

-- Parametri fatturazione
CREATE TABLE parametri_fatturazione (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  anno INTEGER NOT NULL,
  percentuale DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anno)
);

ALTER TABLE parametri_fatturazione ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own parametri_fatturazione" ON parametri_fatturazione FOR ALL USING (auth.uid() = user_id);

-- Categorie planner
CREATE TABLE planner_categories (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  slug VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3273dc',
  order_position INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, slug)
);

ALTER TABLE planner_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own planner_categories" ON planner_categories FOR ALL USING (auth.uid() = user_id);

-- Task planner
CREATE TABLE planner_tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users DEFAULT auth.uid(),
  description TEXT NOT NULL,
  day VARCHAR(20) NOT NULL,
  category INTEGER REFERENCES planner_categories(id),
  week_start_date DATE NOT NULL,
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE planner_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own planner_tasks" ON planner_tasks FOR ALL USING (auth.uid() = user_id);

-- Inserimento dati di esempio (visibili a tutti)
INSERT INTO stati_generali (descrizione, colore, ordinamento) VALUES
('In lavorazione', '#3b82f6', 1),
('Completato', '#10b981', 2),
('In attesa', '#f59e0b', 3),
('Annullato', '#ef4444', 4);

INSERT INTO stati_ape (descrizione, colore, ordinamento) VALUES
('Bozza', '#6b7280', 1),
('Registrato', '#10b981', 2),
('Protocollato', '#3b82f6', 3);

INSERT INTO stati_scadenze (descrizione, colore) VALUES
('In scadenza', '#f59e0b'),
('Scaduto', '#ef4444'),
('Pagato', '#10b981');

INSERT INTO tipi_incarico (descrizione, comune, catasto) VALUES
('Pratica edilizia', true, false),
('Voltura catastale', false, true),
('Frazionamento', false, true),
('SCIA', true, false),
('Permesso di costruire', true, false),
('DIA', true, false),
('Sanatoria', true, false),
('Tipo mappale', false, true);

INSERT INTO tipologia_contatti (nome, descrizione) VALUES
('Cliente', 'Cliente dello studio'),
('Fornitore', 'Fornitore di servizi'),
('Tecnico', 'Tecnico collaboratore'),
('Ente', 'Ente pubblico'),
('Professionista', 'Altro professionista');

INSERT INTO tipologie_appartenenza (nome) VALUES
('Comune'),
('Provincia'),
('Regione'),
('Agenzia delle Entrate'),
('Ordine Professionale'),
('Privato');

-- Categorie planner di default
INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'riunioni', 'Riunioni', '#ef4444', 1
WHERE auth.uid() IS NOT NULL;

INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'sopralluoghi', 'Sopralluoghi', '#3b82f6', 2
WHERE auth.uid() IS NOT NULL;

INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'uffici', 'Uffici', '#10b981', 3
WHERE auth.uid() IS NOT NULL;

INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'studio', 'Studio', '#f59e0b', 4
WHERE auth.uid() IS NOT NULL;

-- Funzione per creare automaticamente il profilo quando un utente si registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  
  -- Crea le categorie planner di default per il nuovo utente
  INSERT INTO public.planner_categories (user_id, slug, name, color, order_position) VALUES
  (new.id, 'riunioni', 'Riunioni', '#ef4444', 1),
  (new.id, 'sopralluoghi', 'Sopralluoghi', '#3b82f6', 2),
  (new.id, 'uffici', 'Uffici', '#10b981', 3),
  (new.id, 'studio', 'Studio', '#f59e0b', 4);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per eseguire la funzione quando un nuovo utente si registra
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user(); 

-- Script per sistemare le policy RLS che causano errore 406
-- Eseguire questo script nel Supabase SQL Editor

-- Elimina le policy esistenti per la tabella profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Ricrea le policy per la tabella profiles
CREATE POLICY "Users can view own profile" ON profiles 
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles 
FOR INSERT WITH CHECK (auth.uid() = id);

-- Verifica che RLS sia abilitato
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Verifica e sistema anche parametri_fatturazione
DROP POLICY IF EXISTS "Users can manage own parametri_fatturazione" ON parametri_fatturazione;

CREATE POLICY "Users can manage own parametri_fatturazione" ON parametri_fatturazione 
FOR ALL USING (auth.uid() = user_id);

ALTER TABLE parametri_fatturazione ENABLE ROW LEVEL SECURITY;

-- Verifica le altre tabelle principali
ALTER TABLE fatture ENABLE ROW LEVEL SECURITY;
ALTER TABLE comune_catasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE ape ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze ENABLE ROW LEVEL SECURITY;

-- Inserisci un record di test per parametri_fatturazione per l'anno corrente
-- Solo se non esiste già
INSERT INTO parametri_fatturazione (user_id, anno, percentuale)
SELECT auth.uid(), 2025, 22.00
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM parametri_fatturazione 
  WHERE user_id = auth.uid() AND anno = 2025
);

INSERT INTO parametri_fatturazione (user_id, anno, percentuale)
SELECT auth.uid(), 2024, 22.00
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM parametri_fatturazione 
  WHERE user_id = auth.uid() AND anno = 2024
); 