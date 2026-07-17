import type { Task, MasterStatus, MasterPriority, MasterTaskType, MasterTaskCategory, Profile } from '@/types/database';
import { getPlannedMonthWeek, getOverdueDays } from './utils';

interface ExportContext {
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  taskTypes: MasterTaskType[];
  categories: MasterTaskCategory[];
  users: Profile[];
}

export function exportTasksToCSV(tasks: Task[], context: ExportContext): void {
  const headers = [
    'Task No',
    'Title',
    'Status',
    'Priority',
    'Assignee',
    'Task Type',
    'Category',
    'Planned Start',
    'Planned End',
    'Planned Month/Week',
    'Planned Mins',
    'Actual Start',
    'Actual End',
    'Actual Mins',
    'Overdue Days',
    'Created At',
  ];

  const rows = tasks.map((t) => {
    const status = context.statuses.find((s) => s.id === t.status_id);
    const priority = context.priorities.find((p) => p.id === t.priority_id);
    const taskType = context.taskTypes.find((tt) => tt.id === t.task_type_id);
    const category = context.categories.find((c) => c.id === t.category_id);
    const assignee = context.users.find((u) => u.id === t.assignee_id);
    const overdue = getOverdueDays(t.planned_end_date, status?.is_closed ?? false);
    const monthWeek = getPlannedMonthWeek(t.planned_start_date);

    return [
      t.task_no,
      t.title,
      status?.name || '',
      priority?.name || '',
      assignee?.full_name || '',
      taskType?.name || '',
      category?.name || '',
      t.planned_start_date || '',
      t.planned_end_date || '',
      monthWeek,
      t.planned_mins?.toString() || '',
      t.actual_start_date || '',
      t.actual_end_date || '',
      t.actual_mins?.toString() || '',
      overdue > 0 ? overdue.toString() : '',
      t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `taskflow_export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
