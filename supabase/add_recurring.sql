-- Run in Supabase SQL Editor

-- Add recurring fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly', 'days_after', NULL));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_interval INT DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_trigger TEXT CHECK (recurrence_trigger IN ('on_schedule', 'on_status_closed', 'on_status_done', NULL));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recur_forever BOOLEAN DEFAULT TRUE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_count INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sync_due_date BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_recurring_id UUID;
