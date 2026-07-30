-- Drop old FK if exists (it referenced profiles which was wrong)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigner_id_fkey;

-- Drop column if exists and recreate with correct reference
ALTER TABLE tasks DROP COLUMN IF EXISTS assigner_id;
ALTER TABLE tasks ADD COLUMN assigner_id UUID;

-- Clear any old values
UPDATE tasks SET assigner_id = NULL;
