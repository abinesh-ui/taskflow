# Functional Requirements Document (FRD)
## Project & Task Management App — Web + Mobile ("TaskFlow")

**Prepared for:** Akila (Mtandt Group / PKC)
**Purpose:** A complete, build-ready specification to upload into Kiro IDE so it can generate a cloud-based **web app** and an installable **mobile app**, with a ClickUp-style interface and the exact fields, rules, and reports listed below — at zero hosting cost.

---

## 0. HOW TO USE THIS DOCUMENT IN KIRO

1. Save this file as `TASKFLOW_FRD.md`.
2. In Kiro, start a new project, upload/paste this document, and say:
   > "Build this app exactly as specified in TASKFLOW_FRD.md. Use the recommended tech stack in Section 3. Build in the phase order in Section 15. Ask me for the Supabase keys when needed."
3. **Build Phase 1 first and get it fully working before Phase 2.** A working core beats a broken everything.

> **Confirmed hierarchy:** The navigable hierarchy is **Project → Department → Task → Subtask** — Project is the top container, a Department belongs to a Project, a Task belongs to a Department, and a Subtask belongs to a Task. "Task Category" (PKC Projects / PKC Growth / PKC Firm) is a **dropdown field on the task**, not a folder level.

---

## 1. OVERVIEW & SCALE

A ClickUp-inspired internal tool for managing projects and tasks with rich fields, status-change time tracking (TAT), configurable master data, list + Kanban views, multi-level sorting, alerts, and reporting.

**Scale (small, well within free limits):** ~10 live projects at once; ~200 tasks/project/month; up to ~20 subtasks/task (~4,000 subtasks/project/month); small internal team.

---

## 2. UI REFERENCE

Model the interface on the provided ClickUp screenshot:
- **Left sidebar:** collapsible tree — **Projects** at the top level, and under each Project its **Departments**. A "+" to add Projects and Departments.
- **Top of the work area:** the current location breadcrumb (e.g. *Abinesh PKC Growth / MC dept*), and a **view switcher** (List, Board/Kanban, Calendar) plus a filter bar and a **+ Task** button on the right.
- **List view:** tasks grouped by Status (collapsible groups showing a count), with columns for the task fields, an assignee avatar, status pill, and dates. Overdue dates shown in red.
- Build this look with your **own branding/name** ("TaskFlow" or your choice) and your own colours. Do **not** reuse ClickUp's logo, name, or copyrighted assets — replicate the *layout and functionality*, not the brand.

---

## 3. RECOMMENDED FREE TECH STACK

- **Frontend (web + mobile):** React + TypeScript (Vite), Tailwind CSS, shadcn/ui components, dnd-kit (drag-and-drop for Kanban), TanStack Query.
- **Backend / Database / Auth / File storage / Realtime:** **Supabase** (Postgres). One Supabase project hosts everything, including all your projects and departments as data.
- **Mobile:** the **same** React app configured as an installable **PWA** (`vite-plugin-pwa`). Native store apps are an optional paid future step (Section 14.3).
- **Email sending (for alerts):** a free email API — **Resend** (free tier) or **Brevo** (free tier). Used by a scheduled job to send reminders.
- **Scheduled jobs (reminders, keep-alive, backups):** Supabase scheduled Edge Functions and/or free GitHub Actions cron.
- **Reporting:** **Looker Studio** (formerly Google Data Studio) connects to the Supabase Postgres database via its native PostgreSQL connector (Section 12).
- **Hosting:** Vercel (free) for the web/PWA; Supabase hosts the backend.

---

## 4. HIERARCHY & NAVIGATION

Structural levels, top to bottom (each is a real record you can create, rename, archive):

1. **Project** — the **top container**. Only **live** projects (see masters) are selectable when creating departments/tasks. Defined/managed in masters.
2. **Department** — belongs to a **Project** (e.g. "MC dept" under a project).
3. **Task** — belongs to a **Department**. Its Project is inherited from that Department's Project.
4. **Subtask** — belongs to a **Task**. **A subtask has the exact same fields as a task** (Section 6, requirement from point 4).

**Two ways to add a task (point 4):**
- (a) **In context:** navigate into a Project → Department and click **+ Task** — the Project and Department are auto-filled.
- (b) **Global add:** click **+ Task** from anywhere, pick the **Project** (dropdown lists **only live projects**), then pick the **Department** within that project.

> The task stores its `department_id`; the `project_id` is inherited from the department. For fast filtering and reporting, also keep a denormalised `project_id` on the task, kept in sync with the department's project.

---

## 5. MASTER DATA (CONFIGURABLE DROPDOWNS)

All dropdown fields are driven by editable master tables. Provide a **Masters / Settings** admin screen to add, rename, reorder, recolour, and activate/deactivate each value (deactivating hides it from new dropdowns but keeps history intact). Seed each master with the default values below.

| Master | Default values | Notes |
|---|---|---|
| **Task Types** | 100 mts, 200 mts, 400 mts, Marathon | Field #2. Ordered; used as one level of the multi-sort ("task run"). |
| **Task Categories** | PKC Projects, PKC Growth, PKC Firm | Field #3. |
| **Projects** | *(user-defined)* | Field #4. **Top-level container.** Each project has an **is_live** flag; only live projects appear in the task's Project dropdown. |
| **Priorities** | Red hot, Hot, Warm, Cold | Field #5. Each has a **colour** and a **sort_weight** (Red hot = highest) for sorting. |
| **Assignees (Users)** | *(team members)* | Field #6. From the app's user list. |
| **Statuses** | YTI, WIP, PMO Review, Client Pending, ERP Pending, Dropped, Hold, Done | Field #7. Each has colour, **position** (board column order), **is_closed** flag, **is_done** flag. Defaults: mark **Done** as is_done=true & is_closed=true; mark **Dropped** as is_closed=true. All others open. |
| **Departments** | *(user-defined)* | Section 4 container; **belongs to a Project** (has `project_id`). |

---

## 6. TASK & SUBTASK FIELDS (identical for both)

Every field below applies to **both tasks and subtasks** (point 4). "Auto" = system-calculated, read-only.

| # | Field | Type | Rules |
|---|---|---|---|
| 1 | **Task No** | Auto, unique | Human-readable sequence, e.g. `T-000123`. Never reused. Subtasks also get their own Task No and reference the parent. Used as the key for TAT/status history (point 11). |
| 2 | **Task Type** | Dropdown (master: Task Types) | 100 mts / 200 mts / 400 mts / Marathon. |
| 3 | **Task Category** | Dropdown (master: Categories) | PKC Projects / PKC Growth / PKC Firm. |
| 4 | **Project** | Dropdown (master: Projects, live only) | Auto-filled if added in-context; else selected. |
| 5 | **Priority** | Dropdown (master: Priorities) | Red hot / Hot / Warm / Cold, colour-coded. |
| 6 | **Assigned To** | Dropdown (master: Users) | Single assignee (per your spec). *(Multiple assignees possible later if wanted.)* |
| 7 | **Status** | Dropdown (master: Statuses) | YTI / WIP / PMO Review / Client Pending / ERP Pending / Dropped / Hold / Done. Every change is timestamped (Section 8, point 11). |
| 8 | **Planned Start Date** | Date (calendar) | |
| 9 | **Planned End Date** | Date (calendar) | Must be ≥ Planned Start Date. |
| 10 | **Planned Month & Week** | **Auto** (from #8) | Format `MMM - W`, e.g. `Aug - 2` = August, 2nd week. See formula in 6.1. |
| 11 | **Planned Mins** | Number | Planned effort in minutes. |
| 12 | **Actual Start Date** | Date (calendar) | |
| 13 | **Actual End Date** | Date (calendar) | Must be ≥ Actual Start Date. |
| 14 | **Actual Mins** | Number | **Mandatory when the task is moved to a closed/done status** (Section 7). |
| 15 | **Overdue Days** | **Auto** (calculated) | Only for tasks **not** in a closed/done status. See formula in 6.2. |

### 6.1 Auto field — Planned Month & Week
From **Planned Start Date**:
- Month = 3-letter month name (Jan…Dec).
- Week-of-month = `CEIL(day_of_month / 7)` → days 1–7 = week 1, 8–14 = 2, 15–21 = 3, 22–28 = 4, 29–31 = 5.
- Display: `"<Month> - <Week>"`, e.g. `Aug - 2`.
- *(This rule is configurable; note it if you prefer ISO week numbering.)*

### 6.2 Auto field — Overdue Days
- Applies **only** when the task's Status has `is_closed = false` (i.e. not Done, not Dropped).
- If `Planned End Date < today`: `Overdue Days = today − Planned End Date` (whole days). Otherwise `0` (blank).
- Because it depends on "today", compute it **on read** (database view or client-side), never store a stale value.

---

## 7. BUSINESS RULES / CONTROLS

- **BR-1 (point 5):** A task can be moved to a **closed/done** status **only if every one of its subtasks is already in a closed/done status.** If not, block the change and show which subtasks are still open.
- **BR-2 (point 3, field 14):** When moving any task/subtask to a closed/done status, **Actual Mins is mandatory** — block closing until it's filled.
- **BR-3:** Planned/Actual End Date cannot be earlier than the matching Start Date.
- **BR-4:** Only **live** projects appear in the Project dropdown.
- **BR-5:** Deactivating a master value hides it from new selections but preserves it on existing records and in history.
- **BR-6:** Permissions enforced at the database level via Supabase **Row Level Security**, not just in the UI.

---

## 8. STATUS-CHANGE TIMESTAMPS & TAT (point 11)

- Maintain a **`task_status_history`** table. **Every** status change inserts a row: `task_no`, `from_status`, `to_status`, `changed_by`, `changed_at` (exact timestamp).
- Implement via a **database trigger** on the tasks table so it is automatic and cannot be bypassed.
- This enables **Turnaround Time (TAT)** measurement — e.g. time spent in each status, time from creation to Done, time in "Client Pending", etc. These calculations power both in-app reports and Looker Studio (Section 12).
- Provide a **status timeline** on the task detail panel (each status with entry time and duration).

---

## 9. VIEWS, FILTERS & SORTING

### 9.1 Views (point 6)
**Only three view types are required — List, Board, and Calendar. Do NOT build Gantt, Timeline, Table, or any other view type.**
- **List view** — default; tasks grouped by Status (collapsible groups with counts), columns for the key fields, assignee avatar, status pill, dates (overdue in red). Matches the screenshot.
- **Board / Kanban view** — one column per Status (ordered by the status master `position`); task cards; **drag a card between columns to change status** (respecting BR-1 and BR-2); drag to reorder within a column.
- **Calendar view** — a monthly calendar placing tasks on their dates (default: Planned End Date; allow switching to Planned Start Date). Drag a task to another day to reschedule that date. Colour cards by Priority or Status.
- View switcher at the top of every Department/Project offers exactly these three: **List | Board | Calendar**.

### 9.2 Filters (point 6 — "all fields filters at top")
A filter bar above the list/board allowing filtering by **any field**: Task Type, Category, Project, Priority, Assignee, Status, Planned/Actual date ranges, Planned/Actual Mins ranges, and Overdue (e.g. "overdue only", "due this week"). Multiple filters combine (AND). Users can save filter sets.

### 9.3 Sorting & the multi-level "Priority" view (points 6 & 7)
- Every column is individually sortable (asc/desc) — full slice-and-dice.
- Provide a **Multi-Level Sort** builder: the user adds an **ordered list of sort keys**, each asc/desc, and can reorder them. Example saved view "**Priority Board**":
  1. **Priority** (Red hot → Hot → Warm → Cold, via `sort_weight`)
  2. **Overdue Days** (highest first)
  3. **Task Type / "run"** (100 mts → … → Marathon, via master order)
- Users can create and save multiple such custom views.

---

## 10. ALERTS & REMINDERS (point 9)

- **Configurable alert rules** (admin screen), for example:
  - X days/hours **before Planned End Date**.
  - **On overdue** (and daily while overdue).
  - **On assignment** to a user.
  - **On status change** into chosen statuses (e.g. Client Pending, PMO Review).
- **Channels:** **in-app notifications** (bell icon + list) **and email**.
- **Delivery:** a **scheduled job** (Supabase scheduled Edge Function or GitHub Actions cron) runs at a set interval, evaluates the rules, writes in-app notifications, and sends emails via the free email API (Resend/Brevo).
- Each user can manage their own notification preferences.

---

## 11. DATA MODEL (TABLES FOR KIRO)

IDs are UUIDs unless noted; timestamps default to now. Add Row Level Security to every table.

**Masters:** `projects` (top level, with `is_live`), `departments` (with `project_id` → its parent project), `master_task_types`, `master_task_categories`, `master_priorities` (with `color`, `sort_weight`), `master_statuses` (with `color`, `position`, `is_closed`, `is_done`).

**Users:** `profiles` (id = auth user, `full_name`, `email`, `avatar_url`, `role` = admin/member/viewer).

**`tasks`** (holds tasks **and** subtasks):
`id`, `task_no` (auto sequence), `parent_id` (null = top-level task; set = subtask), `department_id` (its parent department), `project_id` (denormalised from the department, for filtering/reporting), `task_type_id`, `category_id`, `priority_id`, `assignee_id`, `status_id`, `title`, `description`, `planned_start_date`, `planned_end_date`, `planned_mins`, `actual_start_date`, `actual_end_date`, `actual_mins`, `position` (for manual/Kanban ordering), `created_by`, `created_at`, `updated_at`.
- Computed on read: `planned_month_week` (6.1), `overdue_days` (6.2).

**`task_status_history`** (Section 8): `id`, `task_id`, `task_no`, `from_status_id`, `to_status_id`, `changed_by`, `changed_at`.

**Supporting (optional but recommended):** `comments` (`task_id`, `user_id`, `body`, `created_at`); `attachments` (`task_id`, `file_name`, `storage_path` **or** `external_url`, `size_bytes`, `uploaded_by`); `notifications` (`user_id`, `task_id`, `type`, `message`, `read`, `created_at`); `alert_rules` (config for Section 10).

**Reporting view:** a database **view** (e.g. `v_tasks_report`) that joins tasks with master names and adds computed `planned_month_week`, `overdue_days`, and per-status TAT durations — this is the clean surface for Looker Studio.

---

## 12. REPORTING — LOOKER STUDIO CONNECTION (point 10)

- Supabase is a standard **PostgreSQL** database, and Looker Studio has a **native PostgreSQL connector**, so reports/insights connect directly — no data export needed.
- Setup: in Looker Studio → *Add data* → *PostgreSQL* → enter the Supabase host, port, database, and a read-only DB user's credentials (use Supabase's connection details / pooler host).
- **Recommended:** create a **read-only database role** for Looker Studio and point it at the `v_tasks_report` view and a TAT view, so reporting can't change data and gets clean, ready-made columns (overdue days, planned month/week, time-in-status, etc.).
- This supports dashboards for TAT, overdue analysis, workload by assignee, tasks by category/priority, and completion trends.

---

## 13. NON-FUNCTIONAL REQUIREMENTS

- **Security:** RLS everywhere; users only see permitted departments/projects; never expose the Supabase service-role key in the frontend.
- **Responsive:** every screen works on desktop, tablet, and phone.
- **Performance:** list/board load < ~2s for a few thousand tasks; paginate/lazy-load large lists.
- **Reliability (free tier):** daily **keep-alive ping** so the free database never pauses; **weekly backup** export (no auto-backups on free tier).
- **Cost guardrail:** nothing may require a paid tier; if a feature would, flag it instead of enabling it.

---

## 14. PLATFORMS

### 14.1 Web
Full-featured browser app (the primary experience).

### 14.2 Mobile (free) — PWA
Same app installable on Android/iOS via "Add to Home Screen": app icon, full-screen, offline app-shell, touch-first layout (bottom nav: Home / Projects / My Tasks / Notifications), floating **+** to add a task, and the core actions (view, edit, change status, comment, complete).

### 14.3 Native store app (optional, later, paid)
The same logic can later be wrapped with React Native (Expo) or Capacitor for the Apple/Google stores — this incurs store fees (~$99/yr Apple, ~$25 once Google). Phase 4, not now.

---

## 15. BUILD ORDER (PHASES)

**Phase 1 — Core (build and ship first)**
1. Supabase setup: all tables (Section 11) + Row Level Security + status trigger (Section 8).
2. Auth (login / signup / logout / password reset).
3. Masters/Settings screen (Section 5) with seeded defaults.
4. Sidebar tree: create/rename **Projects** (with live flag), then **Departments** under each Project.
5. Tasks + subtasks with **all 15 fields**, auto Task No, auto Planned Month/Week, auto Overdue Days.
6. Controls BR-1 (close only if subtasks closed) and BR-2 (Actual Mins mandatory on close).
7. **List view** (grouped by status), **Board/Kanban** (drag to change status), and **Calendar view** (drag to reschedule). These are the only three views.
8. Filters on all fields + single-column sorting.

**Phase 2 — Power features**
9. **Multi-level sort builder** + saved custom views (incl. the "Priority Board" example).
10. Status history timeline on the task + basic in-app **TAT** report.
11. **Alerts** (in-app + email) with the scheduled job.
12. PWA + mobile layout.
13. Keep-alive ping + weekly backup.

**Phase 3 — Reporting & extras**
14. `v_tasks_report` + TAT views; **Looker Studio** connection with a read-only role.
15. Comments, attachments, notifications preferences, CSV export.

---

## 16. SETUP CHECKLIST (plain-English, non-technical)

1. **Supabase** (supabase.com, free) → *New Project* → name it, set a strong DB password (save it), choose a region near India (Mumbai/Singapore). Wait ~2 min.
2. *Settings → API* → copy the **Project URL** and **anon public key**; paste into Kiro when asked.
3. **Vercel** (vercel.com, free) → sign in with GitHub → connect the project to publish it → you get a free web address (e.g. `taskflow.vercel.app`).
4. On your phone, open that address → browser menu → **Add to Home Screen** to install the mobile app.
5. **Email alerts:** create a free **Resend** (or Brevo) account → copy its API key → give it to Kiro when setting up alerts.
6. **Looker Studio:** in Supabase *Settings → Database*, find the connection details; in Looker Studio add a PostgreSQL data source using a read-only user.

> You never manage a server. Supabase = your cloud database; Vercel = your cloud web host; both free at your scale.

---

## 17. PHASE 1 ACCEPTANCE CHECKLIST ("done" = all true)

- [ ] Login/signup/logout work; logged-out users see nothing.
- [ ] Masters editable (Task Types, Categories, Priorities, Statuses, Projects w/ live flag, Departments).
- [ ] Sidebar: create Projects, then Departments under a Project; only live projects appear in the task Project dropdown.
- [ ] Create tasks **and** subtasks with all 15 fields.
- [ ] Task No auto-generates; Planned Month/Week and Overdue Days auto-calculate correctly.
- [ ] A task **cannot** be closed while any subtask is still open (BR-1).
- [ ] Closing a task **requires** Actual Mins (BR-2).
- [ ] Every status change writes a timestamped row to `task_status_history`.
- [ ] List view (grouped by status) and Kanban (drag to change status) both work.
- [ ] Filters on all fields and column sorting work.
- [ ] App installs on a phone as a PWA and is usable on a small screen.
- [ ] Running cost: **$0**.

---

*End of document.*
