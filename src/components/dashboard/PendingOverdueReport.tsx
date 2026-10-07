import React, { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, getOverdueDays } from '@/lib/utils';
import type { Task, MasterStatus, MasterPriority } from '@/types/database';

type SortField = 'task_no' | 'title' | 'project' | 'priority' | 'assignee' | 'due_date' | 'overdue_days' | 'status';
type GroupBy = 'none' | 'project_id' | 'assignee_id' | 'priority_id' | 'status_id';

interface PendingOverdueReportProps {
  tasks: Task[];
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  members: Array<{ id: string; name: string; color: string }>;
  projects: Array<{ id: string; name: string; color?: string }>;
}

/**
 * Daily "Pending & Overdue Tasks" pivot report.
 * Shown at the bottom of the dashboard — scrollable, sortable, groupable,
 * so the user can review every open task (and subtask) at a glance each day.
 */
export default function PendingOverdueReport({ tasks, statuses, priorities, members, projects }: PendingOverdueReportProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('priority_id');
  const [sortField, setSortField] = useState<SortField>('overdue_days');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const closedStatusIds = useMemo(() => new Set(statuses.filter((s) => s.is_closed).map((s) => s.id)), [statuses]);

  // Pending = any open (not closed) task or subtask. Includes both, with a Type column
  // distinguishing them, since a parent task can look "open" purely because a subtask
  // is still incomplete — the subtask itself is the actionable item.
  const rows = useMemo(() => {
    return tasks
      .filter((t) => !closedStatusIds.has(t.status_id))
      .map((t) => {
        const status = statuses.find((s) => s.id === t.status_id);
        const priority = priorities.find((p) => p.id === t.priority_id);
        const assignee = members.find((m) => m.id === t.assignee_id);
        const project = projects.find((p) => p.id === t.project_id);
        const overdueDays = getOverdueDays(t.planned_end_date, status?.is_closed ?? false);
        return { task: t, status, priority, assignee, project, overdueDays, isSubtask: !!t.parent_id };
      })
      .filter((r) => !onlyOverdue || r.overdueDays > 0);
  }, [tasks, closedStatusIds, statuses, priorities, members, projects, onlyOverdue]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortField) {
        case 'task_no': return a.task.task_no.localeCompare(b.task.task_no) * dir;
        case 'title': return a.task.title.localeCompare(b.task.title) * dir;
        case 'project': return (a.project?.name || '').localeCompare(b.project?.name || '') * dir;
        case 'priority': return ((a.priority?.sort_weight ?? 0) - (b.priority?.sort_weight ?? 0)) * dir;
        case 'assignee': return (a.assignee?.name || '').localeCompare(b.assignee?.name || '') * dir;
        case 'due_date': return (a.task.planned_end_date || '').localeCompare(b.task.planned_end_date || '') * dir;
        case 'status': return (a.status?.name || '').localeCompare(b.status?.name || '') * dir;
        case 'overdue_days':
        default:
          return (a.overdueDays - b.overdueDays) * dir;
      }
    });
  }, [rows, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'overdue_days' ? 'desc' : 'asc'); }
  }

  function SortHeader({ field, label, className }: { field: SortField; label: string; className?: string }) {
    return (
      <th
        className={`py-2 px-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap select-none ${className || ''}`}
        onClick={() => handleSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : ''}`} />
        </span>
      </th>
    );
  }

  // Grouping (pivot-style subtotal rows)
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: null as string | null, color: undefined as string | undefined, rows: sortedRows }];
    const groupLabel = (r: typeof sortedRows[number]): { key: string; label: string; color?: string } => {
      if (groupBy === 'project_id') return { key: r.project?.id || 'none', label: r.project?.name || 'No Project', color: r.project?.color };
      if (groupBy === 'assignee_id') return { key: r.assignee?.id || 'none', label: r.assignee?.name || 'Unassigned', color: r.assignee?.color };
      if (groupBy === 'priority_id') return { key: r.priority?.id || 'none', label: r.priority?.name || 'No Priority', color: r.priority?.color };
      return { key: r.status?.id || 'none', label: r.status?.name || 'No Status', color: r.status?.color };
    };
    const map = new Map<string, { label: string; color?: string; rows: typeof sortedRows }>();
    for (const r of sortedRows) {
      const g = groupLabel(r);
      if (!map.has(g.key)) map.set(g.key, { label: g.label, color: g.color, rows: [] });
      map.get(g.key)!.rows.push(r);
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [sortedRows, groupBy]);

  function toggleGroup(key: string) {
    const next = new Set(collapsedGroups);
    if (next.has(key)) next.delete(key); else next.add(key);
    setCollapsedGroups(next);
  }

  const overdueCount = rows.filter((r) => r.overdueDays > 0).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <ListTodo className="h-4 w-4" /> Pending &amp; Overdue Tasks
            <Badge variant="secondary" className="text-[10px] ml-1">{rows.length}</Badge>
            {overdueCount > 0 && <Badge variant="destructive" className="text-[10px]">{overdueCount} overdue</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} className="h-3.5 w-3.5" />
              Overdue only
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="h-7 text-[11px] border rounded px-2 bg-background"
            >
              <option value="none">No grouping</option>
              <option value="priority_id">Group by Priority</option>
              <option value="status_id">Group by Status</option>
              <option value="project_id">Group by Project</option>
              <option value="assignee_id">Group by Assignee</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/50 border-b">
              <tr>
                <SortHeader field="task_no" label="Task #" />
                <SortHeader field="title" label="Title" />
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                <SortHeader field="project" label="Project" />
                <SortHeader field="status" label="Status" />
                <SortHeader field="priority" label="Priority" />
                <SortHeader field="assignee" label="Assignee" />
                <SortHeader field="due_date" label="Due Date" />
                <SortHeader field="overdue_days" label="Days Overdue" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.key}>
                  {g.label !== null && (
                    <tr key={`grp-${g.key}`} className="bg-muted/30 cursor-pointer hover:bg-muted/50 border-b" onClick={() => toggleGroup(g.key)}>
                      <td colSpan={9} className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          {collapsedGroups.has(g.key) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {g.color && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />}
                          <span className="font-medium text-xs">{g.label}</span>
                          <Badge variant="secondary" className="text-[9px]">{g.rows.length}</Badge>
                          {g.rows.some((r) => r.overdueDays > 0) && (
                            <Badge variant="destructive" className="text-[9px]">{g.rows.filter((r) => r.overdueDays > 0).length} overdue</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {!collapsedGroups.has(g.key) && g.rows.map(({ task, status, priority, assignee, project, overdueDays, isSubtask }) => (
                    <tr key={task.id} className="border-b hover:bg-muted/30 text-xs">
                      <td className={`py-2 px-3 font-mono text-muted-foreground ${isSubtask ? 'pl-8' : ''}`}>{task.task_no}</td>
                      <td className="py-2 px-3">{task.title}</td>
                      <td className="py-2 px-3 text-muted-foreground">{isSubtask ? 'Subtask' : 'Task'}</td>
                      <td className="py-2 px-3">{project?.name || '-'}</td>
                      <td className="py-2 px-3">
                        {status && <Badge className="text-[10px]" style={{ backgroundColor: status.color, color: '#fff' }}>{status.name}</Badge>}
                      </td>
                      <td className="py-2 px-3">
                        {priority && (
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color }} />
                            {priority.name}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">{assignee?.name || '-'}</td>
                      <td className="py-2 px-3">{formatDate(task.planned_end_date)}</td>
                      <td className={`py-2 px-3 ${overdueDays > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                        {overdueDays > 0 ? `${overdueDays}d` : '-'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No pending tasks — you're all caught up.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
