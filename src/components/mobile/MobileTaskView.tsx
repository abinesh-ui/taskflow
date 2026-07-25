import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCreateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { formatDate, getOverdueDays } from '@/lib/utils';
import { Plus, ChevronDown, ChevronRight, Filter, SlidersHorizontal, X, Search } from 'lucide-react';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

export default function MobileTaskView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createParent, setCreateParent] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [nf, setNf] = useState<Record<string, string>>({});

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*').order('planned_end_date', { ascending: true, nullsFirst: false }); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as MasterPriority[]; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['master_task_types'], queryFn: async () => { const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: taskSections = [] } = useQuery({ queryKey: ['master_task_sections'], queryFn: async () => { const { data } = await supabase.from('master_task_sections').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*').order('created_at'); return (data || []) as Array<{ id: string; milestone_no: string; project_id: string }>; } });

  // Filter tasks
  let topTasks = allTasks.filter((t) => !t.parent_id);
  if (searchQuery) { const q = searchQuery.toLowerCase(); topTasks = topTasks.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q)); }
  if (filterStatus !== 'all') topTasks = topTasks.filter((t) => t.status_id === filterStatus);

  function getSubtasks(id: string) { return allTasks.filter((t) => t.parent_id === id); }
  function getStatus(id: string) { return statuses.find((s) => s.id === id); }
  function getPriority(id: string | null) { return id ? priorities.find((p) => p.id === id) : null; }
  function getMember(id: string | null) { return id ? members.find((m) => m.id === id) : null; }
  function getOverdue(t: Task) { const s = getStatus(t.status_id); return getOverdueDays(t.planned_end_date, s?.is_closed ?? false); }

  async function handleCreate() {
    if (!nf.title?.trim() || !nf.project_id || !nf.department_id) { toast({ variant: 'destructive', title: 'Error', description: 'Title, Project and Department required' }); return; }
    const defStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({
      title: nf.title.trim(), project_id: nf.project_id, department_id: nf.department_id,
      status_id: nf.status_id || defStatus?.id || '', priority_id: nf.priority_id || null,
      assignee_id: nf.assignee_id || null, task_type_id: nf.task_type_id || null,
      section_id: nf.section_id || null, milestone_id: nf.milestone_id || null,
      planned_start_date: nf.planned_start_date || null, planned_end_date: nf.planned_end_date || null,
      planned_mins: nf.planned_mins ? Number(nf.planned_mins) : null, actual_mins: nf.actual_mins ? Number(nf.actual_mins) : null,
      description: nf.description || null, parent_id: createParent?.id || null, position: 0,
      category_id: createParent?.category_id || null,
    } as any, {
      onSuccess: () => { setNf({}); setShowCreate(false); setCreateParent(null); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); },
    });
  }

  async function quickStatusChange(taskId: string, statusId: string) {
    await supabase.from('tasks').update({ status_id: statusId }).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  }

  const deptOpts = nf.project_id ? departments.filter((d) => d.project_id === nf.project_id) : departments;

  return (
    <div className="md:hidden flex flex-col h-full">
      {/* Search + Filter bar */}
      <div className="p-3 border-b bg-card space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tasks..." className="h-8 pl-7 text-xs" />
          </div>
          <Button variant={showFilters ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </div>
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-7 text-[10px] border rounded px-2 bg-background flex-shrink-0">
              <option value="all">All Status</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{topTasks.length} tasks</span>
        </div>
      </div>

      {/* Task Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-20">
        {topTasks.map((task) => {
          const status = getStatus(task.status_id);
          const priority = getPriority(task.priority_id);
          const assignee = getMember(task.assignee_id);
          const overdue = getOverdue(task);
          const subtasks = getSubtasks(task.id);
          const isExpanded = expandedTask === task.id;

          return (
            <div key={task.id} className={`border rounded-xl overflow-hidden ${overdue > 0 ? 'border-red-200 bg-red-50/30' : 'bg-card'}`}>
              {/* Card header */}
              <div className="p-3 space-y-1.5" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{task.title}</p>
                    <span className="text-[10px] font-mono text-muted-foreground">{task.task_no}</span>
                  </div>
                  {priority && <span className="h-3 w-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: priority.color }} />}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge style={{ backgroundColor: status?.color, color: '#fff' }} className="text-[9px] h-4">{status?.name}</Badge>
                  {assignee && <span className="text-[10px] text-muted-foreground">{assignee.name}</span>}
                  {task.planned_end_date && <span className={`text-[10px] ${overdue > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>{formatDate(task.planned_end_date)}</span>}
                  {overdue > 0 && <Badge variant="destructive" className="text-[8px] h-4">{overdue}d overdue</Badge>}
                  {subtasks.length > 0 && <span className="text-[10px] text-primary font-medium">{subtasks.length} sub</span>}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t px-3 pb-3 pt-2 space-y-2 bg-muted/20">
                  {/* Quick status change */}
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {statuses.map((s) => (
                      <button key={s.id} onClick={() => quickStatusChange(task.id, s.id)} className={`px-2 py-1 rounded text-[9px] font-medium flex-shrink-0 border ${task.status_id === s.id ? 'ring-2 ring-primary' : ''}`} style={{ backgroundColor: task.status_id === s.id ? s.color + '20' : 'transparent', borderColor: s.color, color: s.color }}>
                        {s.name}
                      </button>
                    ))}
                  </div>

                  {/* Task details */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{projects.find((p) => p.id === task.project_id)?.name}</span></div>
                    <div><span className="text-muted-foreground">Dept:</span> <span className="font-medium">{departments.find((d) => d.id === task.department_id)?.name}</span></div>
                    <div><span className="text-muted-foreground">Start:</span> <span>{formatDate(task.planned_start_date)}</span></div>
                    <div><span className="text-muted-foreground">Due:</span> <span className={overdue > 0 ? 'text-red-600 font-bold' : ''}>{formatDate(task.planned_end_date)}</span></div>
                    <div><span className="text-muted-foreground">Act Start:</span> <span>{formatDate(task.actual_start_date)}</span></div>
                    <div><span className="text-muted-foreground">Act End:</span> <span>{formatDate(task.actual_end_date)}</span></div>
                    {task.description && <div className="col-span-2"><span className="text-muted-foreground">Remarks:</span> <span>{task.description}</span></div>}
                  </div>

                  {/* Add subtask button */}
                  <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => { setCreateParent(task); setNf({ project_id: task.project_id, department_id: task.department_id }); setShowCreate(true); }}>
                    <Plus className="h-3 w-3 mr-1" /> Add Subtask
                  </Button>

                  {/* Subtasks */}
                  {subtasks.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">Subtasks ({subtasks.length})</span>
                      {subtasks.map((sub) => {
                        const subStatus = getStatus(sub.status_id);
                        const subOverdue = getOverdue(sub);
                        return (
                          <div key={sub.id} className="flex items-center gap-2 p-2 border rounded-lg bg-card">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium truncate">{sub.title}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge style={{ backgroundColor: subStatus?.color, color: '#fff' }} className="text-[8px] h-3.5">{subStatus?.name}</Badge>
                                {sub.planned_end_date && <span className={`text-[9px] ${subOverdue > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{formatDate(sub.planned_end_date)}</span>}
                              </div>
                            </div>
                            {/* Quick status for subtask */}
                            <select value={sub.status_id} onChange={(e) => quickStatusChange(sub.id, e.target.value)} className="h-6 text-[9px] border rounded px-1 bg-background w-20">
                              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {topTasks.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No tasks found</p>}
      </div>

      {/* Floating Add Button */}
      <button onClick={() => { setCreateParent(null); setNf({}); setShowCreate(true); }} className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-50 md:hidden">
        <Plus className="h-6 w-6" />
      </button>

      {/* Create/Edit Bottom Sheet */}
      {showCreate && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowCreate(false); setCreateParent(null); }} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-xl animate-in slide-in-from-bottom">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">{createParent ? 'New Subtask' : 'New Task'}</h3>
                <button onClick={() => { setShowCreate(false); setCreateParent(null); }}><X className="h-5 w-5" /></button>
              </div>

              <Input value={nf.title || ''} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="Task title *" className="h-10" autoFocus />

              <div className="grid grid-cols-2 gap-2">
                <select value={nf.project_id || ''} onChange={(e) => setNf({ ...nf, project_id: e.target.value, department_id: '' })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Project *</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={nf.department_id || ''} onChange={(e) => setNf({ ...nf, department_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Department *</option>
                  {deptOpts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select value={nf.status_id || ''} onChange={(e) => setNf({ ...nf, status_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Status</option>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={nf.priority_id || ''} onChange={(e) => setNf({ ...nf, priority_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Priority</option>
                  {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select value={nf.assignee_id || ''} onChange={(e) => setNf({ ...nf, assignee_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Assignee</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={nf.task_type_id || ''} onChange={(e) => setNf({ ...nf, task_type_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Type</option>
                  {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select value={nf.section_id || ''} onChange={(e) => setNf({ ...nf, section_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Section</option>
                  {taskSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={nf.milestone_id || ''} onChange={(e) => setNf({ ...nf, milestone_id: e.target.value })} className="h-9 text-xs border rounded px-2 bg-background w-full">
                  <option value="">Milestone</option>
                  {milestones.filter((m) => !nf.project_id || m.project_id === nf.project_id).map((m) => <option key={m.id} value={m.id}>{m.milestone_no}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted-foreground">Start Date</label><Input type="date" value={nf.planned_start_date || ''} onChange={(e) => setNf({ ...nf, planned_start_date: e.target.value })} className="h-9 text-xs" /></div>
                <div><label className="text-[10px] text-muted-foreground">Due Date</label><Input type="date" value={nf.planned_end_date || ''} onChange={(e) => setNf({ ...nf, planned_end_date: e.target.value })} className="h-9 text-xs" /></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted-foreground">Planned Mins</label><Input type="number" value={nf.planned_mins || ''} onChange={(e) => setNf({ ...nf, planned_mins: e.target.value })} className="h-9 text-xs" placeholder="mins" /></div>
                <div><label className="text-[10px] text-muted-foreground">Actual Mins</label><Input type="number" value={nf.actual_mins || ''} onChange={(e) => setNf({ ...nf, actual_mins: e.target.value })} className="h-9 text-xs" placeholder="mins" /></div>
              </div>

              <div><label className="text-[10px] text-muted-foreground">Remarks</label><Input value={nf.description || ''} onChange={(e) => setNf({ ...nf, description: e.target.value })} className="h-9 text-xs" placeholder="Notes..." /></div>

              <Button className="w-full h-10 font-medium" onClick={handleCreate} disabled={!nf.title?.trim() || !nf.project_id || !nf.department_id}>
                {createParent ? 'Create Subtask' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
