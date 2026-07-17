import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUpdateTask } from '@/hooks/use-tasks';
import type { Task, MasterStatus, MasterPriority } from '@/types/database';

interface TaskCalendarViewProps {
  tasks: Task[];
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  onEdit: (task: Task) => void;
}

export default function TaskCalendarView({ tasks, statuses, priorities, onEdit }: TaskCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateField, setDateField] = useState<'planned_end_date' | 'planned_start_date'>('planned_end_date');
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const updateTask = useUpdateTask();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  function getTasksForDay(day: Date): Task[] {
    return tasks.filter((t) => {
      const dateVal = t[dateField];
      if (!dateVal) return false;
      return isSameDay(new Date(dateVal), day);
    });
  }

  function handleDrop(day: Date) {
    if (!dragTask) return;
    const newDate = format(day, 'yyyy-MM-dd');
    updateTask.mutate({ id: dragTask.id, data: { [dateField]: newDate } });
    setDragTask(null);
  }

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  return (
    <div className="space-y-3">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show:</span>
          <Button
            variant={dateField === 'planned_end_date' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setDateField('planned_end_date')}
          >
            Due Date
          </Button>
          <Button
            variant={dateField === 'planned_start_date' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setDateField('planned_start_date')}
          >
            Start Date
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 px-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((dayDate, di) => {
              const dayTasks = getTasksForDay(dayDate);
              const isCurrentMonth = isSameMonth(dayDate, currentMonth);
              const isToday = isSameDay(dayDate, new Date());

              return (
                <div
                  key={di}
                  className={`min-h-[100px] p-1 border-r last:border-r-0 ${
                    !isCurrentMonth ? 'bg-muted/20' : ''
                  } ${isToday ? 'bg-primary/5' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(dayDate)}
                >
                  <div className={`text-xs mb-1 text-right ${
                    isToday ? 'font-bold text-primary' : isCurrentMonth ? '' : 'text-muted-foreground'
                  }`}>
                    {format(dayDate, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => {
                      const priority = priorities.find((p) => p.id === task.priority_id);
                      const status = statuses.find((s) => s.id === task.status_id);
                      return (
                        <div
                          key={task.id}
                          className="text-[10px] p-1 rounded cursor-pointer hover:opacity-80 truncate"
                          style={{ backgroundColor: (priority?.color || status?.color || '#6b7280') + '20', borderLeft: `3px solid ${priority?.color || status?.color || '#6b7280'}` }}
                          draggable
                          onDragStart={() => setDragTask(task)}
                          onClick={() => onEdit(task)}
                          title={task.title}
                        >
                          {task.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
