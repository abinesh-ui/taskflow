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
import { formatDate } from '@/lib/utils';
import { Plus, CheckCircle } from 'lucide-react';
import type { Task, MasterStatus, Project, Department } from '@/types/database';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export default function DailyWorkDoneDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { userProjectIds } = useAccessControl();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [actualMins, setActualMins] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newType, setNewType] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newMilestone, setNewMilestone] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newActualMins, setNewActualMins] = useState('');
  const [newRemarks, setNewRemarks] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: taskTypes = [] } = useQuery({ queryKey: ['master_task_types'], queryFn: async () => { const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: taskSections = [] } = useQuery({ queryKey: ['master_task_sections'], queryFn: async () => { const { data } = await supabase.from('master_task_sections').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*'); return (data || []) as Array<{ id: string; milestone_no: string; project_id: string; description: string }>; } });

  // Get today's POA
  const { data: todayPoa } = useQuery({ queryKey: ['poa_today', user?.id], queryFn: async () => { const { data } = await supabase.from('poa_submissions').select('*').eq('user_id', user!.id).eq('submitted_date', today).maybeSingle(); return data; }, enabled: !!user });
  const { data: poaItems = [] } = useQuery({ queryKey: ['poa_items', todayPoa?.id], queryFn: async () => { if (!todayPoa) return []; const { data } = await supabase.from('poa_items').select('*').eq('poa_id', todayPoa.id); return (data || []) as Array<{ id: string; task_id: string; planned_mins: number; actual_mins: number }>; }, enabled: !!todayPoa });

  // POA tasks for today (filtered by user's projects)
  const poaTaskIds = poaItems.map((i) => i.task_id);
  const poaTasks = userProjectIds
    ? allTasks.filter((t) => poaTaskIds.includes(t.id) && userProjectIds.includes(t.project_id))
    : allTasks.filter((t) => poaTaskIds.includes(t.id));

  const totalActual = Object.values(actualMins).reduce((s, v) => s + v, 0) + poaItems.reduce((s, i) => s + i.actual_mins, 0);
  const totalPlanned = todayPoa?.total_planned_mins || 0;

  async function handleSubmitWorkDone() {
    if (Object.keys(actualMins).length === 0 && Object.keys(remarks).length === 0) { toast({ variant: 'destructive', title: 'Nothing to submit', description: 'Enter actual minutes for at least one task' }); return; }

    // Update POA items with actual mins and remarks
    for (const [taskId, mins] of Object.entries(actualMins)) {
      const poaItem = poaItems.find((i) => i.task_id === taskId);
      if (poaItem) {
        await supabase.from('poa_items').update({ actual_mins: (poaItem.actual_mins || 0) + mins }).eq('id', poaItem.id);
      }
      // Add to task's actual_mins
      const task = allTasks.find((t) => t.id === taskId);
      const currentMins = task?.actual_mins || 0;
      await supabase.from('tasks').update({ actual_mins: currentMins + mins, poa_actual_mins: (task as any)?.poa_actual_mins ? (task as any).poa_actual_mins + mins : mins }).eq('id', taskId);
    }

    // Update remarks on tasks
    for (const [taskId, remark] of Object.entries(remarks)) {
      if (remark.trim()) {
        const task = allTasks.find((t) => t.id === taskId);
        const existing = task?.description || '';
        const updated = existing ? `${existing}\n[${formatDate(today)}] ${remark}` : `[${formatDate(today)}] ${remark}`;
        await supabase.from('tasks').update({ description: updated }).eq('id', taskId);
      }
    }

    // Update POA total actuals
    const newTotalActual = poaItems.reduce((s, i) => s + i.actual_mins, 0) + Object.values(actualMins).reduce((s, v) => s + v, 0);
    if (todayPoa) await supabase.from('poa_submissions').update({ total_actual_mins: newTotalActual }).eq('id', todayPoa.id);

    queryClient.invalidateQueries({ queryKey: ['poa_submissions'] });
    queryClient.invalidateQueries({ queryKey: ['poa_items'] });
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    toast({ title: 'Work Done submitted!', description: `${Object.keys(actualMins).length} tasks updated` });
    setActualMins({}); setRemarks({}); onOpenChange(false);
  }

  async function handleAddTask() {
    if (!newTitle.trim() || !newProject || !newDept) return;
    const defStatus = statuses.find((s) => s.position === 1) || statuses[0];
    createTask.mutate({ title: newTitle.trim(), project_id: newProject, department_id: newDept, status_id: newStatus || defStatus?.id || '', priority_id: newPriority || null, assignee_id: newAssignee || null, task_type_id: newType || null, section_id: newSection || null, milestone_id: newMilestone || null, planned_start_date: null, planned_end_date: newDueDate || null, planned_mins: 0, actual_mins: newActualMins ? Number(newActualMins) : null, description: newRemarks || null, position: 0, parent_id: addingSubTo || null, poa_planned_mins: 0 } as any, {
      onSuccess: (data: any) => {
        // Add to today's POA if exists
        if (todayPoa && data) { supabase.from('poa_items').insert({ poa_id: todayPoa.id, task_id: data.id, planned_mins: 0, actual_mins: newActualMins ? Number(newActualMins) : 0 }).then(() => queryClient.invalidateQueries({ queryKey: ['poa_items'] })); }
        setNewTitle(''); setNewProject(''); setNewDept(''); setNewStatus(''); setNewPriority(''); setNewAssignee(''); setNewType(''); setNewSection(''); setNewMilestone(''); setNewDueDate(''); setNewActualMins(''); setNewRemarks(''); setShowAddTask(false); setAddingSubTo(null);
        queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
        toast({ title: 'Unplanned task added (0 planned mins)' });
      },
    });
  }

  // Filtered options for non-admin
  const visibleProjects = userProjectIds ? projects.filter((p) => userProjectIds.includes(p.id)) : projects;
  const visibleDepartments = userProjectIds ? departments.filter((d: any) => userProjectIds.includes(d.project_id)) : departments;
  const { projectMembers: pmData } = useAccessControl();
  const visibleMembers = userProjectIds ? members.filter((m) => pmData.some((pm) => userProjectIds.includes(pm.project_id) && pm.member_id === m.id)) : members;

  if (!todayPoa) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Daily Work Done</DialogTitle></DialogHeader>
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">No POA submitted for today yet.</p>
            <p className="text-xs text-muted-foreground">Submit a Daily POA first, then come back to record work done.</p>
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
            <span>Daily Work Done — {formatDate(today)}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Planned: {totalPlanned} mins</Badge>
              <Badge className="bg-green-600 text-white text-xs">Actual: {totalActual} mins</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Add unplanned task */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground flex-1">Enter actual minutes and remarks for today's tasks.</span>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setShowAddTask(!showAddTask); setAddingSubTo(null); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Unplanned Task
          </Button>
        </div>

        {(showAddTask || addingSubTo) && (
          <div className="p-2 border rounded bg-muted/30 flex-shrink-0 space-y-2 max-h-[180px] overflow-y-auto">
            <span className="text-[10px] font-semibold">{addingSubTo ? 'Add Unplanned Subtask' : 'Add Unplanned Task'} (Plan Mins = 0)</span>
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
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-7 text-[9px]" title="Due Date" />
              <Input type="number" value={newActualMins} onChange={(e) => setNewActualMins(e.target.value)} placeholder="Actual Mins *" className="h-7 text-[9px]" />
              <Input value={newRemarks} onChange={(e) => setNewRemarks(e.target.value)} placeholder="Remarks" className="h-7 text-[9px]" />
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-[10px]" onClick={handleAddTask} disabled={!newTitle.trim() || !newProject || !newDept}>Add</Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setShowAddTask(false); setAddingSubTo(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* POA Tasks - enter actual mins */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-muted/80 border-b z-10">
              <tr className="font-semibold text-muted-foreground">
                <th className="py-2 px-2 text-left">Task #</th>
                <th className="py-2 px-2 text-left">Title</th>
                <th className="py-2 px-2 text-left">Project</th>
                <th className="py-2 px-2 text-left">Status</th>
                <th className="py-2 px-2 text-left">POA Planned</th>
                <th className="py-2 px-2 text-left w-20">Actual Mins</th>
                <th className="py-2 px-2 text-left w-32">Remarks</th>
                <th className="py-2 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {poaTasks.map((task) => {
                const status = statuses.find((s) => s.id === task.status_id);
                const poaItem = poaItems.find((i) => i.task_id === task.id);
                return (
                  <tr key={task.id} className={`border-b hover:bg-accent/20 ${task.parent_id ? 'bg-muted/10' : ''}`}>
                    <td className="py-1.5 px-2 font-mono text-[9px] text-muted-foreground">{task.parent_id && '↳ '}{task.task_no}</td>
                    <td className="py-1.5 px-2 text-[10px] font-medium">{task.title}</td>
                    <td className="py-1.5 px-2 text-[9px] text-muted-foreground">{projects.find((p) => p.id === task.project_id)?.name}</td>
                    <td className="py-1.5 px-2">{status && <Badge style={{ backgroundColor: status.color, color: '#fff' }} className="text-[8px]">{status.name}</Badge>}</td>
                    <td className="py-1.5 px-2 text-[9px]">{poaItem?.planned_mins || 0} mins</td>
                    <td className="py-1.5 px-2"><Input type="number" value={actualMins[task.id] || ''} onChange={(e) => setActualMins({ ...actualMins, [task.id]: Number(e.target.value) || 0 })} placeholder="mins" className="h-6 text-[10px] w-16" /></td>
                    <td className="py-1.5 px-2"><Input value={remarks[task.id] || ''} onChange={(e) => setRemarks({ ...remarks, [task.id]: e.target.value })} placeholder="remarks" className="h-6 text-[10px]" /></td>
                    <td className="py-1.5 px-1">{!task.parent_id && <button onClick={() => { setAddingSubTo(task.id); setNewProject(task.project_id); setNewDept(task.department_id); setShowAddTask(false); }} className="h-5 w-5 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Add subtask"><Plus className="h-3 w-3" /></button>}</td>
                  </tr>
                );
              })}
              {poaTasks.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No tasks in today's POA</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 border-t flex-shrink-0">
          <div className="text-xs text-muted-foreground">Planned: {totalPlanned} mins · Actual so far: {totalActual} mins</div>
          <Button onClick={handleSubmitWorkDone} className="font-medium">
            <CheckCircle className="h-4 w-4 mr-1" /> Submit Work Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
