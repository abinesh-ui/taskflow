import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, ArrowUp, ArrowDown, GripVertical, Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface SortLevel {
  field: string;
  direction: 'asc' | 'desc';
}

const SORTABLE_FIELDS = [
  { value: 'priority', label: 'Priority' },
  { value: 'overdue_days', label: 'Overdue Days' },
  { value: 'task_type_id', label: 'Task Type (Run)' },
  { value: 'planned_end_date', label: 'Due Date' },
  { value: 'planned_start_date', label: 'Start Date' },
  { value: 'title', label: 'Title' },
  { value: 'task_no', label: 'Task No' },
  { value: 'assignee_id', label: 'Assignee' },
  { value: 'status_id', label: 'Status' },
  { value: 'planned_mins', label: 'Planned Mins' },
  { value: 'actual_mins', label: 'Actual Mins' },
  { value: 'created_at', label: 'Created Date' },
];

interface MultiLevelSortProps {
  sortLevels: SortLevel[];
  onSortChange: (levels: SortLevel[]) => void;
}

export function MultiLevelSortBuilder({ sortLevels, onSortChange }: MultiLevelSortProps) {
  function addLevel() {
    const used = new Set(sortLevels.map((l) => l.field));
    const available = SORTABLE_FIELDS.find((f) => !used.has(f.value));
    if (available) {
      onSortChange([...sortLevels, { field: available.value, direction: 'asc' }]);
    }
  }

  function removeLevel(index: number) {
    onSortChange(sortLevels.filter((_, i) => i !== index));
  }

  function updateField(index: number, field: string) {
    const updated = [...sortLevels];
    updated[index] = { ...updated[index], field };
    onSortChange(updated);
  }

  function toggleDirection(index: number) {
    const updated = [...sortLevels];
    updated[index] = { ...updated[index], direction: updated[index].direction === 'asc' ? 'desc' : 'asc' };
    onSortChange(updated);
  }

  function moveLevel(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortLevels.length) return;
    const updated = [...sortLevels];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onSortChange(updated);
  }

  return (
    <div className="space-y-2">
      {sortLevels.map((level, idx) => (
        <div key={idx} className="flex items-center gap-2 p-2 border rounded bg-muted/30">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
          <Select value={level.field} onValueChange={(val) => updateField(idx, val)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTABLE_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value} disabled={sortLevels.some((l, i) => i !== idx && l.field === f.value)}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs w-20"
            onClick={() => toggleDirection(idx)}
          >
            {level.direction === 'asc' ? (
              <><ArrowUp className="h-3 w-3 mr-1" /> Asc</>
            ) : (
              <><ArrowDown className="h-3 w-3 mr-1" /> Desc</>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLevel(idx, 'up')} disabled={idx === 0}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLevel(idx, 'down')} disabled={idx === sortLevels.length - 1}>
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLevel(idx)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addLevel} disabled={sortLevels.length >= SORTABLE_FIELDS.length}>
        <Plus className="h-3 w-3 mr-1" /> Add Sort Level
      </Button>
    </div>
  );
}

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewType: 'list' | 'board' | 'calendar';
  filters: Record<string, unknown>;
  sortConfig: SortLevel[];
}

export function SaveViewDialog({ open, onOpenChange, viewType, filters, sortConfig }: SaveViewDialogProps) {
  const [name, setName] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('saved_views').insert({
        user_id: user!.id,
        name,
        view_type: viewType,
        filters,
        sort_config: sortConfig as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved_views'] });
      toast({ title: 'View saved' });
      onOpenChange(false);
      setName('');
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save Current View</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>View Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priority Board"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Saves current filters ({Object.keys(filters).filter((k) => (filters as any)[k]).length} active) and sort ({sortConfig.length} levels) as a reusable view.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
