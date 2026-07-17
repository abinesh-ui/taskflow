-- Run this in Supabase SQL Editor
-- Creates a separate master_departments table for department templates (no project_id required)

CREATE TABLE IF NOT EXISTS master_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE master_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master departments viewable" ON master_departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master departments modifiable" ON master_departments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with existing departments if any
INSERT INTO master_departments (name, color, position)
SELECT DISTINCT name, COALESCE(color, '#6b7280'), 0
FROM departments
ON CONFLICT DO NOTHING;
