import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, X, ArrowUp, ArrowDown, GripVertical, Save, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface SortLevel {
  field: string;
  direction: 'asc' | 'desc';
}

const SORT_FIELDS = [
  { value: 'planned_end_date', label: 'Due Date' },
  { value: 'priority_weight', label: 'Priority' },
  { value: 'overdue_days', label: 'Overdue Days' },
  { value: 'task_type_position', label: 'Task Type' },
  { value: 'title', label: 'Title' },
  { value: 'task_no', label: 'Task No' },
  { value: 'status_position', label: 'Status' },
  { value: 'planned_start_date', label: 'Start Date' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'planned_mins', label: 'Planned Mins' },
];

interface SortBuilderProps {
  sortLevels: SortLevel[];
  onSortChange: (levels: SortLevel[]) => void;
}

export function SortBuilderInline({ sortLevels, onSortChange }: SortBuilderProps) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: savedSorts = [] } = useQuery({
    queryKey: ['saved_views', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('saved_views').select('*').eq('user_id', user!.id).order('created_at');
      return data || [];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('saved_views').insert({
        user_id: user!.id,
        name: saveName,
        view_type: 'list',
        sort_config: sortLevels as any,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved_views'] });
      toast({ title: 'Sort saved' });
      setShowSave(false);
      setSaveName('');
    },
  });

  function addLevel() {
    const used = new Set(sortLevels.map((l) => l.field));
    const available = SORT_FIELDS.find((f) => !used.has(f.value));
    if (available) onSortChange([...sortLevels, { field: available.value, direction: 'asc' }]);
  }

  function removeLevel(idx: number) { onSortChange(sortLevels.filter((_, i) => i !== idx)); }
  function updateField(idx: number, field: string) { const u = [...sortLevels]; u[idx] = { ...u[idx], field }; onSortChange(u); }
  function toggleDir(idx: number) { const u = [...sortLevels]; u[idx] = { ...u[idx], direction: u[idx].direction === 'asc' ? 'desc' : 'asc' }; onSortChange(u); }
  function moveLevel(idx: number, dir: 'up' | 'down') {
    const ni = dir === 'up' ? idx - 1 : idx + 1;
    if (ni < 0 || ni >= sortLevels.length) return;
    const u = [...sortLevels]; [u[idx], u[ni]] = [u[ni], u[idx]]; onSortChange(u);
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
        Sort{sortLevels.length > 0 ? ` (${sortLevels.length})` : ''}
      </Button>

      {sortLevels.length > 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onSortChange([])}>
          <X className="h-3 w-3" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sort Builder</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {sortLevels.map((level, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 border rounded bg-muted/30">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs w-4">{idx + 1}.</span>
                <select value={level.field} onChange={(e) => updateField(idx, e.target.value)} className="h-7 text-xs bg-background border rounded px-2 flex-1">
                  {SORT_FIELDS.map((f) => <option key={f.value} value={f.value} disabled={sortLevels.some((l, i) => i !== idx && l.field === f.value)}>{f.label}</option>)}
                </select>
                <Button variant="outline" size="sm" className="h-7 text-xs w-16" onClick={() => toggleDir(idx)}>
                  {level.direction === 'asc' ? <><ArrowUp className="h-3 w-3 mr-0.5" />Asc</> : <><ArrowDown className="h-3 w-3 mr-0.5" />Desc</>}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLevel(idx, 'up')} disabled={idx === 0}><ArrowUp className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLevel(idx, 'down')} disabled={idx === sortLevels.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLevel(idx)}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={addLevel} disabled={sortLevels.length >= SORT_FIELDS.length}>
              <Plus className="h-3 w-3 mr-1" /> Add Sort Level
            </Button>

            {/* Saved sorts */}
            {savedSorts.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <span className="text-xs font-medium text-muted-foreground">Saved Sorts</span>
                <div className="space-y-1 mt-1">
                  {savedSorts.filter((s: any) => s.sort_config?.length > 0).map((s: any) => (
                    <Button key={s.id} variant="ghost" size="sm" className="h-6 text-xs w-full justify-start" onClick={() => { onSortChange(s.sort_config); setOpen(false); }}>
                      {s.name} ({s.sort_config.length} levels)
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setShowSave(true)} disabled={sortLevels.length === 0}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save dialog */}
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Save Sort</DialogTitle></DialogHeader>
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Sort name..." />
          <DialogFooter>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!saveName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
