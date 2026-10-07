-- Run this in Supabase SQL Editor
-- Archives all non-live projects under a single dedicated "Closed Projects"
-- macro project, so day-to-day views (which only show live projects) stay
-- clean, while the full task history remains browsable under that one macro.
--
-- This is a one-time data migration. Going forward, marking a project
-- "not live" in Settings > Projects automatically re-homes it under
-- "Closed Projects" (see MastersPage.tsx) — this script only needs to run
-- once to catch up any projects that were already marked not-live before
-- this feature existed.

-- 1. Create the "Closed Projects" macro project if it doesn't already exist.
--    A low position (9999) keeps it sorted to the end of any position-ordered list.
INSERT INTO master_macro_projects (name, color, position, is_active)
SELECT 'Closed Projects', '#6b7280', 9999, TRUE
WHERE NOT EXISTS (SELECT 1 FROM master_macro_projects WHERE name = 'Closed Projects');

-- 2. Re-home every currently non-live project under it (unless it's already there).
UPDATE projects
SET macro_project_id = (SELECT id FROM master_macro_projects WHERE name = 'Closed Projects')
WHERE is_live = FALSE
  AND macro_project_id IS DISTINCT FROM (SELECT id FROM master_macro_projects WHERE name = 'Closed Projects');
