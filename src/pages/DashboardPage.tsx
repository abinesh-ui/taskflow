import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import { formatDate, getOverdueDays, getPlannedMonthWeek } from '@/lib/utils';
import { exportTasksToCSV } from '@/lib/csv-export';
import { ChevronDown, ChevronRight, Plus, Download, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');
  const [newTaskDept, setNewTaskDept] = useState('');
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return (data || []) as Project[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position');
      return (data || []) as Department[];
    },
  });

  const { data: allTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').order('planned_end_date', { ascending: true, nullsFirst: false });
      return (data || []) as Task[];
    },
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['master_statuses'],
    queryFn: async () => {
      const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position');
      return (data || []) as MasterStatus[];
    },
  });

  const { data: priorities = [] } = useQuery({
    queryKey: ['master_priorities'],
    queryFn: async () => {
      const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position');
      return (data || []) as MasterPriority[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['master_members'],
    queryFn: async () => {
      const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color: string }>;
    },
  });

  const { data: taskTypes = [] } = useQuery({
    queryKey: ['master_task_types'],
    queryFn: async () => {
      const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color?: string }>;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['master_task_categories'],
    queryFn: async () => {
      const { data } = await supabase.from('master_task_categories').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color?: string }>;
    },
  });

  // Top-level tasks sorted by due date
  const topTasks = allTasks.filter((t) => !t.parent_id).sort((a, b) => {
    const aDate = a.planned_end_date || '9999-12-31';
    const bDate = b.planned_end_date || '9999-12-31';
    return aDate.localeCompare(bDate);
  });

  function getSubtasks(taskId: string) {
    return allTasks.filter((t) => t.parent_id === taskId);
  }

  function toggleTask(id: string) {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedTasks(next);
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedTasks(new Set());
      setAllExpanded(false);
    } else {
      setExpandedTasks(new Set(topTasks.map((t) => t.id)));
      setAllExpanded(true);
    }
  }

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !newTaskProject || !newTaskDept) return;
    const defaultStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({
      title: newTaskTitle.trim(),
      project_id: newTaskProject,
      department_id: newTaskDept,
      status_id: defaultStatus?.id || '',
      position: 0,
      parent_id: null,
    } as any, {
      onSuccess: () => {
        setNewTaskTitle('');
        queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      },
    });
  }

  async function handleCreateSubtask(parentTask: Task) {
    if (!newSubtaskTitle.trim()) return;
    const defaultStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({
      title: newSubtaskTitle.trim(),
      project_id: parentTask.project_id,
      department_id: parentTask.department_id,
      status_id: defaultStatus?.id || '',
      parent_id: parentTask.id,
      position: 0,
    } as any, {
      onSuccess: () => {
        setNewSubtaskTitle('');
        setAddingSubtaskTo(null);
        setExpandedTasks(new Set([...expandedTasks, parentTask.id]));
        queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      },
    });
  }

  async function updateField(taskId: string, field: string, value: any) {
    const { error } = await supabase.from('tasks').update({ [field]: value || null }).eq('id', taskId);
    if (!error) queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  }

  function getProjectName(id: string) { return projects.find((p) => p.id === id)?.name || ''; }
  function getDeptName(id: string) { return departments.find((d) => d.id === id)?.name || ''; }
  function getMemberName(id: string | null) { return id ? members.find((m) => m.id === id)?.name || '' : ''; }

  const deptOptions = newTaskProject ? departments.filter((d) => d.project_id === newTaskProject) : departments;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tasks</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={toggleAll}>
            {allExpanded ? <ChevronsUp className="h-4 w-4 mr-1" /> : <ChevronsDown className="h-4 w-4 mr-1" />}
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => exportTasksToCSV(topTasks, { statuses, priorities, taskTypes: taskTypes as any, categories: categories as any, users: members as any })}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="border rounded-lg overflow-x-auto bg-white dark:bg-card shadow-sm">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="bg-muted/60 border-b text-xs font-semibold text-muted-foreground">
              <th className="py-2.5 px-2 text-left w-8"></th>
              <th className="py-2.5 px-2 text-left w-24">Task #</th>
              <th className="py-2.5 px-2 text-left min-w-[200px]">Title</th>
              <th className="py-2.5 px-2 text-left w-28">Project</th>
              <th className="py-2.5 px-2 text-left w-28">Department</th>
              <th className="py-2.5 px-2 text-left w-24">Status</th>
              <th className="py-2.5 px-2 text-left w-24">Priority</th>
              <th className="py-2.5 px-2 text-left w-24">Assignee</th>
              <th className="py-2.5 px-2 text-left w-24">Type</th>
              <th className="py-2.5 px-2 text-left w-24">Category</th>
              <th className="py-2.5 px-2 text-left w-28">Due Date</th>
              <th className="py-2.5 px-2 text-left w-16">Overdue</th>
              <th className="py-2.5 px-2 text-left w-20">Mon/Wk</th>
              <th className="py-2.5 px-2 text-left w-8"></th>
            </tr>
          </thead>
          <tbody>
            {/* New task row - always first */}
            <tr className="border-b bg-primary/5 hover:bg-primary/10">
              <td className="py-1.5 px-2">
                <Plus className="h-4 w-4 text-primary" />
              </td>
              <td className="py-1.5 px-2 text-xs text-muted-foreground italic">New</td>
              <td className="py-1.5 px-1">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask(); }}
                  placeholder="Type task title and press Enter..."
                  className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
                />
              </td>
              <td className="py-1.5 px-1">
                <SearchableSelect
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  value={newTaskProject}
                  onChange={(v) => { setNewTaskProject(v); setNewTaskDept(''); }}
                  placeholder="Project"
                  className="text-xs [&_button]:h-7 [&_button]:text-xs [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none"
                />
              </td>
              <td className="py-1.5 px-1">
                <SearchableSelect
                  options={deptOptions.map((d: any) => ({ value: d.id, label: d.name }))}
                  value={newTaskDept}
                  onChange={setNewTaskDept}
                  placeholder="Dept"
                  className="text-xs [&_button]:h-7 [&_button]:text-xs [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none"
                />
              </td>
              <td colSpan={9} className="py-1.5 px-2">
                <Button size="sm" className="h-6 text-xs px-2" onClick={handleCreateTask} disabled={!newTaskTitle.trim() || !newTaskProject || !newTaskDept}>
                  Add
                </Button>
              </td>
            </tr>

            {/* Task rows */}
            {topTasks.map((task) => (
              <React.Fragment key={task.id}>
                <TaskSpreadsheetRow
                  task={task}
                  isSubtask={false}
                  statuses={statuses}
                  priorities={priorities}
                  members={members}
                  taskTypes={taskTypes}
                  categories={categories}
                  projects={projects}
                  departments={departments}
                  expanded={expandedTasks.has(task.id)}
                  subtaskCount={getSubtasks(task.id).length}
                  onToggle={() => toggleTask(task.id)}
                  onUpdateField={updateField}
                  onAddSubtask={() => { setAddingSubtaskTo(task.id); setExpandedTasks(new Set([...expandedTasks, task.id])); }}
                />
                {/* Subtask creation row */}
                {expandedTasks.has(task.id) && addingSubtaskTo === task.id && (
                  <tr className="border-b bg-green-50/50 dark:bg-green-950/20">
                    <td className="py-1 px-2"></td>
                    <td className="py-1 px-2 pl-8 text-xs text-muted-foreground italic">New sub</td>
                    <td className="py-1 px-1" colSpan={11}>
                      <div className="flex items-center gap-2">
                        <Input
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSubtask(task); if (e.key === 'Escape') setAddingSubtaskTo(null); }}
                          placeholder="Subtask title... (Enter to add, Esc to cancel)"
                          className="h-6 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 flex-1"
                          autoFocus
                        />
                        <Button size="sm" className="h-5 text-[10px] px-2" onClick={() => handleCreateSubtask(task)}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1" onClick={() => setAddingSubtaskTo(null)}>Cancel</Button>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                )}
                {/* Subtask rows */}
                {expandedTasks.has(task.id) && getSubtasks(task.id).map((sub) => (
                  <TaskSpreadsheetRow
                    key={sub.id}
                    task={sub}
                    isSubtask={true}
                    statuses={statuses}
                    priorities={priorities}
                    members={members}
                    taskTypes={taskTypes}
                    categories={categories}
                    projects={projects}
                    departments={departments}
                    expanded={false}
                    subtaskCount={0}
                    onToggle={() => {}}
                    onUpdateField={updateField}
                    onAddSubtask={() => {}}
                  />
                ))}
              </React.Fragment>
            ))}

            {topTasks.length === 0 && (
              <tr><td colSpan={14} className="text-center py-12 text-muted-foreground">No tasks yet. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// INLINE EDITABLE TASK ROW
// ============================================================
function TaskSpreadsheetRow({
  task, isSubtask, statuses, priorities, members, taskTypes, categories, projects, departments,
  expanded, subtaskCount, onToggle, onUpdateField, onAddSubtask,
}: {
  task: Task;
  isSubtask: boolean;
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  members: Array<{ id: string; name: string; color: string }>;
  taskTypes: Array<{ id: string; name: string; color?: string }>;
  categories: Array<{ id: string; name: string; color?: string }>;
  projects: Project[];
  departments: Department[];
  expanded: boolean;
  subtaskCount: number;
  onToggle: () => void;
  onUpdateField: (id: string, field: string, value: any) => void;
  onAddSubtask: () => void;
}) {
  const status = statuses.find((s) => s.id === task.status_id);
  const overdue = getOverdueDays(task.planned_end_date, status?.is_closed ?? false);
  const monthWeek = getPlannedMonthWeek(task.planned_start_date);

  return (
    <tr className={`border-b hover:bg-accent/20 transition-colors ${isSubtask ? 'bg-muted/20' : ''} ${overdue > 0 ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
      {/* Expand / Subtask indicator */}
      <td className="py-1.5 px-2">
        {!isSubtask && subtaskCount > 0 ? (
          <button onClick={onToggle} className="p-0.5 hover:bg-accent rounded">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : !isSubtask ? (
          <span className="text-muted-foreground/30">·</span>
        ) : (
          <span className="ml-3 text-muted-foreground/40">↳</span>
        )}
      </td>

      {/* Task No */}
      <td className={`py-1.5 px-2 font-mono text-[10px] text-muted-foreground ${isSubtask ? 'pl-8' : ''}`}>
        {task.task_no}
        {!isSubtask && subtaskCount > 0 && (
          <span className="ml-1 text-[9px] text-primary">({subtaskCount})</span>
        )}
      </td>

      {/* Title - inline editable */}
      <td className="py-1.5 px-1">
        <input
          defaultValue={task.title}
          onBlur={(e) => { if (e.target.value !== task.title) onUpdateField(task.id, 'title', e.target.value); }}
          className={`w-full bg-transparent text-sm outline-none border-0 px-1 py-0.5 rounded hover:bg-muted/50 focus:bg-white dark:focus:bg-card focus:ring-1 focus:ring-primary/30 ${isSubtask ? 'text-xs' : 'font-medium'}`}
        />
      </td>

      {/* Project */}
      <td className="py-1.5 px-1">
        <span className="text-[10px] text-muted-foreground truncate block">{projects.find((p) => p.id === task.project_id)?.name || ''}</span>
      </td>

      {/* Department */}
      <td className="py-1.5 px-1">
        <span className="text-[10px] text-muted-foreground truncate block">{departments.find((d) => d.id === task.department_id)?.name || ''}</span>
      </td>

      {/* Status - inline select */}
      <td className="py-1.5 px-1">
        <select
          value={task.status_id}
          onChange={(e) => onUpdateField(task.id, 'status_id', e.target.value)}
          className="text-[10px] bg-transparent border-0 outline-none cursor-pointer rounded px-0.5 py-0.5 hover:bg-muted/50 font-medium w-full"
          style={{ color: status?.color }}
        >
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>

      {/* Priority - inline select */}
      <td className="py-1.5 px-1">
        <select
          value={task.priority_id || ''}
          onChange={(e) => onUpdateField(task.id, 'priority_id', e.target.value)}
          className="text-[10px] bg-transparent border-0 outline-none cursor-pointer rounded px-0.5 py-0.5 hover:bg-muted/50 w-full"
        >
          <option value="">-</option>
          {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>

      {/* Assignee - inline select */}
      <td className="py-1.5 px-1">
        <select
          value={task.assignee_id || ''}
          onChange={(e) => onUpdateField(task.id, 'assignee_id', e.target.value)}
          className="text-[10px] bg-transparent border-0 outline-none cursor-pointer rounded px-0.5 py-0.5 hover:bg-muted/50 w-full"
        >
          <option value="">-</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </td>

      {/* Task Type */}
      <td className="py-1.5 px-1">
        <select
          value={task.task_type_id || ''}
          onChange={(e) => onUpdateField(task.id, 'task_type_id', e.target.value)}
          className="text-[10px] bg-transparent border-0 outline-none cursor-pointer rounded px-0.5 py-0.5 hover:bg-muted/50 w-full"
        >
          <option value="">-</option>
          {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </td>

      {/* Category */}
      <td className="py-1.5 px-1">
        <select
          value={task.category_id || ''}
          onChange={(e) => onUpdateField(task.id, 'category_id', e.target.value)}
          className="text-[10px] bg-transparent border-0 outline-none cursor-pointer rounded px-0.5 py-0.5 hover:bg-muted/50 w-full"
        >
          <option value="">-</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </td>

      {/* Due Date - inline editable */}
      <td className="py-1.5 px-1">
        <input
          type="date"
          defaultValue={task.planned_end_date || ''}
          onBlur={(e) => { if (e.target.value !== (task.planned_end_date || '')) onUpdateField(task.id, 'planned_end_date', e.target.value); }}
          className={`text-[10px] bg-transparent border-0 outline-none cursor-pointer rounded px-0.5 py-0.5 hover:bg-muted/50 w-full ${overdue > 0 ? 'text-red-600 font-semibold' : ''}`}
        />
      </td>

      {/* Overdue */}
      <td className={`py-1.5 px-2 text-[10px] font-semibold ${overdue > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
        {overdue > 0 ? `${overdue}d` : '-'}
      </td>

      {/* Month/Week */}
      <td className="py-1.5 px-2 text-[10px] text-muted-foreground">{monthWeek || '-'}</td>

      {/* Add subtask */}
      <td className="py-1.5 px-1">
        {!isSubtask && (
          <button
            onClick={onAddSubtask}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
            title="Add subtask"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </td>
    </tr>
  );
}
