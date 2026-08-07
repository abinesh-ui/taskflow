-- Update completion weights based on user's specification
-- YTI=0, WIP=0.5, PMO Review=0.5, Client Pending=0.5, ERP Pending=0.5
-- Dropped=1, Hold=1, Done=1, Future=0

UPDATE master_statuses SET completion_weight = 0   WHERE name ILIKE '%yet to initiate%' OR name ILIKE '%YTI%';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name ILIKE '%wip%' OR name ILIKE '%work in progress%';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name ILIKE '%pmo%';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name ILIKE '%client pending%';
UPDATE master_statuses SET completion_weight = 0.5 WHERE name ILIKE '%erp pending%';
UPDATE master_statuses SET completion_weight = 1   WHERE name ILIKE '%dropped%';
UPDATE master_statuses SET completion_weight = 1   WHERE name ILIKE '%hold%';
UPDATE master_statuses SET completion_weight = 1   WHERE name ILIKE '%done%';
UPDATE master_statuses SET completion_weight = 0   WHERE name ILIKE '%future%';

-- Verify
SELECT name, completion_weight FROM master_statuses ORDER BY position;
