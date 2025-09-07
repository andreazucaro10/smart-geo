// Tipi base per le tabelle del database

export interface Profile {
  id: string;
  username: string;
  created_at: string;
}

export interface ParametriAzienda {
  id: number;
  denominazione: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  nazione?: string;
  partita_iva?: string;
  codice_fiscale?: string;
  codice_ape?: string;
  created_at: string;
  updated_at: string;
}

export interface StatoGenerale {
  id: number;
  descrizione: string;
  colore: string;
  ordinamento: number;
  created_at: string;
  updated_at: string;
}

export interface StatoApe {
  id: number;
  descrizione: string;
  colore: string;
  ordinamento: number;
  created_at: string;
  updated_at: string;
}

export interface StatoScadenza {
  id: number;
  descrizione: string;
  colore: string;
}

export interface TipoIncarico {
  id: number;
  descrizione: string;
  comune: boolean;
  catasto: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipologiaContatto {
  id: number;
  nome: string;
  descrizione?: string;
  created_at: string;
  updated_at: string;
}

export interface TipologiaAppartenenza {
  id: number;
  nome: string;
  created_at: string;
  updated_at: string;
}

export interface ComuneCatasto {
  id: number;
  committente: string;
  indirizzo?: string;
  citta?: string;
  proprieta?: string;
  proprieta2?: string;
  mail?: string;
  telefono?: string;
  telefono2?: string;
  note?: string;
  comune: boolean;
  catasto: boolean;
  fine_lavori: boolean;
  stato?: number;
  pagamento: boolean;
  tipo_incarico?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  stato_info?: StatoGenerale;
  tipo_incarico_info?: TipoIncarico;
}

export interface Ape {
  id: number;
  committente: string;
  proprieta?: string;
  indirizzo?: string;
  citta?: string;
  mail?: string;
  telefono?: string;
  note?: string;
  registrazione?: number;
  progressivo?: string;
  pagamento: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  registrazione_info?: StatoApe;
}

export interface Varie {
  id: number;
  committente: string;
  proprieta?: string;
  indirizzo?: string;
  citta?: string;
  mail?: string;
  telefono?: string;
  note?: string;
  registrazione?: number;
  tipo_incarico_id?: number;
  pagamento: boolean;
  created_at: string;
  // Joined fields
  registrazione_info?: StatoGenerale;
  tipo_incarico_info?: TipoIncarico;
}

export interface Rubrica {
  id: number;
  nominativo: string;
  tipologia?: number;
  telefono?: string;
  email?: string;
  ufficio?: string;
  tipologia_id?: number;
  appartenenza_id?: number;
  disattivato: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  tipologia_info?: TipologiaContatto;
  appartenenza_info?: TipologiaAppartenenza;
}

export interface Scadenza {
  id: number;
  descrizione: string;
  spese: number;
  data_scadenza?: string;
  pagamento: boolean;
  data_pagamento?: string;
  stato_id?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  stato_info?: StatoScadenza;
}

export interface Fattura {
  id: number;
  numero_fattura: string;
  mese_fattura: string;
  anno_fattura?: number;
  onorario: number;
  spese: number;
  bolli: number;
  cassa_geometri: number;
  tasse: number;
  fatturato: number;
  guadagno_netto: number;
  data_creazione: string;
  data_modifica: string;
}

export interface FatturaNonContabilizzata {
  id: number;
  nome: string;
  totale: number;
  spese: number;
  note?: string;
  data_emissione?: string;
  data_creazione: string;
  data_modifica: string;
}

export interface ParametroFatturazione {
  id: number;
  anno: number;
  percentuale: number;
  created_at: string;
  updated_at: string;
}

export interface PlannerCategory {
  id: number;
  slug: string;
  name: string;
  color: string;
  order_position: number;
  active: boolean;
}

export interface PlannerTask {
  id: number;
  user_id?: string;
  description: string;
  day: string; // monday, tuesday, etc.
  category?: string;
  week_start_date: string;
  order_position: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_info?: PlannerCategory;
}

// Tipi per i form e UI
export interface LoginFormData {
  email: string;
  password: string;
}

export interface DashboardStats {
  pratiche_comune_aperte: number;
  pratiche_completate_non_pagate: number;
  ape_completate_non_pagate: number;
  varie_completate_non_pagate: number;
  scadenze_in_arrivo: number;
}

export interface TableFilter {
  field: string;
  value: any;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in';
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SortInfo {
  field: string;
  direction: 'asc' | 'desc';
}

// Tipi per l'autenticazione
export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

// Tipi per le notifiche
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

// Tipi per le modalità
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// Tipi per i componenti della tabella
export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
}

export interface TableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  onSort?: (sort: SortInfo) => void;
  onFilter?: (filters: TableFilter[]) => void;
  rowKey?: keyof T | ((record: T) => string);
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
}

// Tipi per l'export
export interface ExportOptions {
  format: 'xlsx' | 'csv' | 'pdf';
  filename?: string;
  columns?: string[];
  includeHeaders?: boolean;
}

// Tipi per il planner
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface WeekData {
  startDate: Date;
  endDate: Date;
  days: WeekDay[];
}

export interface DragDropResult {
  draggableId: string;
  source: {
    droppableId: string;
    index: number;
  };
  destination?: {
    droppableId: string;
    index: number;
  };
} 