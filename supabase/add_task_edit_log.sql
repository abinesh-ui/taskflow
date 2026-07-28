-- Task Edit Log: tracks who edited what field on each task
CREATE TABLE IF NOT EXISTS task_edit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_no TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by UUID NOT NULL REFERENCES profiles(id),
  edited_by_name TEXT,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_edit_log_task ON task_edit_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_edit_log_task_no ON task_edit_log(task_no);
CREATE INDEX IF NOT EXISTS idx_task_edit_log_edited_at ON task_edit_log(edited_at DESC);

-- RLS
ALTER TABLE task_edit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Task edit log viewable" ON task_edit_log;
CREATE POLICY "Task edit log viewable" ON task_edit_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Task edit log insertable" ON task_edit_log;
CREATE POLICY "Task edit log insertable" ON task_edit_log FOR INSERT TO authenticated WITH CHECK (true);
