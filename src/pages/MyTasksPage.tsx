import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { getPlannedMonthWeek, getOverdueDays } from '@/lib/utils';
import type { Task, MasterStatus, MasterPriority } from '@/types/database';

export default function MyTasksPage() {
  const { user } = useAuth();

  const { data: tasks = [] } = useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('assignee_id', user!.id)
        .order('updated_at', { ascending: false });
      return (data as Task[]) || [];
    },
    enabled: !!user,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['master_statuses'],
    queryFn: async () => {
      const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position');
      return (data as MasterStatus[]) || [];
    },
  });

  const { data: priorities = [] } = useQuery({
    queryKey: ['master_priorities'],
    queryFn: async () => {
      const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position');
      return (data as MasterPriority[]) || [];
    },
  });

  const openTasks = tasks.filter((t) => {
    const status = statuses.find((s) => s.id === t.status_id);
    return !status?.is_closed;
  });

  const closedTasks = tasks.filter((t) => {
    const status = statuses.find((s) => s.id === t.status_id);
    return status?.is_closed;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">My Tasks</h2>

      {openTasks.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No tasks assigned to you.</p>
      )}

      <div className="space-y-2">
        {openTasks.map((task) => {
          const status = statuses.find((s) => s.id === task.status_id);
          const priority = priorities.find((p) => p.id === task.priority_id);
          const overdue = getOverdueDays(task.planned_end_date, status?.is_closed ?? false);

          return (
            <div key={task.id} className="p-3 border rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">{task.task_no}</span>
                {priority && (
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: priority.color }} />
                )}
              </div>
              <p className="text-sm font-medium leading-tight">{task.title}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {status && (
                  <Badge className="text-[10px]" style={{ backgroundColor: status.color, color: '#fff' }}>
                    {status.name}
                  </Badge>
                )}
                {task.planned_end_date && (
                  <span className={`text-[10px] ${overdue > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                    Due: {task.planned_end_date} {overdue > 0 && `(${overdue}d overdue)`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {closedTasks.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Completed ({closedTasks.length})</h3>
          <div className="space-y-1">
            {closedTasks.slice(0, 10).map((task) => {
              const status = statuses.find((s) => s.id === task.status_id);
              return (
                <div key={task.id} className="p-2 border rounded opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono">{task.task_no}</span>
                    <span className="text-xs flex-1 truncate">{task.title}</span>
                    {status && (
                      <Badge className="text-[9px]" style={{ backgroundColor: status.color, color: '#fff' }}>
                        {status.name}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
