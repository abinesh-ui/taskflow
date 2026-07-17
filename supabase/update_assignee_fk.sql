-- Run this in Supabase SQL Editor
-- Drops the foreign key on assignee_id so it can reference master_members instead of profiles

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;
