-- Add assigner_id field to tasks (who assigned/created the task for that person)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigner_id UUID REFERENCES profiles(id);
