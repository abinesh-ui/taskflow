import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { toast } = useToast();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [poaMins, setPoaMins] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newDept, setNewDept] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*').order('planned_end_date', { ascending: true, nullsFirst: false }); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: todayPoa } = useQuery({ queryKey: ['poa_today', user?.id], queryFn: async () => { const { data } = await supabase.from('poa_submissions').select('*').eq('user_id', user!.id).eq('submitted_date', today).maybeSingle(); return data; }, enabled: !!user });

  // Get pending tasks (not closed/done/dropped)
  const closedStatusIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
  let pendingTasks = allTasks.filter((t) => !closedStatusIds.includes(t.status_id));
  if (searchQuery) { const q = searchQuery.toLowerCase(); pendingTasks = pendingTasks.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q)); }

  const totalPlannedMins = Array.from(selectedTasks).reduce((sum, id) => sum + (poaMins[id] || 0), 0);

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
    createTask.mutate({ title: newTitle.trim(), project_id: newProject, department_id: newDept, status_id: defStatus?.id || '', position: 0, parent_id: null } as any, {
      onSuccess: () => { setNewTitle(''); setNewProject(''); setNewDept(''); setShowAddTask(false); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); toast({ title: 'Task added' }); },
    });
  }

  const deptOpts = newProject ? departments.filter((d) => d.project_id === newProject) : departments;

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

        {/* Search + Add task */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search pending tasks..." className="h-8 pl-7 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowAddTask(!showAddTask)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
          </Button>
        </div>

        {/* Quick add task */}
        {showAddTask && (
          <div className="flex items-center gap-2 p-2 border rounded bg-muted/30 flex-shrink-0">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" className="h-7 text-xs flex-1" />
            <select value={newProject} onChange={(e) => { setNewProject(e.target.value); setNewDept(''); }} className="h-7 text-[10px] border rounded px-1.5 bg-background"><option value="">Project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select value={newDept} onChange={(e) => setNewDept(e.target.value)} className="h-7 text-[10px] border rounded px-1.5 bg-background"><option value="">Dept</option>{deptOpts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <Button size="sm" className="h-7 text-[10px]" onClick={handleAddTask} disabled={!newTitle.trim() || !newProject || !newDept}>Add</Button>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto border rounded-lg">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-muted/80 border-b z-10">
              <tr className="font-semibold text-muted-foreground">
                <th className="py-2 px-2 w-7"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelectedTasks(new Set(pendingTasks.map((t) => t.id))); else setSelectedTasks(new Set()); }} className="h-3 w-3" /></th>
                <th className="py-2 px-2 text-left">Task #</th>
                <th className="py-2 px-2 text-left">Title</th>
                <th className="py-2 px-2 text-left">Project</th>
                <th className="py-2 px-2 text-left">Status</th>
                <th className="py-2 px-2 text-left">Due Date</th>
                <th className="py-2 px-2 text-left w-24">POA Mins</th>
              </tr>
            </thead>
            <tbody>
              {pendingTasks.map((task) => {
                const status = statuses.find((s) => s.id === task.status_id);
                const isSelected = selectedTasks.has(task.id);
                return (
                  <tr key={task.id} className={`border-b hover:bg-accent/20 ${isSelected ? 'bg-primary/5' : ''} ${task.parent_id ? 'bg-muted/10' : ''}`}>
                    <td className="py-1.5 px-2"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(task.id)} className="h-3 w-3" /></td>
                    <td className="py-1.5 px-2 font-mono text-[9px] text-muted-foreground">{task.parent_id && '↳ '}{task.task_no}</td>
                    <td className="py-1.5 px-2 text-[10px] font-medium">{task.title}</td>
                    <td className="py-1.5 px-2 text-[9px] text-muted-foreground">{projects.find((p) => p.id === task.project_id)?.name}</td>
                    <td className="py-1.5 px-2">{status && <Badge style={{ backgroundColor: status.color, color: '#fff' }} className="text-[8px]">{status.name}</Badge>}</td>
                    <td className="py-1.5 px-2 text-[9px]">{formatDate(task.planned_end_date)}</td>
                    <td className="py-1.5 px-2">
                      {isSelected && (
                        <Input type="number" value={poaMins[task.id] || ''} onChange={(e) => setPoaMins({ ...poaMins, [task.id]: Number(e.target.value) || 0 })} placeholder="mins" className="h-6 text-[10px] w-20" />
                      )}
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
