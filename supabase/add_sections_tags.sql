-- Run this in Supabase SQL Editor

-- 1. Task Sections master (Team, Client, PKC PMO, External)
CREATE TABLE IF NOT EXISTS master_task_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE master_task_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Task sections viewable" ON master_task_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Task sections modifiable" ON master_task_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default sections
INSERT INTO master_task_sections (name, color, position) VALUES
  ('Team', '#3b82f6', 1),
  ('Client', '#10b981', 2),
  ('PKC PMO', '#8b5cf6', 3),
  ('External', '#f59e0b', 4);

-- 2. Add section_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES master_task_sections(id);

-- 3. Tags master
CREATE TABLE IF NOT EXISTS master_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE master_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tags viewable" ON master_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tags modifiable" ON master_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Project-Tags mapping (which tags belong to which project)
CREATE TABLE IF NOT EXISTS project_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES master_tags(id) ON DELETE CASCADE,
  UNIQUE(project_id, tag_id)
);

ALTER TABLE project_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project tags viewable" ON project_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Project tags modifiable" ON project_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
