import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/use-access-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { formatDate, getOverdueDays } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';
import type { Task, MasterStatus, Project, Department } from '@/types/database';

interface DailyPOADialogProps { open: boolean; onOpenChange: (open: boolean) => void; }

export default function DailyPOADialog({ open, onOpenChange }: DailyPOADialogProps) {
  const { user } = useAuth();
  const { userProjectIds, memberId, projectMembers: pmData } = useAccessControl();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [poaMins, setPoaMins] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newAssigner, setNewAssigner] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newType, setNewType] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newMilestone, setNewMilestone] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newPlannedMins, setNewPlannedMins] = useState('');
  const [newRemarks, setNewRemarks] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*').order('planned_end_date', { ascending: true, nullsFirst: false }); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['master_task_types'], queryFn: async () => { const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: taskSections = [] } = useQuery({ queryKey: ['master_task_sections'], queryFn: async () => { const { data } = await supabase.from('master_task_sections').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*').order('created_at'); return (data || []) as Array<{ id: string; milestone_no: string; project_id: string; description: string }>; } });
  const { data: todayPoa } = useQuery({ queryKey: ['poa_today', user?.id], queryFn: async () => { const { data } = await supabase.from('poa_submissions').select('*').eq('user_id', user!.id).eq('submitted_date', today).maybeSingle(); return data; }, enabled: !!user });

  // Get pending tasks (not closed/done/dropped) - filtered by user's projects
  const closedStatusIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
  let pendingTasks = allTasks.filter((t) => !closedStatusIds.includes(t.status_id));
  if (userProjectIds) pendingTasks = pendingTasks.filter((t) => userProjectIds.includes(t.project_id));
  if (searchQuery) { const q = searchQuery.toLowerCase(); pendingTasks = pendingTasks.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q)); }

  const totalPlannedMins = Array.from(selectedTasks).reduce((sum, id) => sum + (poaMins[id] || 0), 0);

  // Filtered options for non-admin
  const visibleProjects = userProjectIds ? projects.filter((p) => userProjectIds.includes(p.id)) : projects;
  const visibleDepartments = userProjectIds ? departments.filter((d: any) => userProjectIds.includes(d.project_id)) : departments;
  const visibleMembers = userProjectIds ? members.filter((m) => pmData.some((pm) => userProjectIds.includes(pm.project_id) && pm.member_id === m.id)) : members;

  function toggleSelect(id: string) { const n = new Set(selectedTasks); if (n.has(id)) n.delete(id); else n.add(id); setSelectedTasks(n); }

  async function handleSubmitPOA() {
    if (selectedTasks.size === 0) { toast({ variant: 'destructive', title: 'Error', description: 'Select at least one task' }); return; }
    if (todayPoa) { toast({ variant: 'destructive', title: 'Already submitted', description: "Today's POA has already been submitted" }); return; }

    // Create POA submission
    const { data: poa, error: poaErr } = await supabase.from('poa_submissions').insert({ user_id: user!.id, submitted_date: today, total_planned_mins: totalPlannedMins }).select().single();
    if (poaErr) { toast({ variant: 'destructive', title: 'Error', description: poaErr.message }); return; }

    // Create POA items
    const items = Array.from(selectedTasks).map((taskId) => ({ poa_id: poa.id, task_id: taskId, planned_mins: poaMins[taskId] || 0 }));
    const { error: itemsErr } = await supabase.from('poa_items').insert(items);
    if (itemsErr) { toast({ variant: 'destructive', title: 'Error', description: itemsErr.message }); return; }

    // Update poa_planned_mins on tasks
    for (const taskId of selectedTasks) {
      await supabase.from('tasks').update({ poa_planned_mins: poaMins[taskId] || 0 }).eq('id', taskId);
    }

    queryClient.invalidateQueries({ queryKey: ['poa_submissions'] });
    queryClient.invalidateQueries({ queryKey: ['poa_items'] });
    queryClient.invalidateQueries({ queryKey: ['poa_today'] });
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    toast({ title: "POA submitted!", description: `${selectedTasks.size} tasks planned for today (${totalPlannedMins} mins)` });
    setSelectedTasks(new Set()); setPoaMins({}); onOpenChange(false);
  }

  async function handleAddTask() {
    if (!newTitle.trim() || !newProject || !newDept) return;
    const defStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({ title: newTitle.trim(), project_id: newProject, department_id: newDept, status_id: newStatus || defStatus?.id || '', priority_id: newPriority || null, assignee_id: newAssignee || null, assigner_id: memberId || null, task_type_id: newType || null, section_id: newSection || null, milestone_id: newMilestone || null, planned_start_date: newStartDate || null, planned_end_date: newDueDate || null, planned_mins: newPlannedMins ? Number(newPlannedMins) : null, description: newRemarks || null, position: 0, parent_id: addingSubTo || null } as any, {
      onSuccess: () => { setNewTitle(''); setNewProject(''); setNewDept(''); setNewStatus(''); setNewPriority(''); setNewAssignee(''); setNewAssigner(''); setNewDueDate(''); setNewType(''); setNewSection(''); setNewMilestone(''); setNewStartDate(''); setNewPlannedMins(''); setNewRemarks(''); setShowAddTask(false); setAddingSubTo(null); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); toast({ title: addingSubTo ? 'Subtask added' : 'Task added' }); },
    });
  }

  if (todayPoa) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Daily POA</DialogTitle></DialogHeader>
          <div className="text-center py-8 space-y-2">
            <Badge className="bg-green-600 text-white">Already Submitted</Badge>
            <p className="text-sm text-muted-foreground">Today's POA ({formatDate(today)}) has already been submitted.</p>
            <p className="text-xs text-muted-foreground">Total: {todayPoa.total_planned_mins} mins planned</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Daily POA — {formatDate(today)}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{selectedTasks.size} selected</Badge>
              <Badge className="bg-primary text-white text-xs">{totalPlannedMins} mins total</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Search + Add task/subtask */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search pending tasks..." className="h-8 pl-7 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setShowAddTask(!showAddTask); setAddingSubTo(null); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Task
          </Button>
        </div>

        {/* Add task with ALL fields */}
        {(showAddTask || addingSubTo) && (
          <div className="p-2 border rounded bg-muted/30 flex-shrink-0 space-y-2 max-h-[200px] overflow-y-auto">
            <span className="text-[10px] font-semibold">{addingSubTo ? 'Add Subtask' : 'Add Task'} — All Fields</span>
            <div className="grid grid-cols-4 gap-1.5">
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title *" className="h-7 text-[10px] col-span-2" autoFocus />
              <select value={newProject} onChange={(e) => { setNewProject(e.target.value); setNewDept(''); }} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Project *</option>{visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select value={newDept} onChange={(e) => setNewDept(e.target.value)} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Dept *</option>{visibleDepartments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Status</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Priority</option>{priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Assignee</option>{visibleMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Type</option>{taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <select value={newSection} onChange={(e) => setNewSection(e.target.value)} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Section</option>{taskSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} className="h-7 text-[9px] border rounded px-1 bg-background"><option value="">Milestone</option>{(newProject ? milestones.filter((m) => m.project_id === newProject) : []).map((m) => <option key={m.id} value={m.id}>{m.description}</option>)}</select>
              <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} placeholder="Start" className="h-7 text-[9px]" title="Start Date" />
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-7 text-[9px]" title="Due Date" />
              <Input type="number" value={newPlannedMins} onChange={(e) => setNewPlannedMins(e.target.value)} placeholder="Plan Mins" className="h-7 text-[9px]" />
              <Input value={newRemarks} onChange={(e) => setNewRemarks(e.target.value)} placeholder="Remarks" className="h-7 text-[9px] col-span-2" />
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-[10px]" onClick={handleAddTask} disabled={!newTitle.trim() || !newProject || !newDept}>{addingSubTo ? 'Add Subtask' : 'Add Task'}</Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setShowAddTask(false); setAddingSubTo(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-muted/80 border-b z-10">
              <tr className="font-semibold text-muted-foreground">
                <th className="py-2 px-2 w-7"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelectedTasks(new Set(pendingTasks.map((t) => t.id))); else setSelectedTasks(new Set()); }} className="h-3 w-3" /></th>
                <th className="py-2 px-2 text-left">Project</th>
                <th className="py-2 px-2 text-left">Task #</th>
                <th className="py-2 px-2 text-left">Title</th>
                <th className="py-2 px-2 text-left">Status</th>
                <th className="py-2 px-2 text-left">Due Date</th>
                <th className="py-2 px-2 text-left w-24">POA Mins</th>
                <th className="py-2 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pendingTasks.map((task) => {
                const status = statuses.find((s) => s.id === task.status_id);
                const isSelected = selectedTasks.has(task.id);
                return (
                  <tr key={task.id} className={`border-b hover:bg-accent/20 ${isSelected ? 'bg-primary/5' : ''} ${task.parent_id ? 'bg-muted/10' : ''}`}>
                    <td className="py-1.5 px-2"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(task.id)} className="h-3 w-3" /></td>
                    <td className="py-1.5 px-2 text-[9px] text-muted-foreground">{projects.find((p) => p.id === task.project_id)?.name}</td>
                    <td className="py-1.5 px-2 font-mono text-[9px] text-muted-foreground">{task.parent_id && '↳ '}{task.task_no}</td>
                    <td className="py-1.5 px-2 text-[10px] font-medium">{task.title}</td>
                    <td className="py-1.5 px-2">{status && <Badge style={{ backgroundColor: status.color, color: '#fff' }} className="text-[8px]">{status.name}</Badge>}</td>
                    <td className="py-1.5 px-2 text-[9px]">{formatDate(task.planned_end_date)}</td>
                    <td className="py-1.5 px-2">
                      {isSelected && (
                        <Input type="number" value={poaMins[task.id] || ''} onChange={(e) => setPoaMins({ ...poaMins, [task.id]: Number(e.target.value) || 0 })} placeholder="mins" className="h-6 text-[10px] w-20" />
                      )}
                    </td>
                    <td className="py-1.5 px-1">
                      {!task.parent_id && <button onClick={() => { setAddingSubTo(task.id); setNewProject(task.project_id); setNewDept(task.department_id); setShowAddTask(false); }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Add subtask"><Plus className="h-3 w-3" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Submit bar */}
        <div className="flex items-center justify-between pt-2 border-t flex-shrink-0">
          <div className="text-xs text-muted-foreground">{selectedTasks.size} tasks · {totalPlannedMins} mins planned for today</div>
          <Button onClick={handleSubmitPOA} disabled={selectedTasks.size === 0} className="font-medium">
            Submit Daily POA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
