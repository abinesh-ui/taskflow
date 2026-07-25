import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NestedFilterBuilder, applyFilters, type FilterCondition } from '@/components/tasks/NestedFilter';
import { useCreateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { formatDate, getOverdueDays } from '@/lib/utils';
import { Plus, ChevronDown, ChevronRight, Filter, SlidersHorizontal, X, Search, ArrowUp, ArrowDown, Save, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

interface MobileProps { filterProjectId?: string; filterDepartmentId?: string; }

export default function MobileTaskView({ filterProjectId, filterDepartmentId }: MobileProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createParent, setCreateParent] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [allExpanded, setAllExpanded] = useState(false);
  const [sortField, setSortField] = useState('planned_end_date');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [nf, setNf] = useState<Record<string, string>>({});
  const [editingFields, setEditingFields] = useState<Record<string, string>>({});

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as MasterPriority[]; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['master_task_types'], queryFn: async () => { const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: taskSections = [] } = useQuery({ queryKey: ['master_task_sections'], queryFn: async () => { const { data } = await supabase.from('master_task_sections').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*').order('created_at'); return (data || []) as Array<{ id: string; milestone_no: string; project_id: string }>; } });

  // Filter + sort
  let topTasks = allTasks.filter((t) => !t.parent_id);
  if (filterProjectId) topTasks = topTasks.filter((t) => t.project_id === filterProjectId);
  if (filterDepartmentId) topTasks = topTasks.filter((t) => t.department_id === filterDepartmentId);
  if (searchQuery) { const q = searchQuery.toLowerCase(); topTasks = topTasks.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q)); }
  topTasks = applyFilters(topTasks, filterConditions, getOverdue);
  topTasks.sort((a, b) => { const av = (a as any)[sortField] || ''; const bv = (b as any)[sortField] || ''; return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); });

  function getSubtasks(id: string) { return allTasks.filter((t) => t.parent_id === id); }
  function getStatus(id: string) { return statuses.find((s) => s.id === id); }
  function getPriority(id: string | null) { return id ? priorities.find((p) => p.id === id) : null; }
  function getMember(id: string | null) { return id ? members.find((m) => m.id === id)?.name || '' : ''; }
  function getOverdue(t: Task) { const s = getStatus(t.status_id); return getOverdueDays(t.planned_end_date, s?.is_closed ?? false); }

  async function handleCreate() {
    if (!nf.title?.trim() || !nf.project_id || !nf.department_id) { toast({ variant: 'destructive', title: 'Required', description: 'Title, Project, Department needed' }); return; }
    const defStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({ title: nf.title.trim(), project_id: nf.project_id, department_id: nf.department_id, status_id: nf.status_id || defStatus?.id || '', priority_id: nf.priority_id || null, assignee_id: nf.assignee_id || null, task_type_id: nf.task_type_id || null, section_id: nf.section_id || null, milestone_id: nf.milestone_id || null, planned_start_date: nf.planned_start_date || null, planned_end_date: nf.planned_end_date || null, planned_mins: nf.planned_mins ? Number(nf.planned_mins) : null, actual_mins: nf.actual_mins ? Number(nf.actual_mins) : null, description: nf.description || null, parent_id: createParent?.id || null, category_id: createParent?.category_id || null, position: 0 } as any, {
      onSuccess: () => { setNf({}); setShowCreate(false); setCreateParent(null); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); },
    });
  }

  async function saveField(taskId: string, field: string, value: any) {
    await supabase.from('tasks').update({ [field]: value || null }).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  }

  function startEdit(task: Task) {
    setEditingFields({ title: task.title, status_id: task.status_id, priority_id: task.priority_id || '', assignee_id: task.assignee_id || '', task_type_id: task.task_type_id || '', section_id: (task as any).section_id || '', milestone_id: (task as any).milestone_id || '', planned_start_date: task.planned_start_date || '', planned_end_date: task.planned_end_date || '', planned_mins: task.planned_mins?.toString() || '', actual_mins: task.actual_mins?.toString() || '', description: task.description || '' });
  }

  async function saveAll(taskId: string) {
    const updates: Record<string, any> = {};
    if (editingFields.title) updates.title = editingFields.title;
    if (editingFields.status_id) updates.status_id = editingFields.status_id;
    updates.priority_id = editingFields.priority_id || null;
    updates.assignee_id = editingFields.assignee_id || null;
    updates.task_type_id = editingFields.task_type_id || null;
    updates.section_id = editingFields.section_id || null;
    updates.milestone_id = editingFields.milestone_id || null;
    updates.planned_start_date = editingFields.planned_start_date || null;
    updates.planned_end_date = editingFields.planned_end_date || null;
    updates.planned_mins = editingFields.planned_mins ? Number(editingFields.planned_mins) : null;
    updates.actual_mins = editingFields.actual_mins ? Number(editingFields.actual_mins) : null;
    updates.description = editingFields.description || null;
    await supabase.from('tasks').update(updates).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    toast({ title: 'Saved' });
  }

  const deptOpts = nf.project_id ? departments.filter((d) => d.project_id === nf.project_id) : departments;

  function renderEditableCard(task: Task, isSubtask: boolean) {
    const status = getStatus(task.status_id);
    const overdue = getOverdue(task);
    const isExp = isSubtask ? expandedSub === task.id : (expandedTask === task.id || allExpanded);

    return (
      <div key={task.id} className={`border rounded-xl overflow-hidden ${overdue > 0 ? 'border-red-200' : ''} ${isSubtask ? 'ml-4' : ''}`}>
        {/* Card summary - tap to expand */}
        <div className="p-3 space-y-1" onClick={() => { if (isSubtask) setExpandedSub(isExp ? null : task.id); else { setExpandedTask(isExp ? null : task.id); startEdit(task); } if (!isSubtask && !isExp) startEdit(task); if (isSubtask && !isExp) startEdit(task); }}>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className={`font-medium leading-tight ${isSubtask ? 'text-xs' : 'text-sm'}`}>{task.title}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[9px] font-mono text-muted-foreground">{task.task_no}</span>
                <Badge style={{ backgroundColor: status?.color, color: '#fff' }} className="text-[8px] h-4">{status?.name}</Badge>
                <span className="text-[9px] text-muted-foreground">{projects.find((p) => p.id === task.project_id)?.name}</span>
                {task.planned_end_date && <span className={`text-[9px] ${overdue > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>{formatDate(task.planned_end_date)}</span>}
                {overdue > 0 && <Badge variant="destructive" className="text-[7px] h-3.5">{overdue}d</Badge>}
                {!isSubtask && getSubtasks(task.id).length > 0 && <Badge variant="secondary" className="text-[7px] h-3.5">{getSubtasks(task.id).length} sub</Badge>}
              </div>
            </div>
            {isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>
        </div>

        {/* Expanded - all editable fields */}
        {isExp && (
          <div className="border-t px-3 pb-3 pt-2 space-y-2 bg-muted/10">
            {/* Status bar */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {statuses.map((s) => (
                <button key={s.id} onClick={() => { setEditingFields({...editingFields, status_id: s.id}); saveField(task.id, 'status_id', s.id); }} className={`px-2 py-1 rounded text-[8px] font-medium flex-shrink-0 border ${task.status_id === s.id ? 'ring-2 ring-primary' : ''}`} style={{ backgroundColor: task.status_id === s.id ? s.color+'20' : 'transparent', borderColor: s.color, color: s.color }}>{s.name}</button>
              ))}
            </div>

            {/* Editable fields */}
            <div className="space-y-2">
              <div><label className="text-[9px] text-muted-foreground font-medium">Title</label><textarea value={editingFields.title || ''} onChange={(e) => setEditingFields({...editingFields, title: e.target.value})} className="w-full h-auto min-h-[32px] text-xs border rounded px-2 py-1 bg-background resize-none" /></div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Priority</label><select value={editingFields.priority_id} onChange={(e) => setEditingFields({...editingFields, priority_id: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-background"><option value="">-</option>{priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="text-[9px] text-muted-foreground">Assignee</label><select value={editingFields.assignee_id} onChange={(e) => setEditingFields({...editingFields, assignee_id: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-background"><option value="">-</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Type</label><select value={editingFields.task_type_id} onChange={(e) => setEditingFields({...editingFields, task_type_id: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-background"><option value="">-</option>{taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label className="text-[9px] text-muted-foreground">Section</label><select value={editingFields.section_id} onChange={(e) => setEditingFields({...editingFields, section_id: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-background"><option value="">-</option>{taskSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Milestone</label><select value={editingFields.milestone_id} onChange={(e) => setEditingFields({...editingFields, milestone_id: e.target.value})} className="w-full h-8 text-xs border rounded px-2 bg-background"><option value="">-</option>{milestones.filter((m) => m.project_id === task.project_id).map((m) => <option key={m.id} value={m.id}>{m.milestone_no}</option>)}</select></div>
                <div><label className="text-[9px] text-muted-foreground">Plan Mins</label><Input type="number" value={editingFields.planned_mins} onChange={(e) => setEditingFields({...editingFields, planned_mins: e.target.value})} className="h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Start Date</label><Input type="date" value={editingFields.planned_start_date} onChange={(e) => setEditingFields({...editingFields, planned_start_date: e.target.value})} className="h-8 text-xs" /></div>
                <div><label className="text-[9px] text-muted-foreground">Due Date</label><Input type="date" value={editingFields.planned_end_date} onChange={(e) => setEditingFields({...editingFields, planned_end_date: e.target.value})} className="h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Act. Start</label><span className="block text-xs text-muted-foreground px-2 py-1">{formatDate(task.actual_start_date)}</span></div>
                <div><label className="text-[9px] text-muted-foreground">Act. End</label><span className="block text-xs text-muted-foreground px-2 py-1">{formatDate(task.actual_end_date)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Act. Mins</label><Input type="number" value={editingFields.actual_mins} onChange={(e) => setEditingFields({...editingFields, actual_mins: e.target.value})} className="h-8 text-xs" /></div>
                <div><label className="text-[9px] text-muted-foreground">Project</label><span className="block text-xs text-muted-foreground px-2 py-1">{projects.find((p) => p.id === task.project_id)?.name}</span></div>
              </div>
              <div><label className="text-[9px] text-muted-foreground">Remarks</label><textarea value={editingFields.description || ''} onChange={(e) => setEditingFields({...editingFields, description: e.target.value})} className="w-full min-h-[40px] text-xs border rounded px-2 py-1 bg-background resize-none" placeholder="Notes..." /></div>

              <Button className="w-full h-9 text-xs font-medium" onClick={() => saveAll(task.id)}><Save className="h-3.5 w-3.5 mr-1" /> Save Changes</Button>
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
      <div className="p-3 border-b bg-card space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="h-8 pl-7 text-xs" />
          </div>
          <Button variant={showFilters ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => { setShowFilters(!showFilters); setShowSort(false); }}>
            <Filter className="h-3.5 w-3.5" />
          </Button>
          <Button variant={showSort ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => { setShowSort(!showSort); setShowFilters(false); }}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Nested filter builder (same as web) */}
        {showFilters && (
          <NestedFilterBuilder
            fields={[
              { key: 'status_id', label: 'Status', type: 'select' as const, options: statuses.map((s) => ({ value: s.id, label: s.name, color: s.color })) },
              { key: 'priority_id', label: 'Priority', type: 'select' as const, options: priorities.map((p) => ({ value: p.id, label: p.name, color: p.color })) },
              { key: 'assignee_id', label: 'Assignee', type: 'select' as const, options: members.map((m) => ({ value: m.id, label: m.name })) },
              { key: 'project_id', label: 'Project', type: 'select' as const, options: projects.map((p) => ({ value: p.id, label: p.name })) },
              { key: 'overdue_days', label: 'Overdue Days', type: 'number' as const },
              { key: 'due_date', label: 'Due Date', type: 'date' as const },
            ]}
            conditions={filterConditions}
            onChange={setFilterConditions}
          />
        )}

        {/* Sort */}
        {showSort && (
          <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
            <span className="text-[10px] font-semibold">Sort by:</span>
            <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="h-7 text-[10px] border rounded px-1.5 bg-background flex-1">
              <option value="planned_end_date">Due Date</option>
              <option value="created_at">Created</option>
              <option value="title">Title</option>
              <option value="planned_start_date">Start Date</option>
            </select>
            <Button variant="outline" size="sm" className="h-7 text-[10px] w-14" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
              {sortDir === 'asc' ? <><ArrowUp className="h-3 w-3 mr-0.5" />Asc</> : <><ArrowDown className="h-3 w-3 mr-0.5" />Desc</>}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{topTasks.length} tasks</span>
          <Button variant="outline" size="sm" className="h-6 text-[9px]" onClick={() => { if (allExpanded) { setExpandedTask(null); setExpandedSub(null); setAllExpanded(false); } else { setAllExpanded(true); } }}>
            {allExpanded ? <><ChevronsUp className="h-3 w-3 mr-0.5" />Collapse</> : <><ChevronsDown className="h-3 w-3 mr-0.5" />Expand All</>}
          </Button>
        </div>
      </div>

      {/* Task Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-24">
        {topTasks.map((task) => renderEditableCard(task, false))}
        {topTasks.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No tasks found</p>}
      </div>

      {/* Floating Add */}
      <button onClick={() => { setCreateParent(null); setNf({ project_id: filterProjectId || '', department_id: filterDepartmentId || '' }); setShowCreate(true); }} className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-50 md:hidden">
        <Plus className="h-6 w-6" />
      </button>

      {/* Create Bottom Sheet */}
      {showCreate && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowCreate(false); setCreateParent(null); }} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-bold text-sm">{createParent ? 'New Subtask' : 'New Task'}</h3><button onClick={() => { setShowCreate(false); setCreateParent(null); }}><X className="h-5 w-5" /></button></div>
              <Input value={nf.title || ''} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="Title *" className="h-10" autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.project_id || ''} onChange={(e) => setNf({ ...nf, project_id: e.target.value, department_id: '' })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Project *</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <select value={nf.department_id || ''} onChange={(e) => setNf({ ...nf, department_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Dept *</option>{deptOpts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.status_id || ''} onChange={(e) => setNf({ ...nf, status_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Status</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={nf.priority_id || ''} onChange={(e) => setNf({ ...nf, priority_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Priority</option>{priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.assignee_id || ''} onChange={(e) => setNf({ ...nf, assignee_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Assignee</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <select value={nf.task_type_id || ''} onChange={(e) => setNf({ ...nf, task_type_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Type</option>{taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={nf.section_id || ''} onChange={(e) => setNf({ ...nf, section_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Section</option>{taskSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={nf.milestone_id || ''} onChange={(e) => setNf({ ...nf, milestone_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background"><option value="">Milestone</option>{milestones.filter((m) => !nf.project_id || m.project_id === nf.project_id).map((m) => <option key={m.id} value={m.id}>{m.milestone_no}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Start</label><Input type="date" value={nf.planned_start_date || ''} onChange={(e) => setNf({ ...nf, planned_start_date: e.target.value })} className="h-9 text-xs" /></div>
                <div><label className="text-[9px] text-muted-foreground">Due</label><Input type="date" value={nf.planned_end_date || ''} onChange={(e) => setNf({ ...nf, planned_end_date: e.target.value })} className="h-9 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-muted-foreground">Plan Mins</label><Input type="number" value={nf.planned_mins || ''} onChange={(e) => setNf({ ...nf, planned_mins: e.target.value })} className="h-9 text-xs" /></div>
                <div><label className="text-[9px] text-muted-foreground">Act. Mins</label><Input type="number" value={nf.actual_mins || ''} onChange={(e) => setNf({ ...nf, actual_mins: e.target.value })} className="h-9 text-xs" /></div>
              </div>
              <div><label className="text-[9px] text-muted-foreground">Remarks</label><Input value={nf.description || ''} onChange={(e) => setNf({ ...nf, description: e.target.value })} className="h-9 text-xs" placeholder="Notes..." /></div>
              <Button className="w-full h-10 font-medium" onClick={handleCreate} disabled={!nf.title?.trim() || !nf.project_id || !nf.department_id}>{createParent ? 'Create Subtask' : 'Create Task'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
