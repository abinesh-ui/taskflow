-- Run in Supabase SQL Editor
-- Add completion weight to statuses (0 to 1)
ALTER TABLE master_statuses ADD COLUMN IF NOT EXISTS completion_weight NUMERIC(3,2) DEFAULT 0;

-- Update existing statuses with weights
UPDATE master_statuses SET completion_weight = 0 WHERE name = 'YTI';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name = 'WIP';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name = 'PMO Review';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name = 'Client Pending';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name = 'ERP Pending';
UPDATE master_statuses SET completion_weight = 1 WHERE name = 'Dropped';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name = 'Hold';
UPDATE master_statuses SET completion_weight = 1 WHERE name = 'Done';
UPDATE master_statuses SET completion_weight = 1 WHERE name = 'Cancel';
UPDATE master_statuses SET completion_weight = 1 WHERE name = 'Future';
