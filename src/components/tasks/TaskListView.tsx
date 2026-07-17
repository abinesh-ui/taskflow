import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown, Plus, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPlannedMonthWeek, getOverdueDays } from '@/lib/utils';
import { useSubtasks } from '@/hooks/use-tasks';
import TaskDialog from './TaskDialog';
import type { Task, MasterStatus, MasterPriority, Profile } from '@/types/database';

interface TaskListViewProps {
  tasks: Task[];
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  users: Profile[];
  onEdit: (task: Task) => void;
  onViewTimeline?: (task: Task) => void;
  onSort: (field: string) => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
  departmentId: string;
  projectId: string;
}

function SubtaskRow({ task, statuses, priorities, users, onEdit }: {
  task: Task;
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  users: Profile[];
  onEdit: (task: Task) => void;
}) {
  const status = statuses.find((s) => s.id === task.status_id);
  const priority = priorities.find((p) => p.id === task.priority_id);
  const assignee = users.find((u) => u.id === task.assignee_id);
  const overdue = getOverdueDays(task.planned_end_date, status?.is_closed ?? false);

  return (
    <tr
      className="border-b hover:bg-muted/30 cursor-pointer text-xs"
      onClick={() => onEdit(task)}
    >
      <td className="py-2 px-3 pl-12 font-mono text-muted-foreground">{task.task_no}</td>
      <td className="py-2 px-3">{task.title}</td>
      <td className="py-2 px-3">
        {status && (
          <Badge className="text-[10px]" style={{ backgroundColor: status.color, color: '#fff' }}>
            {status.name}
          </Badge>
        )}
      </td>
      <td className="py-2 px-3">
        {priority && (
          <span className="flex items-center gap-1 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color }} />
            {priority.name}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-xs">{assignee?.full_name || '-'}</td>
      <td className="py-2 px-3 text-xs">{task.planned_end_date || '-'}</td>
      <td className={`py-2 px-3 text-xs ${overdue > 0 ? 'text-red-600 font-semibold' : ''}`}>
        {overdue > 0 ? `${overdue}d` : '-'}
      </td>
    </tr>
  );
}

function TaskRow({ task, statuses, priorities, users, onEdit, onViewTimeline, departmentId, projectId }: {
  task: Task;
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  users: Profile[];
  onEdit: (task: Task) => void;
  onViewTimeline?: (task: Task) => void;
  departmentId: string;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const { data: subtasks = [] } = useSubtasks(expanded ? task.id : undefined);

  const status = statuses.find((s) => s.id === task.status_id);
  const priority = priorities.find((p) => p.id === task.priority_id);
  const assignee = users.find((u) => u.id === task.assignee_id);
  const overdue = getOverdueDays(task.planned_end_date, status?.is_closed ?? false);
  const monthWeek = getPlannedMonthWeek(task.planned_start_date);

  return (
    <>
      <tr className="border-b hover:bg-muted/30 cursor-pointer text-sm">
        <td className="py-2 px-3">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 hover:bg-accent rounded"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <span className="font-mono text-xs text-muted-foreground">{task.task_no}</span>
          </div>
        </td>
        <td className="py-2 px-3" onClick={() => onEdit(task)}>
          <span className="font-medium">{task.title}</span>
        </td>
        <td className="py-2 px-3">
          {status && (
            <Badge className="text-[10px]" style={{ backgroundColor: status.color, color: '#fff' }}>
              {status.name}
            </Badge>
          )}
        </td>
        <td className="py-2 px-3">
          {priority && (
            <span className="flex items-center gap-1 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: priority.color }} />
              {priority.name}
            </span>
          )}
        </td>
        <td className="py-2 px-3 text-xs">{assignee?.full_name || '-'}</td>
        <td className="py-2 px-3 text-xs">{task.planned_end_date || '-'}</td>
        <td className={`py-2 px-3 text-xs ${overdue > 0 ? 'text-red-600 font-semibold' : ''}`}>
          {overdue > 0 ? `${overdue}d` : '-'}
        </td>
        <td className="py-2 px-3 text-xs text-muted-foreground">{monthWeek || '-'}</td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onViewTimeline?.(task); }}
              aria-label="View timeline"
            >
              <Clock className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); setShowAddSubtask(true); }}
              aria-label="Add subtask"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && subtasks.map((st) => (
        <SubtaskRow key={st.id} task={st} statuses={statuses} priorities={priorities} users={users} onEdit={onEdit} />
      ))}
      {expanded && subtasks.length === 0 && (
        <tr><td colSpan={9} className="text-xs text-muted-foreground pl-12 py-1">No subtasks</td></tr>
      )}
      {showAddSubtask && (
        <TaskDialog
          open={showAddSubtask}
          onOpenChange={setShowAddSubtask}
          departmentId={departmentId}
          projectId={projectId}
          parentId={task.id}
        />
      )}
    </>
  );
}

export default function TaskListView({
  tasks,
  statuses,
  priorities,
  users,
  onEdit,
  onViewTimeline,
  onSort,
  sortField,
  sortDir,
  departmentId,
  projectId,
}: TaskListViewProps) {
  // Group tasks by status
  const groupedByStatus = statuses.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status_id === status.id),
  })).filter((g) => g.tasks.length > 0);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(statusId: string) {
    const next = new Set(collapsedGroups);
    if (next.has(statusId)) next.delete(statusId);
    else next.add(statusId);
    setCollapsedGroups(next);
  }

  function SortHeader({ field, label }: { field: string; label: string }) {
    return (
      <th
        className="py-2 px-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
        onClick={() => onSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : ''}`} />
        </span>
      </th>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <SortHeader field="task_no" label="Task #" />
            <SortHeader field="title" label="Title" />
            <SortHeader field="status_id" label="Status" />
            <SortHeader field="priority" label="Priority" />
            <SortHeader field="assignee_id" label="Assignee" />
            <SortHeader field="planned_end_date" label="Due Date" />
            <SortHeader field="overdue_days" label="Overdue" />
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Month/Wk</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground w-10"></th>
          </tr>
        </thead>
        <tbody>
          {groupedByStatus.map(({ status, tasks: groupTasks }) => (
            <React.Fragment key={status.id}>
              <tr
                className="bg-muted/30 cursor-pointer hover:bg-muted/50 border-b"
                onClick={() => toggleGroup(status.id)}
              >
                <td colSpan={9} className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    {collapsedGroups.has(status.id) ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="font-medium text-sm">{status.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{groupTasks.length}</Badge>
                  </div>
                </td>
              </tr>
              {!collapsedGroups.has(status.id) && groupTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  priorities={priorities}
                  users={users}
                  onEdit={onEdit}
                  onViewTimeline={onViewTimeline}
                  departmentId={departmentId}
                  projectId={projectId}
                />
              ))}
            </React.Fragment>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center py-8 text-muted-foreground">
                No tasks yet. Click "+ Task" to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
