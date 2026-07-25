-- Run in Supabase SQL Editor

-- 1. Add POA fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS poa_planned_mins INT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS poa_actual_mins INT;

-- 2. POA submissions table (one per user per day)
CREATE TABLE IF NOT EXISTS poa_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  submitted_date DATE NOT NULL,
  total_planned_mins INT DEFAULT 0,
  total_actual_mins INT DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, submitted_date)
);

ALTER TABLE poa_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "POA submissions viewable" ON poa_submissions;
DROP POLICY IF EXISTS "POA submissions modifiable" ON poa_submissions;
CREATE POLICY "POA submissions viewable" ON poa_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "POA submissions modifiable" ON poa_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. POA items (tasks selected for a day's POA)
CREATE TABLE IF NOT EXISTS poa_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poa_id UUID NOT NULL REFERENCES poa_submissions(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  planned_mins INT DEFAULT 0,
  actual_mins INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE poa_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "POA items viewable" ON poa_items;
DROP POLICY IF EXISTS "POA items modifiable" ON poa_items;
CREATE POLICY "POA items viewable" ON poa_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "POA items modifiable" ON poa_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
