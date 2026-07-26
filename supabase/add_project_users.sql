-- Run in Supabase SQL Editor

-- Project-User mapping table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES master_members(id) ON DELETE CASCADE,
  UNIQUE(project_id, member_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Project members viewable" ON project_members;
DROP POLICY IF EXISTS "Project members modifiable" ON project_members;
CREATE POLICY "Project members viewable" ON project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Project members modifiable" ON project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
