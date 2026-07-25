-- Run in Supabase SQL Editor
INSERT INTO role_permissions (role, permission, allowed) VALUES
  ('admin', 'edit_poa', TRUE),
  ('manager', 'edit_poa', TRUE),
  ('team_leader', 'edit_poa', FALSE),
  ('team_member', 'edit_poa', FALSE)
ON CONFLICT (role, permission) DO NOTHING;
