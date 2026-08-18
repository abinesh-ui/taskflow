import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/use-access-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NestedFilterBuilder, applyFilters, type FilterCondition } from '@/components/tasks/NestedFilter';
import { SortBuilderInline, type SortLevel } from '@/components/tasks/SortBuilder';
import { useCreateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { formatDate, getOverdueDays } from '@/lib/utils';
import { Plus, ChevronDown, ChevronRight, Filter, SlidersHorizontal, X, Search, Save, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

interface MobileProps { filterProjectId?: string; filterDepartmentId?: string; filterMacroProjectId?: string; }

export default function MobileTaskView({ filterProjectId, filterDepartmentId, filterMacroProjectId }: MobileProps = {}) {
  const { user } = useAuth();
  const { userProjectIds, memberId } = useAccessControl();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [showSubtasks, setShowSubtasks] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [createParent, setCreateParent] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [allExpanded, setAllExpanded] = useState(false);
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([{ field: 'planned_end_date', direction: 'asc' }]);
  const [nf, setNf] = useState<Record<string, string>>({});
  const [editingFields, setEditingFields] = useState<Record<string, string>>({});

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as MasterPriority[]; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<Project & { color?: string; macro_project_id?: string }>; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Array<Department & { color?: string }>; } });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['master_task_types'], queryFn: async () => { const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color?: string }>; } });
  const { data: taskSections = [] } = useQuery({ queryKey: ['master_task_sections'], queryFn: async () => { const { data } = await supabase.from('master_task_sections').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color?: string }>; } });
  const { data: macroProjects = [] } = useQuery({ queryKey: ['master_macro_projects'], queryFn: async () => { const { data } = await supabase.from('master_macro_projects').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*').order('created_at'); return (data || []) as Array<{ id: string; milestone_no: string; project_id: string; description: string }>; } });
  const { data: projectMembers = [] } = useQuery({ queryKey: ['project_members'], queryFn: async () => { const { data } = await supabase.from('project_members').select('*'); return (data || []) as Array<{ id: string; project_id: string; member_id: string }>; } });

  // Filter + sort
  let topTasks = allTasks.filter((t) => !t.parent_id);
  // Access control: non-admin only sees assigned projects
  if (userProjectIds) topTasks = topTasks.filter((t) => userProjectIds.includes(t.project_id));
  if (filterMacroProjectId) {
    const macroProjIds = new Set(projects.filter((p: any) => p.macro_project_id === filterMacroProjectId).map((p: any) => p.id));
    topTasks = topTasks.filter((t) => macroProjIds.has(t.project_id));
  }
  if (filterProjectId) topTasks = topTasks.filter((t) => t.project_id === filterProjectId);
  if (filterDepartmentId) topTasks = topTasks.filter((t) => t.department_id === filterDepartmentId);
  if (searchQuery) { const q = searchQuery.toLowerCase(); topTasks = topTasks.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q)); }

  const projectMap = new Map(projects.map((p: any) => [p.id, p]));
  const topTasksWithMacro = topTasks.map((t) => ({
    ...t,
    macro_project_id: (projectMap.get(t.project_id) as any)?.macro_project_id || null,
  }));
  topTasks = applyFilters(topTasksWithMacro, filterConditions, getOverdue);
  topTasks.sort((a, b) => { for (const l of sortLevels) { const av = (a as any)[l.field] || ''; const bv = (b as any)[l.field] || ''; if (av < bv) return l.direction === 'asc' ? -1 : 1; if (av > bv) return l.direction === 'asc' ? 1 : -1; } return 0; });

  function getSubtasks(id: string) { return allTasks.filter((t) => t.parent_id === id); }
  function getStatus(id: string) { return statuses.find((s) => s.id === id); }
  function getPriority(id: string | null) { return id ? priorities.find((p) => p.id === id) : null; }
  function getMember(id: string | null) { return id ? members.find((m) => m.id === id)?.name || '' : ''; }
  function getOverdue(t: Task) { const s = getStatus(t.status_id); return getOverdueDays(t.planned_end_date, s?.is_closed ?? false); }
  function getFilteredMembers(projectId: string | null | undefined) { if (!projectId) return members; const pmIds = projectMembers.filter((pm) => pm.project_id === projectId).map((pm) => pm.member_id); return pmIds.length > 0 ? members.filter((m) => pmIds.includes(m.id)) : members; }

  // Returns true if status name requires actual_mins
  function statusRequiresActualMins(statusId: string): boolean {
    const name = (statuses.find((s) => s.id === statusId)?.name || '').trim().toLowerCase();
    return ['done', 'dropped', 'hold'].includes(name);
  }

  async function handleCreate() {
    if (!nf.title?.trim() || !nf.project_id || !nf.department_id) { toast({ variant: 'destructive', title: 'Required', description: 'Title, Project, Department needed' }); return; }
    const defStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({ title: nf.title.trim(), project_id: nf.project_id, department_id: nf.department_id, status_id: nf.status_id || defStatus?.id || '', priority_id: nf.priority_id || null, assignee_id: nf.assignee_id || null, assigner_id: nf.assigner_id || null, task_type_id: nf.task_type_id || null, section_id: nf.section_id || null, milestone_id: nf.milestone_id || null, planned_start_date: nf.planned_start_date || null, planned_end_date: nf.planned_end_date || null, planned_mins: nf.planned_mins ? Number(nf.planned_mins) : null, actual_mins: nf.actual_mins ? Number(nf.actual_mins) : null, description: nf.description || null, parent_id: createParent?.id || null, category_id: createParent?.category_id || null, position: 0, is_recurring: !!nf.recurrence_type, recurrence_type: nf.recurrence_type || null, recurrence_trigger: nf.recurrence_type ? 'on_status_closed' : null, recur_forever: !!nf.recurrence_type } as any, {
      onSuccess: () => { setNf({}); setShowCreate(false); setCreateParent(null); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); toast({ title: 'Task created' }); },
    });
  }

  async function saveField(taskId: string, field: string, value: any) {
    // Actual mins mandatory when status is Done/Dropped/Hold
    if (field === 'status_id' && statusRequiresActualMins(value)) {
      const task = allTasks.find((t) => t.id === taskId);
      const taskActualMins = task ? (task as any).actual_mins : null;
      if (!taskActualMins || Number(taskActualMins) <= 0) {
        toast({ variant: 'destructive', title: 'Actual Mins Required', description: `Please fill Actual Mins before setting status to "${statuses.find((s) => s.id === value)?.name}"` });
        return;
      }
    }
    const task = allTasks.find((t) => t.id === taskId);
    const oldValue = task ? String((task as any)[field] ?? '') : '';
    await supabase.from('tasks').update({ [field]: value || null }).eq('id', taskId);
    // Log edit
    if (task && user) {
      supabase.from('task_edit_log').insert({ task_id: taskId, task_no: task.task_no, field_name: field, old_value: oldValue || null, new_value: String(value ?? '') || null, edited_by: user.id, edited_by_name: user.email || 'Unknown' }).then(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  }

  function startEdit(task: Task) {
    setEditingFields({ title: task.title, status_id: task.status_id, priority_id: task.priority_id || '', assignee_id: task.assignee_id || '', assigner_id: (task as any).assigner_id || '', task_type_id: task.task_type_id || '', section_id: (task as any).section_id || '', milestone_id: (task as any).milestone_id || '', planned_start_date: task.planned_start_date || '', planned_end_date: task.planned_end_date || '', planned_mins: task.planned_mins?.toString() || '', actual_mins: task.actual_mins?.toString() || '', description: task.description || '', recurrence_type: (task as any).recurrence_type || '', is_recurring: (task as any).is_recurring ? 'true' : '' });
  }

  async function saveAll(taskId: string) {
    const task = allTasks.find((t) => t.id === taskId);
    const updates: Record<string, any> = {};
    if (editingFields.title) updates.title = editingFields.title;
    if (editingFields.status_id) updates.status_id = editingFields.status_id;
    updates.priority_id = editingFields.priority_id || null;
    updates.assignee_id = editingFields.assignee_id || null;
    updates.assigner_id = editingFields.assigner_id || null;
    updates.task_type_id = editingFields.task_type_id || null;
    updates.section_id = editingFields.section_id || null;
    updates.milestone_id = editingFields.milestone_id || null;
    updates.planned_start_date = editingFields.planned_start_date || null;
    updates.planned_end_date = editingFields.planned_end_date || null;
    updates.planned_mins = editingFields.planned_mins ? Number(editingFields.planned_mins) : null;
    updates.actual_mins = editingFields.actual_mins ? Number(editingFields.actual_mins) : null;
    updates.description = editingFields.description || null;
    updates.is_recurring = !!editingFields.recurrence_type;
    updates.recurrence_type = editingFields.recurrence_type || null;
    updates.recurrence_trigger = editingFields.recurrence_type ? 'on_status_closed' : null;
    updates.recur_forever = !!editingFields.recurrence_type;
    // Validate: actual_mins mandatory for Done/Dropped/Hold
    const finalStatusId = updates.status_id ?? task?.status_id;
    const finalActualMins = updates.actual_mins ?? task?.actual_mins;
    if (finalStatusId && statusRequiresActualMins(finalStatusId) && (!finalActualMins || Number(finalActualMins) <= 0)) {
      toast({ variant: 'destructive', title: 'Actual Mins Required', description: `Please fill Actual Mins before setting status to "${statuses.find((s) => s.id === finalStatusId)?.name}"` });
      return;
    }
    await supabase.from('tasks').update(updates).eq('id', taskId);
    // Log edits for changed fields
    if (task && user) {
      const logs = Object.entries(updates).filter(([k, v]) => String(v ?? '') !== String((task as any)[k] ?? '')).map(([k, v]) => ({ task_id: taskId, task_no: task.task_no, field_name: k, old_value: String((task as any)[k] ?? '') || null, new_value: String(v ?? '') || null, edited_by: user.id, edited_by_name: user.email || 'Unknown' }));
      if (logs.length > 0) supabase.from('task_edit_log').insert(logs).then(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    toast({ title: 'Saved' });
  }

  const deptOpts = departments; // Departments are open - visible to all users
  const projectOpts = userProjectIds ? projects.filter((p) => userProjectIds.includes(p.id)) : projects;

  function renderEditableCard(task: Task, isSubtask: boolean) {
    const status = getStatus(task.status_id);
    const priority = getPriority(task.priority_id);
    const overdue = getOverdue(task);
    const isExp = isSubtask ? expandedSub === task.id : expandedTask === task.id;
    const proj = projects.find((p) => p.id === task.project_id);
    const dept = departments.find((d) => d.id === task.department_id);
    const assignee = members.find((m) => m.id === task.assignee_id);
    const taskType = taskTypes.find((t) => t.id === task.task_type_id);

    return (
      <div key={task.id} className={`border rounded-xl overflow-hidden shadow-sm ${overdue > 0 ? 'border-red-300 shadow-red-100' : 'border-border/60'} ${isSubtask ? 'ml-4' : ''}`} style={{ borderLeftWidth: '4px', borderLeftColor: status?.color || '#6b7280' }}>
        {/* Card summary - tap to expand */}
        <div className="p-3 space-y-1.5" onClick={() => { if (isSubtask) setExpandedSub(isExp ? null : task.id); else { setExpandedTask(isExp ? null : task.id); startEdit(task); } if (!isSubtask && !isExp) startEdit(task); if (isSubtask && !isExp) startEdit(task); }}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className={`font-semibold leading-tight truncate ${isSubtask ? 'text-xs' : 'text-sm'}`} title={task.title}>{task.title}</p>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                <span className="text-[8px] font-mono bg-muted/80 px-1 py-0.5 rounded">{task.task_no}</span>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: status?.color || '#6b7280' }}>{status?.name}</span>
                {priority && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: priority.color + '25', color: priority.color }}>{priority.name}</span>}
                {proj && <span className="text-[8px] font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: (proj as any).color || '#3b82f6' }}>{proj.name}</span>}
                {dept && <span className="text-[8px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: ((dept as any).color || '#8b5cf6') + '25', color: (dept as any).color || '#8b5cf6' }}>{dept.name}</span>}
              </div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {assignee && <span className="text-[8px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: (assignee.color || '#06b6d4') + '20', color: assignee.color || '#06b6d4' }}>{assignee.name}</span>}
                {taskType && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: ((taskType as any).color || '#f59e0b') + '20', color: (taskType as any).color || '#f59e0b' }}>{taskType.name}</span>}
                {task.planned_end_date && <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{formatDate(task.planned_end_date)}</span>}
                {overdue > 0 && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-red-500 text-white">{overdue}d overdue</span>}
                {(task as any).is_recurring && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700">Recurring</span>}
                {!isSubtask && getSubtasks(task.id).length > 0 && <button onClick={(e) => { e.stopPropagation(); const n = new Set(showSubtasks); if (n.has(task.id)) n.delete(task.id); else n.add(task.id); setShowSubtasks(n); }}><span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{getSubtasks(task.id).length} sub</span></button>}
              </div>
            </div>
            {isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />}
          </div>
        </div>

        {/* Expanded - all editable fields */}
        {isExp && (
          <div className="border-t px-3 pb-3 pt-2 space-y-2 bg-gradient-to-b from-muted/20 to-muted/5">
            {/* Status bar - vibrant colored buttons */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {statuses.map((s) => (
                <button key={s.id} onClick={() => { setEditingFields({...editingFields, status_id: s.id}); saveField(task.id, 'status_id', s.id); }} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold flex-shrink-0 transition-all ${task.status_id === s.id ? 'ring-2 ring-offset-1 ring-primary shadow-md scale-105 text-white' : 'opacity-70'}`} style={{ backgroundColor: task.status_id === s.id ? s.color : s.color+'20', color: task.status_id === s.id ? '#fff' : s.color, borderColor: s.color }}>{s.name}</button>
              ))}
            </div>

            {/* Editable fields */}
            <div className="space-y-2">
              <div><label className="text-[9px] text-primary font-semibold uppercase tracking-wide">Title</label><textarea value={editingFields.title || ''} onChange={(e) => setEditingFields({...editingFields, title: e.target.value})} className="w-full h-auto min-h-[32px] text-xs border rounded-lg px-2 py-1.5 bg-background resize-none focus:ring-2 focus:ring-primary/30" /></div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-orange-600 font-semibold">Priority</label><select value={editingFields.priority_id} onChange={(e) => setEditingFields({...editingFields, priority_id: e.target.value})} className="w-full h-8 text-xs border rounded-lg px-2 bg-background font-medium" style={editingFields.priority_id ? {backgroundColor: (priorities.find(p=>p.id===editingFields.priority_id)?.color||'')+'15', color: priorities.find(p=>p.id===editingFields.priority_id)?.color} : {}}><option value="">-</option>{priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="text-[9px] text-cyan-600 font-semibold">Assignee</label><select value={editingFields.assignee_id} onChange={(e) => setEditingFields({...editingFields, assignee_id: e.target.value})} className="w-full h-8 text-xs border rounded-lg px-2 bg-background font-medium" style={editingFields.assignee_id ? {backgroundColor: (members.find(m=>m.id===editingFields.assignee_id)?.color||'')+'15', color: members.find(m=>m.id===editingFields.assignee_id)?.color} : {}}><option value="">-</option>{getFilteredMembers(task.project_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-teal-600 font-semibold">Assigner</label><select value={editingFields.assigner_id || ''} onChange={(e) => setEditingFields({...editingFields, assigner_id: e.target.value})} className="w-full h-8 text-xs border rounded-lg px-2 bg-background font-medium" style={editingFields.assigner_id ? {backgroundColor: (members.find(m=>m.id===editingFields.assigner_id)?.color||'')+'15', color: members.find(m=>m.id===editingFields.assigner_id)?.color} : {}}><option value="">-</option>{getFilteredMembers(task.project_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                <div><label className="text-[9px] text-amber-600 font-semibold">Type</label><select value={editingFields.task_type_id} onChange={(e) => setEditingFields({...editingFields, task_type_id: e.target.value})} className="w-full h-8 text-xs border rounded-lg px-2 bg-background font-medium" style={editingFields.task_type_id ? {backgroundColor: ((taskTypes.find(t=>t.id===editingFields.task_type_id) as any)?.color||'')+'15', color: (taskTypes.find(t=>t.id===editingFields.task_type_id) as any)?.color} : {}}><option value="">-</option>{taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label className="text-[9px] text-emerald-600 font-semibold">Section</label><select value={editingFields.section_id} onChange={(e) => setEditingFields({...editingFields, section_id: e.target.value})} className="w-full h-8 text-xs border rounded-lg px-2 bg-background font-medium" style={editingFields.section_id ? {backgroundColor: ((taskSections.find(s=>s.id===editingFields.section_id) as any)?.color||'')+'15', color: (taskSections.find(s=>s.id===editingFields.section_id) as any)?.color} : {}}><option value="">-</option>{taskSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-indigo-600 font-semibold">Milestone</label><select value={editingFields.milestone_id} onChange={(e) => setEditingFields({...editingFields, milestone_id: e.target.value})} className="w-full h-8 text-xs border rounded-lg px-2 bg-background"><option value="">-</option>{milestones.filter((m) => m.project_id === task.project_id).map((m) => <option key={m.id} value={m.id}>{m.description}</option>)}</select></div>
                <div><label className="text-[9px] text-slate-600 font-semibold">Plan Mins</label><Input type="number" value={editingFields.planned_mins} onChange={(e) => setEditingFields({...editingFields, planned_mins: e.target.value})} className="h-8 text-xs rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-blue-600 font-semibold">Start Date</label><Input type="date" value={editingFields.planned_start_date} onChange={(e) => setEditingFields({...editingFields, planned_start_date: e.target.value})} className="h-8 text-xs rounded-lg" /></div>
                <div><label className="text-[9px] text-rose-600 font-semibold">Due Date</label><Input type="date" value={editingFields.planned_end_date} onChange={(e) => setEditingFields({...editingFields, planned_end_date: e.target.value})} className="h-8 text-xs rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-slate-500 font-semibold">Act. Start</label><span className="block text-xs text-muted-foreground px-2 py-1 bg-muted/30 rounded-lg">{formatDate(task.actual_start_date) || '-'}</span></div>
                <div><label className="text-[9px] text-slate-500 font-semibold">Act. End</label><span className="block text-xs text-muted-foreground px-2 py-1 bg-muted/30 rounded-lg">{formatDate(task.actual_end_date) || '-'}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-slate-600 font-semibold">Act. Mins</label><Input type="number" value={editingFields.actual_mins} onChange={(e) => setEditingFields({...editingFields, actual_mins: e.target.value})} className="h-8 text-xs rounded-lg" /></div>
                <div><label className="text-[9px] text-purple-600 font-semibold">Recurring</label><select value={editingFields.recurrence_type || ''} onChange={(e) => setEditingFields({...editingFields, recurrence_type: e.target.value})} className="w-full h-8 text-xs border rounded-lg px-2 bg-background" style={editingFields.recurrence_type ? {backgroundColor: '#8b5cf620', color: '#8b5cf6'} : {}}><option value="">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
              </div>
              <div><label className="text-[9px] text-slate-600 font-semibold">Remarks</label><textarea value={editingFields.description || ''} onChange={(e) => setEditingFields({...editingFields, description: e.target.value})} className="w-full min-h-[40px] text-xs border rounded-lg px-2 py-1.5 bg-background resize-none" placeholder="Notes..." /></div>

              <Button className="w-full h-9 text-xs font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-md" onClick={() => saveAll(task.id)}><Save className="h-3.5 w-3.5 mr-1" /> Save Changes</Button>
            </div>

            {/* Add subtask */}
            {!isSubtask && (
              <Button size="sm" variant="outline" className="w-full h-8 text-[10px]" onClick={() => { setCreateParent(task); setNf({ project_id: task.project_id, department_id: task.department_id }); setShowCreate(true); }}>
                <Plus className="h-3 w-3 mr-1" /> Add Subtask
              </Button>
            )}

            {/* Subtasks */}
            {!isSubtask && getSubtasks(task.id).length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Subtasks ({getSubtasks(task.id).length})</span>
                {getSubtasks(task.id).map((sub) => renderEditableCard(sub, true))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="md:hidden flex flex-col h-full">
      {/* Search + Filter + Sort bar */}
      <div className="p-3 border-b bg-gradient-to-r from-card to-card/95 space-y-2 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/60" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tasks..." className="h-8 pl-8 text-xs rounded-lg border-primary/20 focus:border-primary" />
          </div>
          <Button variant={showFilters ? 'default' : 'outline'} size="icon" className={`h-8 w-8 rounded-lg ${showFilters ? 'bg-primary text-white' : ''}`} onClick={() => { setShowFilters(!showFilters); setShowSort(false); }}>
            <Filter className="h-3.5 w-3.5" />
          </Button>
          <Button variant={showSort ? 'default' : 'outline'} size="icon" className={`h-8 w-8 rounded-lg ${showSort ? 'bg-primary text-white' : ''}`} onClick={() => { setShowSort(!showSort); setShowFilters(false); }}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Nested filter builder (same as web) */}
        {showFilters && (() => {
          // Scope filter options to current context (project/dept/macro)
          const ctxProjectIds: string[] | null = (() => {
            if (filterProjectId) return [filterProjectId];
            if (filterMacroProjectId) {
              const ids = projects.filter((p: any) => p.macro_project_id === filterMacroProjectId).map((p: any) => p.id);
              return ids.length > 0 ? ids : null;
            }
            return userProjectIds;
          })();
          const ctxProjects = ctxProjectIds ? projects.filter((p) => ctxProjectIds.includes(p.id)) : projects;
          const ctxDepts = ctxProjectIds ? departments.filter((d: any) => ctxProjectIds.includes(d.project_id)) : departments;
          const ctxMemberIds = ctxProjectIds
            ? [...new Set(projectMembers.filter((pm) => ctxProjectIds.includes(pm.project_id)).map((pm) => pm.member_id))]
            : null;
          const ctxMembers = ctxMemberIds ? members.filter((m) => ctxMemberIds.includes(m.id)) : members;
          const ctxMilestones = ctxProjectIds ? milestones.filter((m) => ctxProjectIds.includes(m.project_id)) : milestones;
          // Task types & sections: only those used by tasks in this context
          const ctxTasks = (() => {
            let t = allTasks.filter((t) => !t.parent_id);
            if (ctxProjectIds) t = t.filter((t) => ctxProjectIds.includes(t.project_id));
            if (filterDepartmentId) t = t.filter((t) => t.department_id === filterDepartmentId);
            return t;
          })();
          const ctxUsedTypeIds = ctxProjectIds ? new Set(ctxTasks.map((t) => t.task_type_id).filter(Boolean)) : null;
          const ctxUsedSectionIds = ctxProjectIds ? new Set(ctxTasks.map((t) => (t as any).section_id).filter(Boolean)) : null;
          const ctxTypes = ctxUsedTypeIds ? taskTypes.filter((t) => ctxUsedTypeIds.has(t.id)) : taskTypes;
          const ctxSections = ctxUsedSectionIds ? taskSections.filter((s) => ctxUsedSectionIds.has(s.id)) : taskSections;
          const ctxMacroProjects = filterProjectId
            ? macroProjects.filter((m) => { const proj = projects.find((p: any) => p.id === filterProjectId); return proj && (proj as any).macro_project_id === m.id; })
            : filterMacroProjectId
            ? macroProjects.filter((m) => m.id === filterMacroProjectId)
            : macroProjects;

          return (
            <NestedFilterBuilder
              fields={[
                { key: 'macro_project_id', label: 'Macro Project', type: 'select' as const, options: ctxMacroProjects.map((m) => ({ value: m.id, label: m.name, color: m.color })) },
                { key: 'project_id', label: 'Project', type: 'select' as const, options: ctxProjects.map((p) => ({ value: p.id, label: p.name })) },
                { key: 'department_id', label: 'Department', type: 'select' as const, options: ctxDepts.map((d) => ({ value: d.id, label: d.name })) },
                { key: 'status_id', label: 'Status', type: 'select' as const, options: statuses.map((s) => ({ value: s.id, label: s.name, color: s.color })) },
                { key: 'priority_id', label: 'Priority', type: 'select' as const, options: priorities.map((p) => ({ value: p.id, label: p.name, color: p.color })) },
                { key: 'assignee_id', label: 'Assignee', type: 'select' as const, options: ctxMembers.map((m) => ({ value: m.id, label: m.name })) },
                { key: 'task_type_id', label: 'Type', type: 'select' as const, options: ctxTypes.map((t) => ({ value: t.id, label: t.name })) },
                { key: 'section_id', label: 'Section', type: 'select' as const, options: ctxSections.map((s) => ({ value: s.id, label: s.name })) },
                { key: 'milestone_id', label: 'Milestone', type: 'select' as const, options: ctxMilestones.map((m) => ({ value: m.id, label: (m as any).milestone_no ? `${(m as any).milestone_no}: ${m.description}` : m.description })) },
                { key: 'overdue_days', label: 'Overdue Days', type: 'number' as const },
                { key: 'due_date', label: 'Due Date', type: 'date' as const },
              ]}
              conditions={filterConditions}
              onChange={setFilterConditions}
            />
          );
        })()}

        {/* Multi-level Sort (same as web) */}
        {showSort && (
          <SortBuilderInline sortLevels={sortLevels} onSortChange={setSortLevels} />
        )}

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-primary/70">{topTasks.length} tasks</span>
          <Button variant="outline" size="sm" className="h-6 text-[9px] rounded-lg" onClick={() => { if (allExpanded) { setShowSubtasks(new Set()); setAllExpanded(false); } else { setShowSubtasks(new Set(topTasks.map((t) => t.id))); setAllExpanded(true); } }}>
            {allExpanded ? <><ChevronsUp className="h-3 w-3 mr-0.5" />Collapse</> : <><ChevronsDown className="h-3 w-3 mr-0.5" />Expand All</>}
          </Button>
        </div>
      </div>

      {/* Task Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-24">
        {topTasks.map((task) => (
          <div key={task.id}>
            {renderEditableCard(task, false)}
            {/* Show subtask cards when expanded (via Expand All or tap on subtask count) */}
            {showSubtasks.has(task.id) && !expandedTask && getSubtasks(task.id).map((sub) => renderEditableCard(sub, true))}
          </div>
        ))}
        {topTasks.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No tasks found</p>}
      </div>

      {/* Floating Add - hidden when create sheet is open */}
      {!showCreate && (
        <button onClick={() => { setCreateParent(null); setNf({ project_id: filterProjectId || '', department_id: filterDepartmentId || '' }); setShowCreate(true); }} className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-white shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform z-50 md:hidden">
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Create Bottom Sheet */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowCreate(false); setCreateParent(null); }} />
          <div className="relative bg-card rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl animate-in slide-in-from-bottom duration-300">
            {/* Header - sticky */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
              <h3 className="font-bold text-sm text-primary">{createParent ? 'New Subtask' : 'New Task'}</h3>
              <button onClick={() => { setShowCreate(false); setCreateParent(null); }} className="p-1 rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <Input value={nf.title || ''} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="Title *" className="h-10" autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.project_id || ''} onChange={(e) => setNf({ ...nf, project_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Project *</option>{projectOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <select value={nf.department_id || ''} onChange={(e) => setNf({ ...nf, department_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Dept *</option>{deptOpts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.status_id || ''} onChange={(e) => setNf({ ...nf, status_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Status</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={nf.priority_id || ''} onChange={(e) => setNf({ ...nf, priority_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Priority</option>{priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.assignee_id || ''} onChange={(e) => setNf({ ...nf, assignee_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Assignee</option>{getFilteredMembers(nf.project_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <select value={nf.assigner_id || ''} onChange={(e) => setNf({ ...nf, assigner_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Assigner</option>{getFilteredMembers(nf.project_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.task_type_id || ''} onChange={(e) => setNf({ ...nf, task_type_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Type</option>{taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <select value={nf.section_id || ''} onChange={(e) => setNf({ ...nf, section_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Section</option>{taskSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={nf.milestone_id || ''} onChange={(e) => setNf({ ...nf, milestone_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Milestone</option>{(nf.project_id ? milestones.filter((m) => m.project_id === nf.project_id) : []).map((m) => <option key={m.id} value={m.id}>{m.description}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.recurrence_type || ''} onChange={(e) => setNf({ ...nf, recurrence_type: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Recurring</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
                <div><label className="text-[9px] text-muted-foreground">Plan Mins</label><Input type="number" value={nf.planned_mins || ''} onChange={(e) => setNf({ ...nf, planned_mins: e.target.value })} className="h-9 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Start</label><Input type="date" value={nf.planned_start_date || ''} onChange={(e) => setNf({ ...nf, planned_start_date: e.target.value })} className="h-9 text-xs" /></div>
                <div><label className="text-[9px] text-muted-foreground">Due</label><Input type="date" value={nf.planned_end_date || ''} onChange={(e) => setNf({ ...nf, planned_end_date: e.target.value })} className="h-9 text-xs" /></div>
              </div>
              <div><label className="text-[9px] text-muted-foreground">Remarks</label><Input value={nf.description || ''} onChange={(e) => setNf({ ...nf, description: e.target.value })} className="h-9 text-xs" placeholder="Notes..." /></div>
            </div>
            {/* Sticky Save button at bottom */}
            <div className="p-4 border-t flex-shrink-0 bg-card safe-area-bottom">
              <Button className="w-full h-11 font-bold text-sm bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg" onClick={handleCreate} disabled={createTask.isPending || !nf.title?.trim() || !nf.project_id || !nf.department_id}>
                {createTask.isPending ? 'Creating...' : createParent ? 'Create Subtask' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
