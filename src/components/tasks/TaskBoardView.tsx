import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { useUpdateTask, useSubtasks } from '@/hooks/use-tasks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { Task, MasterStatus, MasterPriority, Profile } from '@/types/database';

interface TaskBoardViewProps {
  tasks: Task[];
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  users: Profile[];
  onEdit: (task: Task) => void;
  departmentId: string;
  projectId: string;
}

function TaskCard({ task, priorities, users, onEdit, isDragging }: {
  task: Task;
  priorities: MasterPriority[];
  users: Profile[];
  onEdit: (task: Task) => void;
  isDragging?: boolean;
}) {
  const priority = priorities.find((p) => p.id === task.priority_id);
  const assignee = users.find((u) => u.id === task.assignee_id);
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.planned_end_date && task.planned_end_date < today;

  return (
    <div
      className={`p-3 rounded-md border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[10px] text-muted-foreground font-mono">{task.task_no}</span>
        {priority && (
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: priority.color }} />
        )}
      </div>
      <p className="text-sm font-medium leading-tight mb-2">{task.title}</p>
      <div className="flex items-center justify-between">
        {assignee && (
          <span className="text-[10px] text-muted-foreground">{assignee.full_name}</span>
        )}
        {task.planned_end_date && (
          <span className={`text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
            {task.planned_end_date}
          </span>
        )}
      </div>
    </div>
  );
}

function SortableTaskCard(props: { task: Task; priorities: MasterPriority[]; users: Profile[]; onEdit: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard {...props} isDragging={isDragging} />
    </div>
  );
}

function BoardColumn({ status, tasks, priorities, users, onEdit }: {
  status: MasterStatus;
  tasks: Task[];
  priorities: MasterPriority[];
  users: Profile[];
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status.id });

  return (
    <div className="flex flex-col w-72 min-w-[288px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-3 px-2">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
        <span className="font-medium text-sm">{status.name}</span>
        <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 p-2 bg-muted/30 rounded-lg min-h-[200px]"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} priorities={priorities} users={users} onEdit={onEdit} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function TaskBoardView({
  tasks,
  statuses,
  priorities,
  users,
  onEdit,
  departmentId,
  projectId,
}: TaskBoardViewProps) {
  const updateTask = useUpdateTask();
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    // Determine target status - over.id might be a status column or another task
    let targetStatusId = over.id as string;
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask) {
      targetStatusId = overTask.status_id;
    }

    // If not a valid status, check if it's a column
    const targetStatus = statuses.find((s) => s.id === targetStatusId);
    if (!targetStatus) return;

    // If same status, no change needed
    if (task.status_id === targetStatusId) return;

    // BR-1: Check if target status is closed/done and task has open subtasks
    if (targetStatus.is_closed || targetStatus.is_done) {
      const { data: subtasks } = await supabase
        .from('tasks')
        .select('id, status_id')
        .eq('parent_id', task.id);

      if (subtasks && subtasks.length > 0) {
        const closedStatusIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
        const openSubtasks = subtasks.filter((st) => !closedStatusIds.includes(st.status_id));
        if (openSubtasks.length > 0) {
          toast({
            variant: 'destructive',
            title: 'Cannot close task',
            description: `${openSubtasks.length} subtask(s) are still open. Close all subtasks first.`,
          });
          return;
        }
      }

      // BR-2: Actual Mins required
      if (!task.actual_mins) {
        toast({
          variant: 'destructive',
          title: 'Actual Mins required',
          description: 'You must enter Actual Mins before closing a task. Edit the task to add it.',
        });
        return;
      }
    }

    updateTask.mutate({ id: task.id, data: { status_id: targetStatusId } });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <BoardColumn
            key={status.id}
            status={status}
            tasks={tasks.filter((t) => t.status_id === status.id)}
            priorities={priorities}
            users={users}
            onEdit={onEdit}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} priorities={priorities} users={users} onEdit={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
