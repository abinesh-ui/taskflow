-- ============================================================
-- TASKFLOW DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'admin' ELSE 'member' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- MASTER TABLES
-- ============================================================

-- Projects (top-level container)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_live BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments (belong to a project)
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Types
CREATE TABLE master_task_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Categories
CREATE TABLE master_task_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Priorities
CREATE TABLE master_priorities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  sort_weight INT NOT NULL DEFAULT 0,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Statuses
CREATE TABLE master_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INT DEFAULT 0,
  is_closed BOOLEAN DEFAULT FALSE,
  is_done BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASKS (tasks and subtasks in same table)
-- ============================================================

-- Sequence for task numbers
CREATE SEQUENCE task_no_seq START 1;

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_no TEXT NOT NULL UNIQUE DEFAULT 'T-' || LPAD(nextval('task_no_seq')::TEXT, 6, '0'),
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_type_id UUID REFERENCES master_task_types(id),
  category_id UUID REFERENCES master_task_categories(id),
  priority_id UUID REFERENCES master_priorities(id),
  assignee_id UUID REFERENCES profiles(id),
  status_id UUID NOT NULL REFERENCES master_statuses(id),
  title TEXT NOT NULL,
  description TEXT,
  planned_start_date DATE,
  planned_end_date DATE,
  planned_mins INT,
  actual_start_date DATE,
  actual_end_date DATE,
  actual_mins INT,
  position INT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_planned_dates CHECK (planned_end_date IS NULL OR planned_start_date IS NULL OR planned_end_date >= planned_start_date),
  CONSTRAINT chk_actual_dates CHECK (actual_end_date IS NULL OR actual_start_date IS NULL OR actual_end_date >= actual_start_date)
);

-- Index for fast lookups
CREATE INDEX idx_tasks_department ON tasks(department_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_status ON tasks(status_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);

-- ============================================================
-- STATUS HISTORY (Section 8 - TAT tracking)
-- ============================================================
CREATE TABLE task_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  task_no TEXT NOT NULL,
  from_status_id UUID REFERENCES master_statuses(id),
  to_status_id UUID NOT NULL REFERENCES master_statuses(id),
  changed_by UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_history_task ON task_status_history(task_id);
CREATE INDEX idx_status_history_task_no ON task_status_history(task_no);

-- Trigger: auto-record status changes
CREATE OR REPLACE FUNCTION record_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    INSERT INTO task_status_history (task_id, task_no, from_status_id, to_status_id, changed_by)
    VALUES (NEW.id, NEW.task_no, OLD.status_id, NEW.status_id, COALESCE(auth.uid(), NEW.created_by));
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_status_change
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION record_status_change();

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTACHMENTS
-- ============================================================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT,
  external_url TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- ============================================================
-- ALERT RULES
-- ============================================================
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAVED VIEWS
-- ============================================================
CREATE TABLE saved_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL CHECK (view_type IN ('list', 'board', 'calendar')),
  filters JSONB DEFAULT '{}',
  sort_config JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REPORTING VIEW (Section 12)
-- ============================================================
CREATE OR REPLACE VIEW v_tasks_report AS
SELECT
  t.id,
  t.task_no,
  t.title,
  t.parent_id,
  t.department_id,
  t.project_id,
  p.name AS project_name,
  d.name AS department_name,
  tt.name AS task_type_name,
  tc.name AS category_name,
  mp.name AS priority_name,
  mp.sort_weight AS priority_weight,
  ms.name AS status_name,
  ms.is_closed,
  ms.is_done,
  prof.full_name AS assignee_name,
  t.planned_start_date,
  t.planned_end_date,
  t.planned_mins,
  t.actual_start_date,
  t.actual_end_date,
  t.actual_mins,
  t.position,
  t.created_at,
  t.updated_at,
  -- Planned Month & Week (computed)
  CASE WHEN t.planned_start_date IS NOT NULL THEN
    TO_CHAR(t.planned_start_date, 'Mon') || ' - ' || CEIL(EXTRACT(DAY FROM t.planned_start_date) / 7.0)::INT::TEXT
  ELSE NULL END AS planned_month_week,
  -- Overdue Days (computed)
  CASE
    WHEN ms.is_closed = FALSE AND t.planned_end_date IS NOT NULL AND t.planned_end_date < CURRENT_DATE
    THEN (CURRENT_DATE - t.planned_end_date)
    ELSE 0
  END AS overdue_days
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN departments d ON t.department_id = d.id
LEFT JOIN master_task_types tt ON t.task_type_id = tt.id
LEFT JOIN master_task_categories tc ON t.category_id = tc.id
LEFT JOIN master_priorities mp ON t.priority_id = mp.id
LEFT JOIN master_statuses ms ON t.status_id = ms.id
LEFT JOIN profiles prof ON t.assignee_id = prof.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Projects: all authenticated can read, admin can modify
CREATE POLICY "Projects viewable by authenticated" ON projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Projects modifiable by authenticated" ON projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Departments: all authenticated can read, admin can modify
CREATE POLICY "Departments viewable by authenticated" ON departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Departments modifiable by authenticated" ON departments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Master tables: all can read, admin can modify
CREATE POLICY "Task types viewable" ON master_task_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Task types modifiable" ON master_task_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Task categories viewable" ON master_task_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Task categories modifiable" ON master_task_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Priorities viewable" ON master_priorities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Priorities modifiable" ON master_priorities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Statuses viewable" ON master_statuses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Statuses modifiable" ON master_statuses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tasks: all authenticated users
CREATE POLICY "Tasks viewable by authenticated" ON tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tasks insertable by authenticated" ON tasks
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Tasks updatable by authenticated" ON tasks
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Tasks deletable by authenticated" ON tasks
  FOR DELETE TO authenticated USING (true);

-- Status history: viewable by all, insert by system/trigger
CREATE POLICY "Status history viewable" ON task_status_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Status history insertable" ON task_status_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Comments
CREATE POLICY "Comments viewable" ON comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comments insertable" ON comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comments updatable by author" ON comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Attachments
CREATE POLICY "Attachments viewable" ON attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Attachments insertable" ON attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

-- Notifications: users see own
CREATE POLICY "Notifications own" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Notifications insertable" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Notifications updatable own" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Alert rules: admin only
CREATE POLICY "Alert rules viewable" ON alert_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Alert rules modifiable" ON alert_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Saved views: own only
CREATE POLICY "Saved views own" ON saved_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Saved views insertable" ON saved_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Saved views updatable" ON saved_views
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Saved views deletable" ON saved_views
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SEED DEFAULT MASTER DATA
-- ============================================================

-- Task Types
INSERT INTO master_task_types (name, position) VALUES
  ('100 mts', 1),
  ('200 mts', 2),
  ('400 mts', 3),
  ('Marathon', 4);

-- Task Categories
INSERT INTO master_task_categories (name, position) VALUES
  ('PKC Projects', 1),
  ('PKC Growth', 2),
  ('PKC Firm', 3);

-- Priorities
INSERT INTO master_priorities (name, color, sort_weight, position) VALUES
  ('Red hot', '#ef4444', 4, 1),
  ('Hot', '#f97316', 3, 2),
  ('Warm', '#eab308', 2, 3),
  ('Cold', '#3b82f6', 1, 4);

-- Statuses
INSERT INTO master_statuses (name, color, position, is_closed, is_done) VALUES
  ('YTI', '#6b7280', 1, FALSE, FALSE),
  ('WIP', '#3b82f6', 2, FALSE, FALSE),
  ('PMO Review', '#8b5cf6', 3, FALSE, FALSE),
  ('Client Pending', '#f59e0b', 4, FALSE, FALSE),
  ('ERP Pending', '#f97316', 5, FALSE, FALSE),
  ('Dropped', '#ef4444', 6, TRUE, FALSE),
  ('Hold', '#6b7280', 7, FALSE, FALSE),
  ('Done', '#10b981', 8, TRUE, TRUE);
