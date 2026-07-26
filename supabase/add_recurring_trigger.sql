-- Run in Supabase SQL Editor AFTER the above migration
-- This trigger auto-creates the next recurring task when status changes to closed/done

CREATE OR REPLACE FUNCTION handle_recurring_task()
RETURNS TRIGGER AS $$
DECLARE
  new_start DATE;
  new_end DATE;
  interval_days INT;
  new_task_id UUID;
  target_status_name TEXT;
BEGIN
  -- Only process if status changed
  IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Only process recurring tasks
  IF NEW.is_recurring IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Get the new status name
  SELECT name INTO target_status_name FROM master_statuses WHERE id = NEW.status_id;

  -- Check trigger condition
  IF NEW.recurrence_trigger = 'on_status_closed' THEN
    -- Only trigger if new status is_closed
    IF NOT EXISTS (SELECT 1 FROM master_statuses WHERE id = NEW.status_id AND is_closed = TRUE) THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.recurrence_trigger = 'on_status_done' THEN
    -- Only trigger if new status is_done
    IF NOT EXISTS (SELECT 1 FROM master_statuses WHERE id = NEW.status_id AND is_done = TRUE) THEN
      RETURN NEW;
    END IF;
  ELSE
    -- on_schedule is handled by cron, not this trigger
    RETURN NEW;
  END IF;

  -- Check if should still recur
  IF NEW.recur_forever IS NOT TRUE AND NEW.recurrence_end_date IS NOT NULL AND CURRENT_DATE > NEW.recurrence_end_date THEN
    RETURN NEW;
  END IF;

  -- Calculate interval in days
  CASE NEW.recurrence_type
    WHEN 'daily' THEN interval_days := 1 * COALESCE(NEW.recurrence_interval, 1);
    WHEN 'weekly' THEN interval_days := 7 * COALESCE(NEW.recurrence_interval, 1);
    WHEN 'monthly' THEN interval_days := 30 * COALESCE(NEW.recurrence_interval, 1);
    WHEN 'yearly' THEN interval_days := 365 * COALESCE(NEW.recurrence_interval, 1);
    WHEN 'days_after' THEN interval_days := COALESCE(NEW.recurrence_interval, 1);
    ELSE interval_days := 7;
  END CASE;

  -- Calculate new dates
  IF NEW.sync_due_date AND NEW.planned_end_date IS NOT NULL THEN
    new_end := NEW.planned_end_date + interval_days;
    new_start := CASE WHEN NEW.planned_start_date IS NOT NULL THEN NEW.planned_start_date + interval_days ELSE NULL END;
  ELSE
    new_end := CURRENT_DATE + interval_days;
    new_start := CURRENT_DATE;
  END IF;

  -- Get default YTI status
  -- Create new recurring task (clone of current)
  INSERT INTO tasks (
    title, parent_id, department_id, project_id, task_type_id, category_id,
    priority_id, assignee_id, status_id, description,
    planned_start_date, planned_end_date, planned_mins,
    position, created_by, is_recurring, recurrence_type, recurrence_interval,
    recurrence_trigger, recur_forever, recurrence_end_date, sync_due_date,
    parent_recurring_id, section_id, milestone_id
  )
  SELECT
    NEW.title, NEW.parent_id, NEW.department_id, NEW.project_id, NEW.task_type_id, NEW.category_id,
    NEW.priority_id, NEW.assignee_id,
    (SELECT id FROM master_statuses WHERE position = 1 LIMIT 1),
    NEW.description,
    new_start, new_end, NEW.planned_mins,
    NEW.position, NEW.created_by, TRUE, NEW.recurrence_type, NEW.recurrence_interval,
    NEW.recurrence_trigger, NEW.recur_forever, NEW.recurrence_end_date, NEW.sync_due_date,
    COALESCE(NEW.parent_recurring_id, NEW.id), NEW.section_id, NEW.milestone_id;

  -- Increment recurrence count
  NEW.recurrence_count := COALESCE(NEW.recurrence_count, 0) + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recurring_task ON tasks;
CREATE TRIGGER trg_recurring_task
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION handle_recurring_task();
