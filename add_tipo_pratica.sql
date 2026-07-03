-- Nuova tabella tipi_pratica per gestire i valori configurabili del campo "tipo pratica"
CREATE TABLE IF NOT EXISTS tipi_pratica (
  id SERIAL PRIMARY KEY,
  descrizione VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tipi_pratica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tipi_pratica" ON tipi_pratica FOR ALL USING (true);

-- Aggiunge la colonna tipo_pratica (opzionale) alla tabella comune_catasto
ALTER TABLE comune_catasto ADD COLUMN IF NOT EXISTS tipo_pratica INTEGER REFERENCES tipi_pratica(id);

COMMENT ON COLUMN comune_catasto.tipo_pratica IS 'Tipo di pratica (riferimento a tipi_pratica.id)';
