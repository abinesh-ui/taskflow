-- Run in Supabase SQL Editor

-- 1. Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_no TEXT NOT NULL UNIQUE DEFAULT 'MS-' || LPAD(nextval('task_no_seq')::TEXT, 4, '0'),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  status TEXT NOT NULL DEFAULT 'yet_to_initiate' CHECK (status IN ('yet_to_initiate', 'wip', 'done', 'closed')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Milestones viewable" ON milestones;
DROP POLICY IF EXISTS "Milestones modifiable" ON milestones;
CREATE POLICY "Milestones viewable" ON milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Milestones modifiable" ON milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Add milestone_id to tasks (mandatory link)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id);

-- 3. Create a separate sequence for milestone numbers
CREATE SEQUENCE IF NOT EXISTS milestone_no_seq START 1;

-- Update default to use the milestone sequence
ALTER TABLE milestones ALTER COLUMN milestone_no SET DEFAULT 'MS-' || LPAD(nextval('milestone_no_seq')::TEXT, 4, '0');
