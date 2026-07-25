import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NestedFilterBuilder, applyFilters, type FilterCondition } from '@/components/tasks/NestedFilter';
import { SortBuilderInline, type SortLevel } from '@/components/tasks/SortBuilder';
import { useCreateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { getOverdueDays, getPlannedMonthWeek, formatDate } from '@/lib/utils';
import { exportTasksToCSV } from '@/lib/csv-export';
import { ChevronDown, ChevronRight, Plus, Download, ChevronsDown, ChevronsUp, ChevronLeft } from 'lucide-react';
import { useResizableColumns, ResizeHandle } from '@/components/ui/resizable-table';
import MobileTaskView from '@/components/mobile/MobileTaskView';
import DailyPOADialog from '@/components/tasks/DailyPOADialog';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

interface DashboardProps { filterProjectId?: string; filterDepartmentId?: string; }

export default function DashboardPage({ filterProjectId, filterDepartmentId }: DashboardProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([{ field: 'planned_end_date', direction: 'asc' }]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkField, setBulkField] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [showPOA, setShowPOA] = useState(false);
  const PAGE_SIZE = 200;

  // New task/subtask form state
  const [nf, setNf] = useState<Record<string, string>>({});

  // Resizable columns
  const COL_NAMES = ['☑','▾','Task #','Title','Project','Dept','Status','Priority','Assignee','Type','Section','Milestone','Macro','Start','Due','P.Mins','A.Start','A.End','A.Mins','Overdue','Remarks','Actions'];
  const { widths, onMouseDown } = useResizableColumns({ initialWidths: [28,24,75,280,80,80,70,70,80,70,70,80,80,90,90,55,90,90,55,50,160,55] });

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as MasterPriority[]; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['master_task_types'], queryFn: async () => { const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; position: number }>; } });
  const { data: categories = [] } = useQuery({ queryKey: ['master_task_categories'], queryFn: async () => { const { data } = await supabase.from('master_task_categories').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: taskSections = [] } = useQuery({ queryKey: ['master_task_sections'], queryFn: async () => { const { data } = await supabase.from('master_task_sections').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color?: string }>; } });
  const { data: macroProjects = [] } = useQuery({ queryKey: ['master_macro_projects'], queryFn: async () => { const { data } = await supabase.from('master_macro_projects').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*').order('created_at'); return (data || []) as Array<{ id: string; milestone_no: string; project_id: string; description: string }>; } });
  const { data: currentMember } = useQuery({ queryKey: ['current-member', user?.id], queryFn: async () => { const { data: profile } = await supabase.from('profiles').select('email').eq('id', user!.id).single(); if (!profile) return null; const { data } = await supabase.from('master_members').select('role').eq('email', profile.email).single(); return data as { role?: string } | null; }, enabled: !!user });
  const canBulk = (currentMember?.role === 'admin' || currentMember?.role === 'manager');

  function getOverdue(task: Task) { const s = statuses.find((st) => st.id === task.status_id); return getOverdueDays(task.planned_end_date, s?.is_closed ?? false); }

  let contextFiltered = allTasks.filter((t) => !t.parent_id);
  if (filterProjectId) contextFiltered = contextFiltered.filter((t) => t.project_id === filterProjectId);
  if (filterDepartmentId) contextFiltered = contextFiltered.filter((t) => t.department_id === filterDepartmentId);
  const filtered = applyFilters(contextFiltered, filterConditions, getOverdue);

  const sorted = [...filtered].sort((a, b) => { for (const l of sortLevels) { const c = cmpField(a, b, l.field, l.direction); if (c !== 0) return c; } return 0; });
  function cmpField(a: Task, b: Task, field: string, dir: 'asc' | 'desc'): number {
    let av: any, bv: any;
    if (field === 'priority_weight') { av = priorities.find((p) => p.id === a.priority_id)?.sort_weight ?? 0; bv = priorities.find((p) => p.id === b.priority_id)?.sort_weight ?? 0; }
    else if (field === 'overdue_days') { av = getOverdue(a); bv = getOverdue(b); }
    else if (field === 'task_type_position') { av = taskTypes.find((t) => t.id === a.task_type_id)?.position ?? 999; bv = taskTypes.find((t) => t.id === b.task_type_id)?.position ?? 999; }
    else if (field === 'status_position') { av = statuses.find((s) => s.id === a.status_id)?.position ?? 999; bv = statuses.find((s) => s.id === b.status_id)?.position ?? 999; }
    else { av = (a as any)[field] ?? ''; bv = (b as any)[field] ?? ''; }
    if (av < bv) return dir === 'asc' ? -1 : 1; if (av > bv) return dir === 'asc' ? 1 : -1; return 0;
  }
  const totalTasks = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE));
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function getSubtasks(id: string) { return allTasks.filter((t) => t.parent_id === id); }
  function toggleTask(id: string) { const n = new Set(expandedTasks); if (n.has(id)) n.delete(id); else n.add(id); setExpandedTasks(n); }
  function toggleAll() { if (allExpanded) { setExpandedTasks(new Set()); setAllExpanded(false); } else { setExpandedTasks(new Set(paginated.map((t) => t.id))); setAllExpanded(true); } }

  async function handleCreate(parentTask?: Task) {
    if (!nf.title?.trim()) return;
    const projId = nf.project_id || parentTask?.project_id || filterProjectId || '';
    const deptId = nf.department_id || parentTask?.department_id || filterDepartmentId || '';
    if (!projId || !deptId) { toast({ variant: 'destructive', title: 'Error', description: 'Project and Department are required' }); return; }
    const defStatus = statuses.find((s) => s.position === 1) || statuses[0];
    // Subtask due date validation
    if (parentTask && nf.planned_end_date && parentTask.planned_end_date && nf.planned_end_date > parentTask.planned_end_date) {
      toast({ variant: 'destructive', title: 'Validation Error', description: "Subtask due date can't be greater than task due date" }); return;
    }
    createTask.mutate({ title: nf.title.trim(), project_id: projId, department_id: deptId, status_id: nf.status_id || defStatus?.id || '', priority_id: nf.priority_id || null, assignee_id: nf.assignee_id || null, task_type_id: nf.task_type_id || null, category_id: nf.category_id || parentTask?.category_id || null, section_id: nf.section_id || null, milestone_id: nf.milestone_id || parentTask && (parentTask as any).milestone_id || null, planned_start_date: nf.planned_start_date || null, planned_end_date: nf.planned_end_date || null, planned_mins: nf.planned_mins ? Number(nf.planned_mins) : null, actual_mins: nf.actual_mins ? Number(nf.actual_mins) : null, description: nf.remarks || null, parent_id: parentTask?.id || null, position: 0 } as any, {
      onSuccess: () => { setNf({}); setAddingTask(false); setAddingSubtaskTo(null); if (parentTask) setExpandedTasks(new Set([...expandedTasks, parentTask.id])); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); },
    });
  }

  async function updateField(taskId: string, field: string, value: any) {
    if (field === 'planned_end_date' && value) { const task = allTasks.find((t) => t.id === taskId); if (task?.parent_id) { const parent = allTasks.find((t) => t.id === task.parent_id); if (parent?.planned_end_date && value > parent.planned_end_date) { toast({ variant: 'destructive', title: 'Validation Error', description: "Subtask due date can't be greater than task due date" }); return; } } }
    await supabase.from('tasks').update({ [field]: value || null }).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  }
  async function cancelTask(id: string) { const s = statuses.find((st) => st.name === 'Cancel' || st.name === 'Dropped'); if (s) await updateField(id, 'status_id', s.id); }
  async function deleteTask(id: string) { if (!confirm('Delete permanently?')) return; await supabase.from('tasks').delete().eq('id', id); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); }

  function toggleSelect(id: string) { const n = new Set(selectedTasks); if (n.has(id)) n.delete(id); else n.add(id); setSelectedTasks(n); }
  function selectAll() { const allIds = new Set<string>(); paginated.forEach((t) => { allIds.add(t.id); getSubtasks(t.id).forEach((s) => allIds.add(s.id)); }); setSelectedTasks(allIds); }
  function deselectAll() { setSelectedTasks(new Set()); }
  async function handleBulkUpdate() {
    if (!bulkField || !bulkValue || selectedTasks.size === 0) return;
    const ids = Array.from(selectedTasks);
    const { error } = await supabase.from('tasks').update({ [bulkField]: bulkValue }).in('id', ids);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    toast({ title: `Updated ${ids.length} task(s)` });
    setSelectedTasks(new Set()); setShowBulkUpdate(false); setBulkField(''); setBulkValue('');
  }
  async function handleBulkDelete() {
    if (selectedTasks.size === 0) return;
    if (!confirm(`Delete ${selectedTasks.size} task(s) permanently? This cannot be undone.`)) return;
    const ids = Array.from(selectedTasks);
    // Delete subtasks first (children of selected tasks)
    await supabase.from('tasks').delete().in('parent_id', ids);
    const { error } = await supabase.from('tasks').delete().in('id', ids);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    toast({ title: `Deleted ${ids.length} task(s)` });
    setSelectedTasks(new Set()); setShowBulkUpdate(false);
  }

  const filterFields = [
    { key: 'project_id', label: 'Project', type: 'select' as const, options: projects.map((p) => ({ value: p.id, label: p.name })) },
    { key: 'department_id', label: 'Department', type: 'select' as const, options: departments.map((d) => ({ value: d.id, label: d.name })) },
    { key: 'status_id', label: 'Status', type: 'select' as const, options: statuses.map((s) => ({ value: s.id, label: s.name, color: s.color })) },
    { key: 'priority_id', label: 'Priority', type: 'select' as const, options: priorities.map((p) => ({ value: p.id, label: p.name, color: p.color })) },
    { key: 'assignee_id', label: 'Assignee', type: 'select' as const, options: members.map((m) => ({ value: m.id, label: m.name })) },
    { key: 'task_type_id', label: 'Type', type: 'select' as const, options: taskTypes.map((t) => ({ value: t.id, label: t.name })) },
    { key: 'section_id', label: 'Section', type: 'select' as const, options: taskSections.map((s) => ({ value: s.id, label: s.name })) },
    { key: 'overdue_days', label: 'Overdue Days', type: 'number' as const },
    { key: 'due_date', label: 'Due Date', type: 'date' as const },
  ];
  const deptOpts = nf.project_id ? departments.filter((d) => d.project_id === nf.project_id) : departments;

  return (
    <>
      {/* Mobile View */}
      <MobileTaskView filterProjectId={filterProjectId} filterDepartmentId={filterDepartmentId} />
      {/* Desktop View */}
      <div className="space-y-2 hidden md:block">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8 text-xs font-medium" onClick={() => { setAddingTask(true); setNf({ project_id: filterProjectId || '', department_id: filterDepartmentId || '' }); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
        </Button>
        <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setShowFilters(!showFilters)}>
          <Plus className="h-3 w-3 mr-1" /> Filter {filterConditions.length > 0 && `(${filterConditions.length})`}
        </Button>
        <SortBuilderInline sortLevels={sortLevels} onSortChange={setSortLevels} />
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleAll}>
          {allExpanded ? <ChevronsUp className="h-3.5 w-3.5 mr-1" /> : <ChevronsDown className="h-3.5 w-3.5 mr-1" />}
          {allExpanded ? 'Collapse' : 'Expand'}
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportTasksToCSV(sorted, { statuses, priorities, taskTypes: taskTypes as any, categories: categories as any, users: members as any })}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
        <Button variant="default" size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600" onClick={() => setShowPOA(true)}>
          Daily POA
        </Button>
        {selectedTasks.size > 0 && canBulk && (
          <>
            <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => setShowBulkUpdate(true)}>
              Bulk Update ({selectedTasks.size})
            </Button>
            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBulkDelete}>
              Bulk Delete ({selectedTasks.size})
            </Button>
          </>
        )}
        {selectedTasks.size > 0 && !canBulk && (
          <span className="text-[10px] text-muted-foreground">Select: {selectedTasks.size} (bulk actions require Admin/Manager)</span>
        )}
        <Badge variant="secondary" className="text-[10px] ml-auto">{totalTasks} tasks</Badge>
      </div>

      {/* Bulk update bar */}
      {showBulkUpdate && selectedTasks.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-primary/5 border rounded-lg">
          <span className="text-xs font-medium">{selectedTasks.size} selected —</span>
          <select value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(''); }} className="h-7 text-xs border rounded px-2 bg-background">
            <option value="">Field to update</option>
            <option value="status_id">Status</option>
            <option value="priority_id">Priority</option>
            <option value="assignee_id">Assignee</option>
            <option value="task_type_id">Type</option>
            <option value="section_id">Section</option>
            <option value="milestone_id">Milestone</option>
          </select>
          {bulkField === 'status_id' && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 text-xs border rounded px-2 bg-background"><option value="">Select...</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          {bulkField === 'priority_id' && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 text-xs border rounded px-2 bg-background"><option value="">Select...</option>{priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          {bulkField === 'assignee_id' && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 text-xs border rounded px-2 bg-background"><option value="">Select...</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
          {bulkField === 'task_type_id' && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 text-xs border rounded px-2 bg-background"><option value="">Select...</option>{taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
          {bulkField === 'section_id' && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 text-xs border rounded px-2 bg-background"><option value="">Select...</option>{taskSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          {bulkField === 'milestone_id' && <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="h-7 text-xs border rounded px-2 bg-background"><option value="">Select...</option>{milestones.map((m: any) => <option key={m.id} value={m.id}>{m.milestone_no}</option>)}</select>}
          <Button size="sm" className="h-7 text-xs" onClick={handleBulkUpdate} disabled={!bulkField || !bulkValue}>Apply</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowBulkUpdate(false); deselectAll(); }}>Cancel</Button>
        </div>
      )}

      {/* Filters panel (toggle) */}
      {showFilters && <NestedFilterBuilder fields={filterFields} conditions={filterConditions} onChange={(c) => { setFilterConditions(c); setCurrentPage(1); }} />}

      {/* Spreadsheet table */}
      <div className="border rounded-lg overflow-x-auto bg-white dark:bg-card shadow-sm">
        <table className="text-[10px]" style={{ width: widths.reduce((a, b) => a + b, 0) + 'px' }}>
          <colgroup>
            {widths.map((w, i) => <col key={i} style={{ width: w + 'px' }} />)}
          </colgroup>
          <thead>
            <tr className="bg-muted/60 border-b font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2 px-1 relative"><input type="checkbox" checked={selectedTasks.size > 0 && selectedTasks.size >= paginated.length} onChange={(e) => { if (e.target.checked) selectAll(); else deselectAll(); }} className="h-3 w-3 rounded" /><ResizeHandle onMouseDown={(e) => onMouseDown(0, e)} /></th>
              <th className="py-2 px-1 relative"><ResizeHandle onMouseDown={(e) => onMouseDown(1, e)} /></th>
              <th className="py-2 px-1 text-left relative">Task #<ResizeHandle onMouseDown={(e) => onMouseDown(2, e)} /></th>
              <th className="py-2 px-1 text-left relative">Title<ResizeHandle onMouseDown={(e) => onMouseDown(3, e)} /></th>
              <th className="py-2 px-1 text-left relative">Project<ResizeHandle onMouseDown={(e) => onMouseDown(4, e)} /></th>
              <th className="py-2 px-1 text-left relative">Dept<ResizeHandle onMouseDown={(e) => onMouseDown(5, e)} /></th>
              <th className="py-2 px-1 text-left relative">Status<ResizeHandle onMouseDown={(e) => onMouseDown(6, e)} /></th>
              <th className="py-2 px-1 text-left relative">Priority<ResizeHandle onMouseDown={(e) => onMouseDown(7, e)} /></th>
              <th className="py-2 px-1 text-left relative">Assignee<ResizeHandle onMouseDown={(e) => onMouseDown(8, e)} /></th>
              <th className="py-2 px-1 text-left relative">Type<ResizeHandle onMouseDown={(e) => onMouseDown(9, e)} /></th>
              <th className="py-2 px-1 text-left relative">Section<ResizeHandle onMouseDown={(e) => onMouseDown(10, e)} /></th>
              <th className="py-2 px-1 text-left relative">Milestone<ResizeHandle onMouseDown={(e) => onMouseDown(11, e)} /></th>
              <th className="py-2 px-1 text-left relative">Macro<ResizeHandle onMouseDown={(e) => onMouseDown(12, e)} /></th>
              <th className="py-2 px-1 text-left relative">Start<ResizeHandle onMouseDown={(e) => onMouseDown(13, e)} /></th>
              <th className="py-2 px-1 text-left relative">Due<ResizeHandle onMouseDown={(e) => onMouseDown(14, e)} /></th>
              <th className="py-2 px-1 text-left relative">P.Mins<ResizeHandle onMouseDown={(e) => onMouseDown(15, e)} /></th>
              <th className="py-2 px-1 text-left relative">A.Start<ResizeHandle onMouseDown={(e) => onMouseDown(16, e)} /></th>
              <th className="py-2 px-1 text-left relative">A.End<ResizeHandle onMouseDown={(e) => onMouseDown(17, e)} /></th>
              <th className="py-2 px-1 text-left relative">A.Mins<ResizeHandle onMouseDown={(e) => onMouseDown(18, e)} /></th>
              <th className="py-2 px-1 text-left relative">Overdue<ResizeHandle onMouseDown={(e) => onMouseDown(19, e)} /></th>
              <th className="py-2 px-1 text-left relative">Remarks<ResizeHandle onMouseDown={(e) => onMouseDown(20, e)} /></th>
              <th className="py-2 px-1 relative"><ResizeHandle onMouseDown={(e) => onMouseDown(21, e)} /></th>
            </tr>
          </thead>
          <tbody>

            {/* New task row */}
            {addingTask && (
              <NewRow nf={nf} setNf={setNf} projects={projects} departments={deptOpts} statuses={statuses} priorities={priorities} members={members} taskTypes={taskTypes} categories={categories} taskSections={taskSections} macroProjects={macroProjects} milestones={milestones} onSave={() => handleCreate()} onCancel={() => { setAddingTask(false); setNf({}); }} isSubtask={false} />
            )}
            {/* Task rows */}
            {paginated.map((task) => (
              <React.Fragment key={task.id}>
                <TaskRow task={task} statuses={statuses} priorities={priorities} members={members} taskTypes={taskTypes} categories={categories} taskSections={taskSections} macroProjects={macroProjects} milestones={milestones} departments={departments} projects={projects} expanded={expandedTasks.has(task.id)} subtaskCount={getSubtasks(task.id).length} onToggle={() => toggleTask(task.id)} onUpdate={updateField} onAddSubtask={() => { setAddingSubtaskTo(task.id); setNf({ project_id: task.project_id, department_id: task.department_id, category_id: task.category_id || '', milestone_id: (task as any).milestone_id || '' }); setExpandedTasks(new Set([...expandedTasks, task.id])); }} onCancel={() => cancelTask(task.id)} onDelete={() => deleteTask(task.id)} overdue={getOverdue(task)} selected={selectedTasks.has(task.id)} onSelect={toggleSelect} />
                {expandedTasks.has(task.id) && addingSubtaskTo === task.id && (
                  <NewRow nf={nf} setNf={setNf} projects={projects} departments={deptOpts} statuses={statuses} priorities={priorities} members={members} taskTypes={taskTypes} categories={categories} taskSections={taskSections} macroProjects={macroProjects} milestones={milestones} onSave={() => handleCreate(task)} onCancel={() => { setAddingSubtaskTo(null); setNf({}); }} isSubtask={true} />
                )}
                {expandedTasks.has(task.id) && getSubtasks(task.id).map((sub) => (
                  <TaskRow key={sub.id} task={sub} statuses={statuses} priorities={priorities} members={members} taskTypes={taskTypes} categories={categories} taskSections={taskSections} macroProjects={macroProjects} milestones={milestones} departments={departments} projects={projects} expanded={false} subtaskCount={0} onToggle={() => {}} onUpdate={updateField} onAddSubtask={() => {}} onCancel={() => cancelTask(sub.id)} onDelete={() => deleteTask(sub.id)} overdue={getOverdue(sub)} isSubtask selected={selectedTasks.has(sub.id)} onSelect={toggleSelect} />
                ))}
              </React.Fragment>
            ))}
            {paginated.length === 0 && !addingTask && <tr><td colSpan={19} className="text-center py-12 text-muted-foreground">No tasks. Click "Add Task" to create one.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {Math.min(((currentPage-1)*PAGE_SIZE)+1, totalTasks)}–{Math.min(currentPage*PAGE_SIZE, totalTasks)} of {totalTasks}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage===1} onClick={() => setCurrentPage(currentPage-1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            {Array.from({length: totalPages},(_,i)=>i+1).slice(Math.max(0,currentPage-3),currentPage+2).map((p) => (
              <Button key={p} variant={p===currentPage?'default':'ghost'} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setCurrentPage(p)}>{p}</Button>
            ))}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage===totalPages} onClick={() => setCurrentPage(currentPage+1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            <span className="ml-2">{currentPage}/{totalPages}</span>
          </div>
        )}
      </div>
    </div>
    {/* Daily POA Dialog */}
    <DailyPOADialog open={showPOA} onOpenChange={setShowPOA} />
    </>
  );
}

// New Task/Subtask inline row
function NewRow({ nf, setNf, projects, departments, statuses, priorities, members, taskTypes, categories, taskSections, macroProjects, milestones, onSave, onCancel, isSubtask }: any) {
  const macroName = (() => { const proj = projects.find((p:any) => p.id === nf.project_id); if (!proj) return ''; const mp = macroProjects.find((m:any) => m.id === proj.macro_project_id); return mp?.name || ''; })();
  const projMilestones = nf.project_id ? milestones.filter((m:any) => m.project_id === nf.project_id) : milestones;
  return (
    <tr className={`border-b ${isSubtask ? 'bg-green-50/50 dark:bg-green-950/10' : 'bg-primary/5'}`}>
      <td className="py-1 px-1"></td>
      <td className="py-1 px-1"><Plus className="h-3 w-3 text-primary" /></td>
      <td className="py-1 px-1 text-[9px] text-muted-foreground italic">{isSubtask ? 'Sub' : 'New'}</td>
      <td className="py-1 px-0.5"><input value={nf.title||''} onChange={(e) => setNf({...nf, title: e.target.value})} onKeyDown={(e) => { if (e.key==='Enter') onSave(); if (e.key==='Escape') onCancel(); }} placeholder="Title *" className="w-full h-5 text-[10px] bg-transparent border-0 outline-none px-1 focus:ring-1 focus:ring-primary/30 rounded" autoFocus /></td>
      <td className="py-1 px-0.5"><select value={nf.project_id||''} onChange={(e) => setNf({...nf, project_id: e.target.value, department_id: ''})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Project*</option>{projects.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={nf.department_id||''} onChange={(e) => setNf({...nf, department_id: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Dept*</option>{departments.map((d:any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={nf.status_id||''} onChange={(e) => setNf({...nf, status_id: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Status</option>{statuses.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={nf.priority_id||''} onChange={(e) => setNf({...nf, priority_id: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Priority</option>{priorities.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={nf.assignee_id||''} onChange={(e) => setNf({...nf, assignee_id: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Assignee</option>{members.map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={nf.task_type_id||''} onChange={(e) => setNf({...nf, task_type_id: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Type</option>{taskTypes.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={nf.section_id||''} onChange={(e) => setNf({...nf, section_id: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Section</option>{taskSections.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={nf.milestone_id||''} onChange={(e) => setNf({...nf, milestone_id: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Milestone*</option>{projMilestones.map((m:any) => <option key={m.id} value={m.id}>{m.milestone_no}</option>)}</select></td>
      <td className="py-1 px-0.5 text-[9px] text-muted-foreground">{macroName || '-'}</td>
      <td className="py-1 px-0.5"><input type="date" value={nf.planned_start_date||''} onChange={(e) => setNf({...nf, planned_start_date: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none" /></td>
      <td className="py-1 px-0.5"><input type="date" value={nf.planned_end_date||''} onChange={(e) => setNf({...nf, planned_end_date: e.target.value})} className="h-5 text-[9px] w-full bg-transparent border-0 outline-none" /></td>
      <td className="py-1 px-0.5"><input type="number" value={nf.planned_mins||''} onChange={(e) => setNf({...nf, planned_mins: e.target.value})} placeholder="mins" className="h-5 text-[9px] w-full bg-transparent border-0 outline-none" /></td>
      <td className="py-1 px-0.5"><span className="text-[9px] text-muted-foreground italic px-0.5">Auto</span></td>
      <td className="py-1 px-0.5"><span className="text-[9px] text-muted-foreground italic px-0.5">Auto</span></td>
      <td className="py-1 px-0.5"><input type="number" value={nf.actual_mins||''} onChange={(e) => setNf({...nf, actual_mins: e.target.value})} placeholder="mins" className="h-5 text-[9px] w-full bg-transparent border-0 outline-none" /></td>
      <td className="py-1 px-1">-</td>
      <td className="py-1 px-0.5"><input value={nf.remarks||''} onChange={(e) => setNf({...nf, remarks: e.target.value})} placeholder="Remarks" className="h-5 text-[9px] w-full bg-transparent border-0 outline-none" /></td>
      <td className="py-1 px-0.5"><div className="flex gap-0.5"><Button size="sm" className="h-5 text-[8px] px-1.5" onClick={onSave}>Save</Button><Button size="sm" variant="ghost" className="h-5 text-[8px] px-1" onClick={onCancel}>✕</Button></div></td>
    </tr>
  );
}

// Inline editable task row with ALL fields
function TaskRow({ task, statuses, priorities, members, taskTypes, categories, taskSections, macroProjects, milestones, departments, projects, expanded, subtaskCount, onToggle, onUpdate, onAddSubtask, onCancel, onDelete, overdue, isSubtask, selected, onSelect }: any) {
  const status = statuses.find((s: any) => s.id === task.status_id);
  const proj = projects?.find?.((p:any) => p.id === task.project_id);
  const macroName = proj?.macro_project_id ? macroProjects?.find?.((m:any) => m.id === proj.macro_project_id)?.name || '' : '';
  const projMilestones = task.project_id ? milestones.filter((m:any) => m.project_id === task.project_id) : milestones;
  return (
    <tr className={`border-b hover:bg-accent/20 ${isSubtask ? 'bg-muted/10' : ''} ${overdue > 0 && !status?.is_closed ? 'bg-red-50/30 dark:bg-red-950/5' : ''} ${selected ? 'bg-primary/10' : ''}`}>
      <td className="py-1 px-1"><input type="checkbox" checked={selected} onChange={() => onSelect(task.id)} className="h-3 w-3 rounded" /></td>
      <td className="py-1 px-1">
        {!isSubtask && subtaskCount > 0 ? <button onClick={onToggle} className="p-0.5 hover:bg-accent rounded">{expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</button>
        : isSubtask ? <span className="ml-2 text-muted-foreground/40">↳</span> : <span className="text-muted-foreground/20">·</span>}
      </td>
      <td className={`py-1 px-1 font-mono text-[9px] text-muted-foreground ${isSubtask?'pl-4':''}`}>{task.task_no}{!isSubtask && subtaskCount>0 && <span className="text-primary ml-0.5">({subtaskCount})</span>}</td>
      <td className="py-1 px-0.5 align-top"><textarea defaultValue={task.title} onBlur={(e) => { if (e.target.value!==task.title) onUpdate(task.id,'title',e.target.value); }} rows={1} ref={(el) => { if (el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; } }} onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }} className={`w-full bg-transparent outline-none border-0 px-0.5 py-0.5 rounded hover:bg-muted/50 focus:ring-1 focus:ring-primary/20 resize-none overflow-hidden whitespace-pre-wrap ${isSubtask?'text-[10px]':'text-[11px] font-medium'}`} /></td>
      <td className="py-1 px-0.5 text-[9px] text-muted-foreground truncate">{projects?.find?.((p:any)=>p.id===task.project_id)?.name||''}</td>
      <td className="py-1 px-0.5"><select value={task.department_id||''} onChange={(e) => onUpdate(task.id,'department_id',e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded">{departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.status_id} onChange={(e) => onUpdate(task.id,'status_id',e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded font-medium" style={{color:status?.color}}>{statuses.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.priority_id||''} onChange={(e) => onUpdate(task.id,'priority_id',e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{priorities.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.assignee_id||''} onChange={(e) => onUpdate(task.id,'assignee_id',e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{members.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={task.task_type_id||''} onChange={(e) => onUpdate(task.id,'task_type_id',e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{taskTypes.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={(task as any).section_id||''} onChange={(e) => onUpdate(task.id,'section_id',e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{taskSections.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
      <td className="py-1 px-0.5"><select value={(task as any).milestone_id||''} onChange={(e) => onUpdate(task.id,'milestone_id',e.target.value)} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded"><option value="">-</option>{projMilestones.map((m:any)=><option key={m.id} value={m.id}>{m.milestone_no}</option>)}</select></td>
      <td className="py-1 px-0.5 text-[9px] text-muted-foreground">{macroName || '-'}</td>
      <td className="py-1 px-0.5"><input type="date" defaultValue={task.planned_start_date||''} onBlur={(e) => { if (e.target.value!==(task.planned_start_date||'')) onUpdate(task.id,'planned_start_date',e.target.value); }} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded" /></td>
      <td className="py-1 px-0.5"><input type="date" defaultValue={task.planned_end_date||''} onBlur={(e) => { if (e.target.value!==(task.planned_end_date||'')) onUpdate(task.id,'planned_end_date',e.target.value); }} className={`text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded ${overdue>0?'text-red-600 font-bold':''}`} /></td>
      <td className="py-1 px-0.5"><input type="number" defaultValue={task.planned_mins||''} onBlur={(e) => { const v=e.target.value?Number(e.target.value):null; if (v!==task.planned_mins) onUpdate(task.id,'planned_mins',v); }} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded" /></td>
      <td className="py-1 px-0.5"><span className="text-[9px] text-muted-foreground px-0.5">{task.actual_start_date ? formatDate(task.actual_start_date) : '-'}</span></td>
      <td className="py-1 px-0.5"><span className="text-[9px] text-muted-foreground px-0.5">{task.actual_end_date ? formatDate(task.actual_end_date) : '-'}</span></td>
      <td className="py-1 px-0.5"><input type="number" defaultValue={task.actual_mins||''} onBlur={(e) => { const v=e.target.value?Number(e.target.value):null; if (v!==task.actual_mins) onUpdate(task.id,'actual_mins',v); }} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded" /></td>
      <td className={`py-1 px-1 text-[9px] font-bold ${overdue>0?'text-red-600':'text-muted-foreground'}`}>{overdue>0?`${overdue}d`:'-'}</td>
      <td className="py-1 px-0.5 align-top"><textarea defaultValue={task.description||''} onBlur={(e) => { if (e.target.value!==(task.description||'')) onUpdate(task.id,'description',e.target.value); }} rows={1} ref={(el) => { if (el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; } }} onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }} className="text-[9px] bg-transparent border-0 outline-none w-full hover:bg-muted/50 rounded resize-none overflow-hidden whitespace-pre-wrap" /></td>
      <td className="py-1 px-0.5">
        <div className="flex items-center gap-0.5">
          {!isSubtask && <button onClick={onAddSubtask} className="h-4 w-4 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Add subtask"><Plus className="h-2.5 w-2.5" /></button>}
          <button onClick={onCancel} className="h-4 w-4 flex items-center justify-center rounded hover:bg-orange-100 text-muted-foreground hover:text-orange-600 text-[8px]" title="Cancel">✕</button>
          <button onClick={onDelete} className="h-4 w-4 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 text-[8px]" title="Delete">🗑</button>
        </div>
      </td>
    </tr>
  );
}
