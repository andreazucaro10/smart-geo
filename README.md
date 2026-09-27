# Smart-Geo

Sistema di gestione completo per studi di geometri costruito con React, TypeScript e Supabase.

## 🚀 Caratteristiche

- **Dashboard completa** con statistiche in tempo reale
- **Gestione pratiche** per Comune, Catasto, APE e Varie
- **Sistema di contabilità** con fatturazione automatica
- **Planner settimanale** con drag & drop
- **Rubrica contatti** avanzata
- **Gestione scadenze** e notifiche
- **Sistema di autenticazione** sicuro
- **Design responsive** moderno
- **Aggiornamenti real-time** con Supabase

## 🛠️ Tecnologie

### Frontend
- **React 18+** con TypeScript
- **Vite** per il build tool
- **Tailwind CSS** per lo styling
- **React Router** per la navigazione
- **Zustand** per lo state management
- **React Hook Form** + **Zod** per la validazione
- **Lucide React** per le icone
- **React Hot Toast** per le notifiche

### Backend
- **Supabase** (PostgreSQL, Auth, API REST, Realtime)
- **Row Level Security** per la sicurezza dei dati

## 📋 Prerequisiti

- Node.js 18+ 
- Account Supabase
- Git

## 🔧 Installazione

### 1. Clona il repository
```bash
git clone <repository-url>
cd smart-geo
```

### 2. Installa le dipendenze
```bash
npm install --legacy-peer-deps
```

### 3. Configura Supabase

#### Crea un progetto Supabase
1. Vai su [supabase.com](https://supabase.com)
2. Crea un nuovo progetto
3. Annota l'URL del progetto e la chiave anonima

#### Configura il database
Esegui il seguente script SQL nel Supabase SQL Editor:

```sql
-- Abilita RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Tabella profili utente
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS per profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

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

-- Stati generali
CREATE TABLE stati_generali (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(100) NOT NULL,
  colore VARCHAR(20) DEFAULT '#3a86ff',
  ordinamento INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stati APE
CREATE TABLE stati_ape (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(100) NOT NULL,
  colore VARCHAR(64) DEFAULT '#3a86ff',
  ordinamento INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stati scadenze
CREATE TABLE stati_scadenze (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(255) NOT NULL,
  colore VARCHAR(7) DEFAULT '#3a86ff'
);

-- Tipi incarico
CREATE TABLE tipi_incarico (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(255) NOT NULL,
  comune BOOLEAN DEFAULT FALSE,
  catasto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tipologie contatti
CREATE TABLE tipologia_contatti (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descrizione TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tipologie appartenenza
CREATE TABLE tipologie_appartenenza (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pratiche comune e catasto
CREATE TABLE comune_catasto (
  id SERIAL PRIMARY KEY,
  committente VARCHAR(1024) NOT NULL,
  indirizzo VARCHAR(255),
  citta VARCHAR(100),
  proprieta VARCHAR(255),
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

-- APE
CREATE TABLE ape (
  id SERIAL PRIMARY KEY,
  committente VARCHAR(255) NOT NULL,
  proprieta VARCHAR(255),
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

-- Pratiche varie
CREATE TABLE varie (
  id SERIAL PRIMARY KEY,
  committente VARCHAR(255) NOT NULL,
  proprieta VARCHAR(255),
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

-- Rubrica
CREATE TABLE rubrica (
  id SERIAL PRIMARY KEY,
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

-- Scadenze
CREATE TABLE scadenze (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(255) NOT NULL,
  spese DECIMAL(10,2) DEFAULT 0,
  data_scadenza DATE,
  pagamento BOOLEAN DEFAULT FALSE,
  data_pagamento DATE,
  stato_id INTEGER REFERENCES stati_scadenze(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Fatture
CREATE TABLE fatture (
  id SERIAL PRIMARY KEY,
  numero_fattura VARCHAR(50) UNIQUE NOT NULL,
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
  data_modifica TIMESTAMP DEFAULT NOW()
);

-- Parametri fatturazione
CREATE TABLE parametri_fatturazione (
  id SERIAL PRIMARY KEY,
  anno INTEGER UNIQUE NOT NULL,
  percentuale DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Categorie planner
CREATE TABLE planner_categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3273dc',
  order_position INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

-- Task planner
CREATE TABLE planner_tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  description TEXT NOT NULL,
  day VARCHAR(20) NOT NULL,
  category VARCHAR(50) REFERENCES planner_categories(slug),
  week_start_date DATE NOT NULL,
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserimento dati di esempio
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
('Permesso di costruire', true, false);
```

### 4. Configura le variabili d'ambiente

Crea un file `.env` nella root del progetto:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Avvia l'applicazione

```bash
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:5173`

## 📱 Utilizzo

### Primo accesso
1. Vai su `/login`
2. Crea un account con email e password
3. Conferma l'email (se richiesto)
4. Accedi alla dashboard

### Funzionalità principali

#### Dashboard
- Visualizza statistiche in tempo reale
- Monitora pratiche aperte e scadenze
- Accesso rapido alle sezioni principali

#### Gestione Pratiche
- **Comune e Catasto**: Gestisci pratiche edilizie e catastali
- **APE**: Attestati di Prestazione Energetica
- **Varie**: Pratiche generiche personalizzabili

#### Contabilità
- Gestione fatture con calcoli automatici
- Tracking pagamenti e incassi
- Statistiche finanziarie

#### Planner
- Organizza le attività settimanali
- Drag & drop per riorganizzare task
- Categorie personalizzabili

#### Rubrica
- Gestisci contatti di clienti e fornitori
- Organizza per tipologie e appartenenze
- Ricerca avanzata

## 🔒 Sicurezza

- **Row Level Security (RLS)** attivato su tutte le tabelle
- **Autenticazione JWT** tramite Supabase
- **Validazione dati** con Zod
- **Sanitizzazione input** automatica

## 🚀 Deploy

### Vercel (Raccomandato)
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
# Carica la cartella dist/
```

### Manual Deploy
```bash
npm run build
# Carica il contenuto della cartella dist/ sul tuo server
```

## 🤝 Contribuire

1. Fork il progetto
2. Crea un branch per la feature (`git checkout -b feature/AmazingFeature`)
3. Commit le modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📝 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi il file `LICENSE` per i dettagli.

## 🆘 Supporto

Per supporto o domande:
- Apri un'issue su GitHub
- Contatta il team di sviluppo

## 🗺️ Roadmap

- [ ] **v1.1**: Export Excel avanzato
- [ ] **v1.2**: Sistema notifiche email
- [ ] **v1.3**: App mobile con React Native
- [ ] **v1.4**: Integrazione documenti PDF
- [ ] **v1.5**: Sistema backup automatico
- [ ] **v2.0**: Multi-tenancy per più studi
