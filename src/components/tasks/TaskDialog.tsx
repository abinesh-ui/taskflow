import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useMasterData, useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import CommentsSection from './CommentsSection';
import AttachmentsSection from './AttachmentsSection';
import type { Task } from '@/types/database';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  departmentId: string;
  projectId: string;
  parentId?: string | null;
}

export default function TaskDialog({ open, onOpenChange, task, departmentId, projectId, parentId }: TaskDialogProps) {
  const { taskTypes, categories, priorities, statuses, users, liveProjects, departments } = useMasterData();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type_id: '',
    category_id: '',
    priority_id: '',
    assignee_id: '',
    status_id: '',
    project_id: projectId,
    department_id: departmentId,
    planned_start_date: '',
    planned_end_date: '',
    planned_mins: '',
    actual_start_date: '',
    actual_end_date: '',
    actual_mins: '',
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        task_type_id: task.task_type_id || '',
        category_id: task.category_id || '',
        priority_id: task.priority_id || '',
        assignee_id: task.assignee_id || '',
        status_id: task.status_id || '',
        project_id: task.project_id || projectId,
        department_id: task.department_id || departmentId,
        planned_start_date: task.planned_start_date || '',
        planned_end_date: task.planned_end_date || '',
        planned_mins: task.planned_mins?.toString() || '',
        actual_start_date: task.actual_start_date || '',
        actual_end_date: task.actual_end_date || '',
        actual_mins: task.actual_mins?.toString() || '',
      });
    } else {
      const defaultStatus = statuses.find((s) => s.position === 1) || statuses[0];
      setFormData({
        title: '',
        description: '',
        task_type_id: '',
        category_id: '',
        priority_id: '',
        assignee_id: '',
        status_id: defaultStatus?.id || '',
        project_id: projectId,
        department_id: departmentId,
        planned_start_date: '',
        planned_end_date: '',
        planned_mins: '',
        actual_start_date: '',
        actual_end_date: '',
        actual_mins: '',
      });
    }
  }, [task, statuses, projectId, departmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Title is required' });
      return;
    }
    if (!formData.status_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Status is required' });
      return;
    }

    // BR-3: Date validation
    if (formData.planned_start_date && formData.planned_end_date && formData.planned_end_date < formData.planned_start_date) {
      toast({ variant: 'destructive', title: 'Error', description: 'Planned End Date cannot be before Start Date' });
      return;
    }
    if (formData.actual_start_date && formData.actual_end_date && formData.actual_end_date < formData.actual_start_date) {
      toast({ variant: 'destructive', title: 'Error', description: 'Actual End Date cannot be before Start Date' });
      return;
    }

    // Check if status is changing to closed/done
    const targetStatus = statuses.find((s) => s.id === formData.status_id);
    const isClosing = targetStatus?.is_closed || targetStatus?.is_done;
    const statusChanged = task && task.status_id !== formData.status_id;

    if (isClosing && task && statusChanged) {
      // BR-2: Actual Mins required when closing
      if (!formData.actual_mins) {
        toast({ variant: 'destructive', title: 'Actual Mins required', description: 'You must enter Actual Mins before closing/completing a task.' });
        return;
      }

      // BR-1: Check open subtasks (async check already done before form renders, but we double check)
      // We'll do the async subtask check in the mutation itself
    }

    // BR-2: Also enforce for new tasks being created directly in closed status
    if (isClosing && !task && !formData.actual_mins) {
      toast({ variant: 'destructive', title: 'Actual Mins required', description: 'You must enter Actual Mins when setting a closed/done status.' });
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description || null,
      task_type_id: formData.task_type_id || null,
      category_id: formData.category_id || null,
      priority_id: formData.priority_id || null,
      assignee_id: formData.assignee_id || null,
      status_id: formData.status_id,
      project_id: formData.project_id,
      department_id: formData.department_id,
      planned_start_date: formData.planned_start_date || null,
      planned_end_date: formData.planned_end_date || null,
      planned_mins: formData.planned_mins ? Number(formData.planned_mins) : null,
      actual_start_date: formData.actual_start_date || null,
      actual_end_date: formData.actual_end_date || null,
      actual_mins: formData.actual_mins ? Number(formData.actual_mins) : null,
      parent_id: parentId || null,
      position: 0,
    };

    if (task) {
      // BR-1: If closing, check subtasks
      const targetStatus2 = statuses.find((s) => s.id === formData.status_id);
      if ((targetStatus2?.is_closed || targetStatus2?.is_done) && task.status_id !== formData.status_id) {
        const { data: subtasks } = await supabase
          .from('tasks')
          .select('id, status_id')
          .eq('parent_id', task.id);
        if (subtasks && subtasks.length > 0) {
          const closedStatusIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
          const openSubs = subtasks.filter((st: any) => !closedStatusIds.includes(st.status_id));
          if (openSubs.length > 0) {
            toast({ variant: 'destructive', title: 'Cannot close task', description: `${openSubs.length} subtask(s) are still open. Close all subtasks first.` });
            return;
          }
        }
      }
      updateTask.mutate({ id: task.id, data: payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createTask.mutate(payload as any, { onSuccess: () => onOpenChange(false) });
    }
  }

  const deptOptions = departments.filter((d) => d.project_id === formData.project_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? `Edit Task ${task.task_no}` : parentId ? 'Add Subtask' : 'Add Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={formData.project_id}
                onValueChange={(val) => setFormData({ ...formData, project_id: val, department_id: '' })}
              >
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {liveProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.department_id}
                onValueChange={(val) => setFormData({ ...formData, department_id: val })}
              >
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {deptOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={formData.task_type_id} onValueChange={(val) => setFormData({ ...formData, task_type_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {taskTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category_id} onValueChange={(val) => setFormData({ ...formData, category_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority_id} onValueChange={(val) => setFormData({ ...formData, priority_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Select value={formData.assignee_id} onValueChange={(val) => setFormData({ ...formData, assignee_id: val })}>
                <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: u.color || '#6b7280' }} />
                        {u.name || u.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status *</Label>
            <Select value={formData.status_id} onValueChange={(val) => setFormData({ ...formData, status_id: val })}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Planned Start Date</Label>
              <Input
                type="date"
                value={formData.planned_start_date}
                onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Planned End Date</Label>
              <Input
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Planned Mins</Label>
            <Input
              type="number"
              value={formData.planned_mins}
              onChange={(e) => setFormData({ ...formData, planned_mins: e.target.value })}
              placeholder="Planned effort (minutes)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Actual Start Date</Label>
              <Input
                type="date"
                value={formData.actual_start_date}
                onChange={(e) => setFormData({ ...formData, actual_start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Actual End Date</Label>
              <Input
                type="date"
                value={formData.actual_end_date}
                onChange={(e) => setFormData({ ...formData, actual_end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Actual Mins</Label>
            <Input
              type="number"
              value={formData.actual_mins}
              onChange={(e) => setFormData({ ...formData, actual_mins: e.target.value })}
              placeholder="Actual effort (minutes)"
            />
          </div>

          {/* Comments and Attachments (only shown for existing tasks) */}
          {task && (
            <>
              <CommentsSection taskId={task.id} />
              <AttachmentsSection taskId={task.id} />
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
              {task ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
