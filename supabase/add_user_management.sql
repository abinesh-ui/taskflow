-- Run in Supabase SQL Editor

-- 1. Add role and email to master_members (converting members to users)
ALTER TABLE master_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE master_members ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE master_members DROP CONSTRAINT IF EXISTS master_members_role_check;
ALTER TABLE master_members DROP COLUMN IF EXISTS role;
ALTER TABLE master_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'team_member' CHECK (role IN ('admin', 'manager', 'team_leader', 'team_member'));
ALTER TABLE master_members ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE master_members ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 2. Role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'team_leader', 'team_member')),
  permission TEXT NOT NULL,
  allowed BOOLEAN DEFAULT TRUE,
  UNIQUE(role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Role permissions viewable" ON role_permissions;
DROP POLICY IF EXISTS "Role permissions modifiable" ON role_permissions;
CREATE POLICY "Role permissions viewable" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Role permissions modifiable" ON role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Seed default permissions
INSERT INTO role_permissions (role, permission, allowed) VALUES
  ('admin', 'create_task', TRUE),
  ('admin', 'edit_task', TRUE),
  ('admin', 'delete_task', TRUE),
  ('admin', 'cancel_task', TRUE),
  ('admin', 'change_status', TRUE),
  ('admin', 'manage_masters', TRUE),
  ('admin', 'manage_users', TRUE),
  ('admin', 'export_data', TRUE),
  ('manager', 'create_task', TRUE),
  ('manager', 'edit_task', TRUE),
  ('manager', 'delete_task', FALSE),
  ('manager', 'cancel_task', TRUE),
  ('manager', 'change_status', TRUE),
  ('manager', 'manage_masters', TRUE),
  ('manager', 'manage_users', FALSE),
  ('manager', 'export_data', TRUE),
  ('team_leader', 'create_task', TRUE),
  ('team_leader', 'edit_task', TRUE),
  ('team_leader', 'delete_task', FALSE),
  ('team_leader', 'cancel_task', TRUE),
  ('team_leader', 'change_status', TRUE),
  ('team_leader', 'manage_masters', FALSE),
  ('team_leader', 'manage_users', FALSE),
  ('team_leader', 'export_data', TRUE),
  ('team_member', 'create_task', TRUE),
  ('team_member', 'edit_task', FALSE),
  ('team_member', 'delete_task', FALSE),
  ('team_member', 'cancel_task', FALSE),
  ('team_member', 'change_status', TRUE),
  ('team_member', 'manage_masters', FALSE),
  ('team_member', 'manage_users', FALSE),
  ('team_member', 'export_data', FALSE)
ON CONFLICT (role, permission) DO NOTHING;
