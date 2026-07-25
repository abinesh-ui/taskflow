-- Run in Supabase SQL Editor
-- Automates actual_start_date and actual_end_date based on status changes

CREATE OR REPLACE FUNCTION auto_actual_dates()
RETURNS TRIGGER AS $$
DECLARE
  old_status_name TEXT;
  new_status_is_closed BOOLEAN;
BEGIN
  -- Only run if status actually changed
  IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Get old status name (to check if moving FROM YTI)
  SELECT name INTO old_status_name FROM master_statuses WHERE id = OLD.status_id;

  -- Get new status is_closed flag
  SELECT is_closed INTO new_status_is_closed FROM master_statuses WHERE id = NEW.status_id;

  -- ACTUAL START DATE: Set when moving FROM "YTI" (Yet To Initiate) to any other status
  -- Only set if not already set (first time only)
  IF old_status_name = 'YTI' AND NEW.actual_start_date IS NULL THEN
    NEW.actual_start_date = CURRENT_DATE;
  END IF;

  -- ACTUAL END DATE: Set when moving TO a closed status (Done, Cancel, Dropped, etc.)
  -- Reset if moving back to open status
  IF new_status_is_closed = TRUE THEN
    NEW.actual_end_date = CURRENT_DATE;
  ELSE
    -- If moving back to open status, clear actual_end_date
    IF OLD.actual_end_date IS NOT NULL THEN
      NEW.actual_end_date = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_auto_actual_dates ON tasks;
CREATE TRIGGER trg_auto_actual_dates
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION auto_actual_dates();
