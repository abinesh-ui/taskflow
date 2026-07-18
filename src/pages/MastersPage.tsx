import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import AlertRulesSection from '@/components/notifications/AlertRulesPage';

type MasterTable = 'master_task_types' | 'master_task_categories' | 'master_priorities' | 'master_statuses' | 'projects' | 'master_departments' | 'master_members' | 'master_macro_projects';

interface MasterItem {
  id: string;
  name: string;
  position: number;
  is_active: boolean;
  color?: string;
  sort_weight?: number;
  is_closed?: boolean;
  is_done?: boolean;
  is_live?: boolean;
  macro_project_id?: string;
}

function MasterSection({
  title,
  table,
  fields = [],
}: {
  title: string;
  table: MasterTable;
  fields?: string[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: items = [] } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data } = await supabase.from(table).select('*').order('position');
      return (data as MasterItem[]) || [];
    },
  });

  // Fetch macro projects for the projects section
  const { data: macroProjects = [] } = useQuery({
    queryKey: ['master_macro_projects'],
    queryFn: async () => {
      const { data } = await supabase.from('master_macro_projects').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color: string }>;
    },
    enabled: table === 'projects',
  });

  const addMutation = useMutation({
    mutationFn: async (newItem: Record<string, unknown>) => {
      const { error } = await supabase.from(table).insert(newItem);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      setAdding(false);
      setFormData({});
      toast({ title: 'Added successfully' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from(table).update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingId(null);
      setFormData({});
      toast({ title: 'Updated successfully' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from(table).update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
      toast({ title: 'Deleted successfully' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Cannot delete', description: err.message });
    },
  });

  function startEdit(item: MasterItem) {
    setEditingId(item.id);
    const data: Record<string, string> = { name: item.name };
    if (item.color) data.color = item.color;
    if (item.sort_weight !== undefined) data.sort_weight = String(item.sort_weight);
    if (item.is_closed !== undefined) data.is_closed = String(item.is_closed);
    if (item.is_done !== undefined) data.is_done = String(item.is_done);
    if (item.is_live !== undefined) data.is_live = String(item.is_live);
    if (item.macro_project_id) data.macro_project_id = item.macro_project_id;
    setFormData(data);
  }

  const AUTO_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
  ];

  function handleSaveNew() {
    if (!formData.name?.trim()) return;
    // For projects, macro_project_id is required
    if (table === 'projects' && !formData.macro_project_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a Macro Project' });
      return;
    }
    const newItem: Record<string, unknown> = {
      name: formData.name.trim(),
      position: items.length + 1,
    };
    if (table === 'master_departments' || table === 'master_members' || table === 'master_task_types' || table === 'master_task_categories' || table === 'projects' || table === 'master_macro_projects') {
      newItem.color = AUTO_COLORS[items.length % AUTO_COLORS.length];
    }
    if (table === 'projects') {
      newItem.macro_project_id = formData.macro_project_id;
    }
    if (fields.includes('color')) newItem.color = formData.color || '#6b7280';
    if (fields.includes('sort_weight')) newItem.sort_weight = Number(formData.sort_weight) || 0;
    if (fields.includes('is_closed')) newItem.is_closed = formData.is_closed === 'true';
    if (fields.includes('is_done')) newItem.is_done = formData.is_done === 'true';
    if (fields.includes('is_live')) newItem.is_live = formData.is_live !== 'false';
    addMutation.mutate(newItem);
  }

  function handleSaveEdit() {
    if (!editingId || !formData.name?.trim()) return;
    const data: Record<string, unknown> = { name: formData.name.trim() };
    if (table === 'projects' && formData.macro_project_id) {
      data.macro_project_id = formData.macro_project_id;
    }
    if (fields.includes('color')) data.color = formData.color || '#6b7280';
    if (fields.includes('sort_weight')) data.sort_weight = Number(formData.sort_weight) || 0;
    if (fields.includes('is_closed')) data.is_closed = formData.is_closed === 'true';
    if (fields.includes('is_done')) data.is_done = formData.is_done === 'true';
    if (fields.includes('is_live')) data.is_live = formData.is_live !== 'false';
    updateMutation.mutate({ id: editingId, data });
  }

  function getMacroName(id?: string) {
    if (!id) return '';
    return macroProjects.find((m) => m.id === id)?.name || '';
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setFormData({}); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {adding && (
            <div className="flex flex-wrap items-center gap-2 p-2 border rounded bg-muted/50">
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Name"
                className="h-8 text-sm flex-1 min-w-[120px]"
                autoFocus
              />
              {/* Macro Project dropdown for Projects */}
              {table === 'projects' && (
                <Select value={formData.macro_project_id || ''} onValueChange={(val) => setFormData({ ...formData, macro_project_id: val })}>
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue placeholder="Macro Project *" />
                  </SelectTrigger>
                  <SelectContent>
                    {macroProjects.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: mp.color }} />
                          {mp.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {fields.includes('color') && (
                <input type="color" value={formData.color || '#6b7280'} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
              )}
              {fields.includes('sort_weight') && (
                <Input type="number" value={formData.sort_weight || ''} onChange={(e) => setFormData({ ...formData, sort_weight: e.target.value })} placeholder="Weight" className="h-8 text-sm w-20" />
              )}
              {fields.includes('is_live') && (
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={formData.is_live !== 'false'} onChange={(e) => setFormData({ ...formData, is_live: String(e.target.checked) })} />
                  Live
                </label>
              )}
              {fields.includes('is_closed') && (
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={formData.is_closed === 'true'} onChange={(e) => setFormData({ ...formData, is_closed: String(e.target.checked) })} />
                  Closed
                </label>
              )}
              {fields.includes('is_done') && (
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={formData.is_done === 'true'} onChange={(e) => setFormData({ ...formData, is_done: String(e.target.checked) })} />
                  Done
                </label>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveNew}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAdding(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 p-2 border rounded">
              {editingId === item.id ? (
                <>
                  <Input value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-8 text-sm flex-1 min-w-[120px]" autoFocus />
                  {table === 'projects' && (
                    <Select value={formData.macro_project_id || ''} onValueChange={(val) => setFormData({ ...formData, macro_project_id: val })}>
                      <SelectTrigger className="h-8 text-xs w-40">
                        <SelectValue placeholder="Macro Project" />
                      </SelectTrigger>
                      <SelectContent>
                        {macroProjects.map((mp) => (
                          <SelectItem key={mp.id} value={mp.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: mp.color }} />
                              {mp.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {fields.includes('color') && (
                    <input type="color" value={formData.color || '#6b7280'} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                  )}
                  {fields.includes('sort_weight') && (
                    <Input type="number" value={formData.sort_weight || ''} onChange={(e) => setFormData({ ...formData, sort_weight: e.target.value })} placeholder="Weight" className="h-8 text-sm w-20" />
                  )}
                  {fields.includes('is_live') && (
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" checked={formData.is_live !== 'false'} onChange={(e) => setFormData({ ...formData, is_live: String(e.target.checked) })} />
                      Live
                    </label>
                  )}
                  {fields.includes('is_closed') && (
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" checked={formData.is_closed === 'true'} onChange={(e) => setFormData({ ...formData, is_closed: String(e.target.checked) })} />
                      Closed
                    </label>
                  )}
                  {fields.includes('is_done') && (
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" checked={formData.is_done === 'true'} onChange={(e) => setFormData({ ...formData, is_done: String(e.target.checked) })} />
                      Done
                    </label>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  {item.color && (
                    <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  )}
                  <span className="text-sm flex-1">{item.name}</span>
                  {/* Show mapped macro project for projects */}
                  {table === 'projects' && item.macro_project_id && (
                    <Badge variant="outline" className="text-[9px]">{getMacroName(item.macro_project_id)}</Badge>
                  )}
                  {item.sort_weight !== undefined && (
                    <span className="text-xs text-muted-foreground">wt: {item.sort_weight}</span>
                  )}
                  {item.is_live !== undefined && (
                    <Badge variant={item.is_live ? 'default' : 'secondary'} className="text-[10px]">
                      {item.is_live ? 'Live' : 'Archived'}
                    </Badge>
                  )}
                  {item.is_closed && <Badge variant="secondary" className="text-[10px]">Closed</Badge>}
                  {item.is_done && <Badge className="text-[10px] bg-green-600">Done</Badge>}
                  {!item.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => toggleActive.mutate({ id: item.id, active: !item.is_active })}
                    title={item.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {item.is_active ? <X className="h-3 w-3 text-muted-foreground" /> : <Check className="h-3 w-3 text-green-600" />}
                  </Button>
                  {!item.is_active && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(item.id)} title="Delete permanently">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
          {items.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground py-2">No items yet. Click Add to create one.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MastersPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Settings & Masters</h2>
        <p className="text-muted-foreground">Manage master data used in dropdowns and fields.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MasterSection title="Macro Projects" table="master_macro_projects" fields={[]} />
        <MasterSection title="Projects" table="projects" fields={['is_live']} />
        <MasterSection title="Departments" table="master_departments" fields={[]} />
        <MasterSection title="Members" table="master_members" fields={['is_live']} />
        <MasterSection title="Task Types" table="master_task_types" />
        <MasterSection title="Task Categories" table="master_task_categories" />
        <MasterSection title="Priorities" table="master_priorities" fields={['color', 'sort_weight']} />
        <MasterSection title="Statuses" table="master_statuses" fields={['color', 'is_closed', 'is_done']} />
      </div>

      <div className="pt-4">
        <AlertRulesSection />
      </div>
    </div>
  );
}
