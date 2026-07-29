-- Fix: Make departments.project_id nullable so departments can be open (not locked to a project)
ALTER TABLE departments ALTER COLUMN project_id DROP NOT NULL;

-- Add color column if not exists
ALTER TABLE departments ADD COLUMN IF NOT EXISTS color TEXT;

-- Copy any departments from master_departments that don't exist in departments
INSERT INTO departments (name, is_active, position, color)
SELECT name, is_active, position, color FROM master_departments
WHERE name NOT IN (SELECT name FROM departments)
ON CONFLICT DO NOTHING;
