-- Run this in Supabase SQL Editor
-- Creates macro_projects table (top-level container above projects)

CREATE TABLE IF NOT EXISTS master_macro_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE master_macro_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Macro projects viewable" ON master_macro_projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Macro projects modifiable" ON master_macro_projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add macro_project_id to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS macro_project_id UUID REFERENCES master_macro_projects(id);
