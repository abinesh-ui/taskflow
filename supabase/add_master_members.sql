-- Run this in Supabase SQL Editor
-- Creates master_members table for team member names with auto-assigned colors

CREATE TABLE IF NOT EXISTS master_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE master_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master members viewable" ON master_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master members modifiable" ON master_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
