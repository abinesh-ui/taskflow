-- Run this in Supabase SQL Editor
-- Archives all non-live projects under a single dedicated "Closed Projects"
-- macro project, so day-to-day views (which only show live projects) stay
-- clean, while the full task/subtask/milestone history remains browsable
-- under a dedicated "Closed Projects" screen.
--
-- This is a one-time data migration. Going forward, marking a project
-- "not live" in Settings > Projects automatically re-homes it under
-- "Closed Projects" (see MastersPage.tsx), and re-activating it restores
-- its original macro project automatically.

-- 1. Column to remember a project's macro project from before it was archived,
--    so re-activating it can restore the original grouping instead of leaving
--    it stuck under "Closed Projects" forever.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pre_archive_macro_project_id UUID REFERENCES master_macro_projects(id);

-- 2. Create the "Closed Projects" macro project if it doesn't already exist.
--    A high position (9999) keeps it sorted to the end of any position-ordered list.
INSERT INTO master_macro_projects (name, color, position, is_active)
SELECT 'Closed Projects', '#6b7280', 9999, TRUE
WHERE NOT EXISTS (SELECT 1 FROM master_macro_projects WHERE name = 'Closed Projects');

-- 3. Re-home every currently non-live project under it (unless it's already there),
--    remembering its prior macro project first so it can be restored later.
UPDATE projects
SET pre_archive_macro_project_id = CASE
      WHEN macro_project_id IS DISTINCT FROM (SELECT id FROM master_macro_projects WHERE name = 'Closed Projects')
      THEN macro_project_id ELSE pre_archive_macro_project_id END,
    macro_project_id = (SELECT id FROM master_macro_projects WHERE name = 'Closed Projects')
WHERE is_live = FALSE
  AND macro_project_id IS DISTINCT FROM (SELECT id FROM master_macro_projects WHERE name = 'Closed Projects');
