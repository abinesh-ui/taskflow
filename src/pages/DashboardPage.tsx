import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { NestedFilterBuilder, applyFilters, type FilterCondition } from '@/components/tasks/NestedFilter';
import { SortBuilderInline, type SortLevel } from '@/components/tasks/SortBuilder';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { formatDate, getOverdueDays, getPlannedMonthWeek } from '@/lib/utils';
import { exportTasksToCSV } from '@/lib/csv-export';
import { ChevronDown, ChevronRight, Plus, Download, ChevronsDown, ChevronsUp, ChevronLeft } from 'lucide-react';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

interface DashboardProps {
  filterProjectId?: string;
  filterDepartmentId?: string;
}

export default function DashboardPage({ filterProjectId, filterDepartmentId }: DashboardProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProject, setNewTaskProject] = useState(filterProjectId || '');
  const [newTaskDept, setNewTaskDept] = useState(filterDepartmentId || '');
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([{ field: 'planned_end_date', direction: 'asc' }]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 200;

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as MasterPriority[]; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string; role?: string }>; } });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['master_task_types'], queryFn: async () => { const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color?: string; position: number }>; } });
  const { data: categories = [] } = useQuery({ queryKey: ['master_task_categories'], queryFn: async () => { const { data } = await supabase.from('master_task_categories').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color?: string }>; } });

  useEffect(() => { if (filterProjectId) setNewTaskProject(filterProjectId); }, [filterProjectId]);
  useEffect(() => { if (filterDepartmentId) setNewTaskDept(filterDepartmentId); }, [filterDepartmentId]);

  function getOverdue(task: Task) {
    const status = statuses.find((s) => s.id === task.status_id);
    return getOverdueDays(task.planned_end_date, status?.is_closed ?? false);
  }

  // Apply project/dept context filter first
  let contextFiltered = allTasks.filter((t) => !t.parent_id);
  if (filterProjectId) contextFiltered = contextFiltered.filter((t) => t.project_id === filterProjectId);
  if (filterDepartmentId) contextFiltered = contextFiltered.filter((t) => t.department_id === filterDepartmentId);

  // Apply nested filters
  const filtered = applyFilters(contextFiltered, filterConditions, getOverdue);

  // Apply multi-level sort
  const sorted = [...filtered].sort((a, b) => {
    for (const level of sortLevels) {
      const cmp = compareByField(a, b, level.field, level.direction);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  function compareByField(a: Task, b: Task, field: string, dir: 'asc' | 'desc'): number {
    let av: any, bv: any;
    if (field === 'priority_weight') { av = priorities.find((p) => p.id === a.priority_id)?.sort_weight ?? 0; bv = priorities.find((p) => p.id === b.priority_id)?.sort_weight ?? 0; }
    else if (field === 'overdue_days') { av = getOverdue(a); bv = getOverdue(b); }
    else if (field === 'task_type_position') { av = taskTypes.find((t) => t.id === a.task_type_id)?.position ?? 999; bv = taskTypes.find((t) => t.id === b.task_type_id)?.position ?? 999; }
    else if (field === 'status_position') { av = statuses.find((s) => s.id === a.status_id)?.position ?? 999; bv = statuses.find((s) => s.id === b.status_id)?.position ?? 999; }
    else { av = (a as any)[field] ?? ''; bv = (b as any)[field] ?? ''; }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  }

  // Pagination
  const totalTasks = sorted.length;
  const totalPages = Math.ceil(totalTasks / PAGE_SIZE);
  const paginatedTasks = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function getSubtasks(taskId: string) { return allTasks.filter((t) => t.parent_id === taskId); }
  function toggleTask(id: string) { const n = new Set(expandedTasks); if (n.has(id)) n.delete(id); else n.add(id); setExpandedTasks(n); }
  function toggleAll() { if (allExpanded) { setExpandedTasks(new Set()); setAllExpanded(false); } else { setExpandedTasks(new Set(paginatedTasks.map((t) => t.id))); setAllExpanded(true); } }

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !newTaskProject || !newTaskDept) return;
    const defaultStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({ title: newTaskTitle.trim(), project_id: newTaskProject, department_id: newTaskDept, status_id: defaultStatus?.id || '', position: 0, parent_id: null } as any, {
      onSuccess: () => { setNewTaskTitle(''); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); },
    });
  }

  async function handleCreateSubtask(parentTask: Task) {
    if (!newSubtaskTitle.trim()) return;
    const defaultStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({ title: newSubtaskTitle.trim(), project_id: parentTask.project_id, department_id: parentTask.department_id, status_id: defaultStatus?.id || '', parent_id: parentTask.id, category_id: parentTask.category_id, position: 0 } as any, {
      onSuccess: () => { setNewSubtaskTitle(''); setAddingSubtaskTo(null); setExpandedTasks(new Set([...expandedTasks, parentTask.id])); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); },
    });
  }

  async function updateField(taskId: string, field: string, value: any) {
    // Validation: subtask due date can't exceed parent due date
    if (field === 'planned_end_date' && value) {
      const task = allTasks.find((t) => t.id === taskId);
      if (task?.parent_id) {
        const parent = allTasks.find((t) => t.id === task.parent_id);
        if (parent?.planned_end_date && value > parent.planned_end_date) {
          toast({ variant: 'destructive', title: 'Validation Error', description: "Subtask due date can't be greater than task due date" });
          return;
        }
      }
    }
    const { error } = await supabase.from('tasks').update({ [field]: value || null }).eq('id', taskId);
    if (!error) queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  }

  async function cancelTask(taskId: string) {
    const cancelStatus = statuses.find((s) => s.name === 'Cancel' || s.name === 'Dropped');
    if (cancelStatus) await updateField(taskId, 'status_id', cancelStatus.id);
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task permanently?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (!error) queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  }

  const deptOptions = newTaskProject ? departments.filter((d) => d.project_id === newTaskProject) : departments;

  // Filter field definitions for nested filter builder
  const filterFields = [
    { key: 'project_id', label: 'Project', type: 'select' as const, options: projects.map((p) => ({ value: p.id, label: p.name })) },
    { key: 'department_id', label: 'Department', type: 'select' as const, options: departments.map((d) => ({ value: d.id, label: d.name })) },
    { key: 'status_id', label: 'Status', type: 'select' as const, options: statuses.map((s) => ({ value: s.id, label: s.name, color: s.color })) },
    { key: 'priority_id', label: 'Priority', type: 'select' as const, options: priorities.map((p) => ({ value: p.id, label: p.name, color: p.color })) },
    { key: 'assignee_id', label: 'Assignee', type: 'select' as const, options: members.map((m) => ({ value: m.id, label: m.name, color: m.color })) },
    { key: 'task_type_id', label: 'Type', type: 'select' as const, options: taskTypes.map((t) => ({ value: t.id, label: t.name })) },
    { key: 'category_id', label: 'Category', type: 'select' as const, options: categories.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'overdue_days', label: 'Overdue Days', type: 'number' as const },
    { key: 'due_date', label: 'Due Date', type: 'date' as const },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Tasks</h2>
          <Badge variant="secondary" className="text-xs">{totalTasks} total</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleAll}>
            {allExpanded ? <ChevronsUp className="h-3.5 w-3.5 mr-1" /> : <ChevronsDown className="h-3.5 w-3.5 mr-1" />}
            {allExpanded ? 'Collapse' : 'Expand'}
          </Button>
          <SortBuilderInline sortLevels={sortLevels} onSortChange={setSortLevels} />
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportTasksToCSV(sorted, { statuses, priorities, taskTypes: taskTypes as any, categories: categories as any, users: members as any })}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Nested Filters */}
      <NestedFilterBuilder fields={filterFields} conditions={filterConditions} onChange={(c) => { setFilterConditions(c); setCurrentPage(1); }} />

      {/* Spreadsheet */}
      <div className="border rounded-lg overflow-x-auto bg-white dark:bg-card shadow-sm">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-muted/60 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="py-2 px-1.5 w-7"></th>
              <th className="py-2 px-1.5 text-left w-20">Task #</th>
              <th className="py-2 px-1.5 text-left min-w-[180px]">Title</th>
              <th className="py-2 px-1.5 text-left w-24">Project</th>
              <th className="py-2 px-1.5 text-left w-24">Dept</th>
              <th className="py-2 px-1.5 text-left w-20">Status</th>
              <th className="py-2 px-1.5 text-left w-20">Priority</th>
              <th className="py-2 px-1.5 text-left w-20">Assignee</th>
              <th className="py-2 px-1.5 text-left w-20">Type</th>
              <th className="py-2 px-1.5 text-left w-20">Category</th>
              <th className="py-2 px-1.5 text-left w-24">Due Date</th>
              <th className="py-2 px-1.5 text-left w-14">Overdue</th>
              <th className="py-2 px-1.5 text-left w-14">M/Wk</th>
              <th className="py-2 px-1.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {/* New task row */}
            <tr className="border-b bg-primary/5">
              <td className="py-1 px-1.5"><Plus className="h-3.5 w-3.5 text-primary" /></td>
              <td className="py-1 px-1.5 text-[10px] text-muted-foreground">New</td>
              <td className="py-1 px-0.5"><Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask(); }} placeholder="Task title + Enter" className="h-6 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1" /></td>
              <td className="py-1 px-0.5"><select value={newTaskProject} onChange={(e) => { setNewTaskProject(e.target.value); setNewTaskDept(''); }} className="h-6 text-[10px] w-full bg-transparent border-0 outline-none">{!newTaskProject && <option value="">Project</option>}{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
              <td className="py-1 px-0.5"><select value={newTaskDept} onChange={(e) => setNewTaskDept(e.target.value)} className="h-6 text-[10px] w-full bg-transparent border-0 outline-none">{!newTaskDept && <option value="">Dept</option>}{deptOptions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
              <td colSpan={9} className="py-1 px-1.5"><Button size="sm" className="h-5 text-[10px] px-2" onClick={handleCreateTask} disabled={!newTaskTitle.trim() || !newTaskProject || !newTaskDept}>Add</Button></td>
            </tr>

            {/* Task rows */}
            {paginatedTasks.map((task) => (
              <React.Fragment key={task.id}>
                <SpreadsheetRow task={task} isSubtask={false} statuses={statuses} priorities={priorities} members={members} taskTypes={taskTypes} categories={categories} departments={departments} expanded={expandedTasks.has(task.id)} subtaskCount={getSubtasks(task.id).length} onToggle={() => toggleTask(task.id)} onUpdate={updateField} onAddSubtask={() => { setAddingSubtaskTo(task.id); setExpandedTasks(new Set([...expandedTasks, task.id])); }} onCancel={() => cancelTask(task.id)} onDelete={() => deleteTask(task.id)} overdue={getOverdue(task)} />
                {expandedTasks.has(task.id) && addingSubtaskTo === task.id && (
                  <tr className="border-b bg-green-50/50 dark:bg-green-950/10">
                    <td></td><td className="py-1 px-1.5 pl-6 text-[10px] italic text-muted-foreground">New sub</td>
                    <td colSpan={11} className="py-1 px-0.5"><div className="flex items-center gap-1"><Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSubtask(task); if (e.key === 'Escape') setAddingSubtaskTo(null); }} placeholder="Subtask title... Enter to add" className="h-5 text-[10px] border-0 bg-transparent shadow-none focus-visible:ring-1 flex-1" autoFocus /><Button size="sm" className="h-5 text-[9px] px-1.5" onClick={() => handleCreateSubtask(task)}>Add</Button></div></td>
                    <td></td>
                  </tr>
                )}
                {expandedTasks.has(task.id) && getSubtasks(task.id).map((sub) => (
                  <SpreadsheetRow key={sub.id} task={sub} isSubtask={true} statuses={statuses} priorities={priorities} members={members} taskTypes={taskTypes} categories={categories} departments={departments} expanded={false} subtaskCount={0} onToggle={() => {}} onUpdate={updateField} onAddSubtask={() => {}} onCancel={() => cancelTask(sub.id)} onDelete={() => deleteTask(sub.id)} overdue={getOverdue(sub)} />
                ))}
              </React.Fragment>
            ))}
            {paginatedTasks.length === 0 && <tr><td colSpan={14} className="text-center py-12 text-muted-foreground text-sm">No tasks found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalTasks)} of {totalTasks} tasks</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), currentPage + 2).map((p) => (
              <Button key={p} variant={p === currentPage ? 'default' : 'ghost'} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setCurrentPage(p)}>{p}</Button>
            ))}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            <span className="ml-2">{currentPage} of {totalPages} pages</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
function SpreadsheetRow({ task, isSubtask, statuses, priorities, members, taskTypes, categories, departments, expanded, subtaskCount, onToggle, onUpdate, onAddSubtask, onCancel, onDelete, overdue }: {
  task: Task; isSubtask: boolean; statuses: MasterStatus[]; priorities: MasterPriority[];
  members: Array<{ id: string; name: string; color: string }>; taskTypes: Array<{ id: string; name: string }>; categories: Array<{ id: string; name: string }>; departments: Department[];
  expanded: boolean; subtaskCount: number; onToggle: () => void; onUpdate: (id: string, f: string, v: any) => void; onAddSubtask: () => void; onCancel: () => void; onDelete: () => void; overdue: number;
}) {
  const status = statuses.find((s) => s.id === task.status_id);
  return (
    <tr className={`border-b hover:bg-accent/20 ${isSubtask ? 'bg-muted/15' : ''} ${overdue > 0 && !status?.is_closed ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
      <td className="py-1 px-1.5">
        {!isSubtask && subtaskCount > 0 ? (
          <button onClick={onToggle} className="p-0.5 hover:bg-accent rounded">{expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</button>
        ) : isSubtask ? <span className="ml-2 text-muted-foreground/40 text-[10px]">↳</span> : <span className="text-muted-foreground/20">·</span>}
      </td>
      <td className={`py-1 px-1.5 font-mono text-[9px] text-muted-foreground ${isSubtask ? 'pl-5' : ''}`}>
        {task.task_no}{!isSubtask && subtaskCount > 0 && <span className="text-primary ml-0.5">({subtaskCount})</span>}
      </td>
      <td className="py-1 px-0.5"><input defaultValue={task.title} onBlur={(e) => { if (e.target.value !== task.title) onUpdate(task.id, 'title', e.target.value); }} className={`w-full bg-transparent outline-none border-0 px-1 py-0.5 rounded hover:bg-muted/50 focus:bg-white dark:focus:bg-card focus:ring-1 focus:ring-primary/30 ${isSubtask ? 'text-xs' : 'text-sm font-medium'}`} /></td>
      <td className="py-1 px-0.5"><span className="text-[9px] text-muted-foreground">{departments.find((d) => d.project_id && d.id === task.department_id) ? (departments as any).find((d: any) => d.id === task.department_id)?.name : ''}</span></td>
      <td className="py-1 px-0.5"><select value={task.department_id || ''} onChange={(e) => onUpdate(task.id, 'department_id', e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded">{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.status_id} onChange={(e) => onUpdate(task.id, 'status_id', e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded font-medium" style={{ color: status?.color }}>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.priority_id || ''} onChange={(e) => onUpdate(task.id, 'priority_id', e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.assignee_id || ''} onChange={(e) => onUpdate(task.id, 'assignee_id', e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.task_type_id || ''} onChange={(e) => onUpdate(task.id, 'task_type_id', e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.category_id || ''} onChange={(e) => onUpdate(task.id, 'category_id', e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><input type="date" defaultValue={task.planned_end_date || ''} onBlur={(e) => { if (e.target.value !== (task.planned_end_date || '')) onUpdate(task.id, 'planned_end_date', e.target.value); }} className={`text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded px-0.5 ${overdue > 0 ? 'text-red-600 font-bold' : ''}`} /></td>
      <td className={`py-1 px-1.5 text-[9px] font-bold ${overdue > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{overdue > 0 ? `${overdue}d` : '-'}</td>
      <td className="py-1 px-1.5 text-[9px] text-muted-foreground">{getPlannedMonthWeek(task.planned_start_date) || '-'}</td>
      <td className="py-1 px-0.5">
        <div className="flex items-center gap-0.5">
          {!isSubtask && <button onClick={onAddSubtask} className="h-4 w-4 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Add subtask"><Plus className="h-2.5 w-2.5" /></button>}
          <button onClick={onCancel} className="h-4 w-4 flex items-center justify-center rounded hover:bg-orange-100 text-muted-foreground hover:text-orange-600" title="Cancel task"><span className="text-[8px]">✕</span></button>
          <button onClick={onDelete} className="h-4 w-4 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground hover:text-red-600" title="Delete"><span className="text-[8px]">🗑</span></button>
        </div>
      </td>
    </tr>
  );
}
