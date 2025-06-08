-- Script per sistemare le policy RLS per le tabelle del planner
-- Eseguire questo script nel Supabase SQL Editor

-- Elimina e ricrea le policy per planner_categories
DROP POLICY IF EXISTS "Users can manage own planner_categories" ON planner_categories;

CREATE POLICY "Users can view own planner_categories" ON planner_categories 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planner_categories" ON planner_categories 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planner_categories" ON planner_categories 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planner_categories" ON planner_categories 
FOR DELETE USING (auth.uid() = user_id);

-- Verifica che RLS sia abilitato
ALTER TABLE planner_categories ENABLE ROW LEVEL SECURITY;

-- Elimina e ricrea le policy per planner_tasks
DROP POLICY IF EXISTS "Users can manage own planner_tasks" ON planner_tasks;

CREATE POLICY "Users can view own planner_tasks" ON planner_tasks 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planner_tasks" ON planner_tasks 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planner_tasks" ON planner_tasks 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planner_tasks" ON planner_tasks 
FOR DELETE USING (auth.uid() = user_id);

-- Verifica che RLS sia abilitato
ALTER TABLE planner_tasks ENABLE ROW LEVEL SECURITY;

-- Verifica che esistano categorie di default per l'utente corrente
INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'riunioni', 'Riunioni', '#ef4444', 1
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM planner_categories 
  WHERE user_id = auth.uid() AND slug = 'riunioni'
);

INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'sopralluoghi', 'Sopralluoghi', '#3b82f6', 2
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM planner_categories 
  WHERE user_id = auth.uid() AND slug = 'sopralluoghi'
);

INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'uffici', 'Uffici', '#10b981', 3
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM planner_categories 
  WHERE user_id = auth.uid() AND slug = 'uffici'
);

INSERT INTO planner_categories (user_id, slug, name, color, order_position) 
SELECT auth.uid(), 'studio', 'Studio', '#f59e0b', 4
WHERE auth.uid() IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM planner_categories 
  WHERE user_id = auth.uid() AND slug = 'studio'
);

-- Query di test per verificare che tutto funzioni
-- (decommentare per testare)
/*
SELECT 'Categorie trovate:' as test, count(*) as count 
FROM planner_categories 
WHERE user_id = auth.uid();

SELECT 'Tasks trovate:' as test, count(*) as count 
FROM planner_tasks 
WHERE user_id = auth.uid();
*/ 