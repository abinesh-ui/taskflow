import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight } from 'lucide-react';
import type { Task, MasterStatus, Profile } from '@/types/database';

interface StatusTimelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  statuses: MasterStatus[];
}

export default function StatusTimeline({ open, onOpenChange, task, statuses }: StatusTimelineProps) {
  const { data: history = [] } = useQuery({
    queryKey: ['task_status_history', task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('task_status_history')
        .select('*')
        .eq('task_id', task.id)
        .order('changed_at', { ascending: true });
      return data || [];
    },
    enabled: open,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return (data as Profile[]) || [];
    },
  });

  function getStatusName(id: string | null) {
    if (!id) return '(None)';
    return statuses.find((s) => s.id === id)?.name || 'Unknown';
  }

  function getStatusColor(id: string | null) {
    if (!id) return '#6b7280';
    return statuses.find((s) => s.id === id)?.color || '#6b7280';
  }

  function getUserName(id: string) {
    return profiles.find((p) => p.id === id)?.full_name || 'Unknown';
  }

  // Calculate time spent in each status
  function getTimeInStatus(): { statusId: string; statusName: string; color: string; durationMs: number }[] {
    if (history.length === 0) return [];
    const statusTimes: Record<string, number> = {};

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const nextEntry = history[i + 1];
      const start = new Date(entry.changed_at).getTime();
      const end = nextEntry ? new Date(nextEntry.changed_at).getTime() : Date.now();
      const statusId = entry.to_status_id;
      statusTimes[statusId] = (statusTimes[statusId] || 0) + (end - start);
    }

    return Object.entries(statusTimes).map(([statusId, durationMs]) => ({
      statusId,
      statusName: getStatusName(statusId),
      color: getStatusColor(statusId),
      durationMs,
    }));
  }

  function formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  const timeInStatus = getTimeInStatus();
  const totalTime = timeInStatus.reduce((sum, t) => sum + t.durationMs, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Status Timeline — {task.task_no}
          </DialogTitle>
        </DialogHeader>

        {/* TAT Summary */}
        {timeInStatus.length > 0 && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <h4 className="text-sm font-semibold">Turnaround Time (TAT)</h4>
            <p className="text-xs text-muted-foreground">Total: {formatDuration(totalTime)}</p>
            <div className="space-y-1">
              {timeInStatus.map(({ statusId, statusName, color, durationMs }) => (
                <div key={statusId} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs flex-1">{statusName}</span>
                  <span className="text-xs font-mono">{formatDuration(durationMs)}</span>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(durationMs / totalTime) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3 mt-4">
          <h4 className="text-sm font-semibold">Change History</h4>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry, idx) => (
                <div key={entry.id} className="flex items-start gap-3 relative">
                  {idx < history.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                  )}
                  <div className="h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 bg-background"
                    style={{ borderColor: getStatusColor(entry.to_status_id) }}
                  >
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(entry.to_status_id) }} />
                  </div>
                  <div className="flex-1 min-w-0 pb-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: getStatusColor(entry.from_status_id) }}>
                        {getStatusName(entry.from_status_id)}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge className="text-[10px]" style={{ backgroundColor: getStatusColor(entry.to_status_id), color: '#fff' }}>
                        {getStatusName(entry.to_status_id)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{getUserName(entry.changed_by)}</span>
                      <span>·</span>
                      <span title={format(new Date(entry.changed_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
