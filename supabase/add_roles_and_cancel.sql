-- Run this in Supabase SQL Editor
-- 1. Add role column to master_members (admin, team_leader, member)
ALTER TABLE master_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'team_leader', 'member'));

-- 2. Add "Cancel" status
INSERT INTO master_statuses (name, color, position, is_closed, is_done)
VALUES ('Cancel', '#dc2626', 9, TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- 3. Update existing members to have role (first member = admin)
-- You can manually set roles in the Members master UI after this runs
