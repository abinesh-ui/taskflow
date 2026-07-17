import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Bell, BellOff } from 'lucide-react';
import type { AlertRule } from '@/types/database';

const RULE_TYPES = [
  { value: 'before_due', label: 'Before Due Date' },
  { value: 'on_overdue', label: 'On Overdue (daily)' },
  { value: 'on_assignment', label: 'On Assignment' },
  { value: 'on_status_change', label: 'On Status Change' },
];

export default function AlertRulesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rule_type: 'before_due',
    days_before: '1',
    target_statuses: '',
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['alert_rules'],
    queryFn: async () => {
      const { data } = await supabase.from('alert_rules').select('*').order('created_at');
      return (data as AlertRule[]) || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config: Record<string, unknown> = {};
      if (formData.rule_type === 'before_due') config.days_before = Number(formData.days_before);
      if (formData.rule_type === 'on_status_change') config.target_statuses = formData.target_statuses.split(',').map((s) => s.trim());

      if (editingRule) {
        const { error } = await supabase.from('alert_rules').update({
          name: formData.name,
          rule_type: formData.rule_type,
          config,
        }).eq('id', editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('alert_rules').insert({
          name: formData.name,
          rule_type: formData.rule_type,
          config,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
      toast({ title: editingRule ? 'Rule updated' : 'Rule created' });
      setShowAdd(false);
      setEditingRule(null);
      setFormData({ name: '', rule_type: 'before_due', days_before: '1', target_statuses: '' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('alert_rules').update({ is_active: active }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert_rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('alert_rules').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
      toast({ title: 'Rule deleted' });
    },
  });

  function startEdit(rule: AlertRule) {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      rule_type: rule.rule_type,
      days_before: String((rule.config as any)?.days_before || 1),
      target_statuses: ((rule.config as any)?.target_statuses || []).join(', '),
    });
    setShowAdd(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Alert Rules</CardTitle>
        <Button size="sm" variant="outline" onClick={() => { setEditingRule(null); setShowAdd(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Rule
        </Button>
      </CardHeader>
      <CardContent>
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No alert rules configured. Add one to get started.</p>
        )}
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2 p-3 border rounded">
              <Bell className={`h-4 w-4 ${rule.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <div className="font-medium text-sm">{rule.name}</div>
                <div className="text-xs text-muted-foreground">
                  {RULE_TYPES.find((t) => t.value === rule.rule_type)?.label || rule.rule_type}
                  {rule.rule_type === 'before_due' && ` — ${(rule.config as any)?.days_before || 1} day(s) before`}
                </div>
              </div>
              <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {rule.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleMutation.mutate({ id: rule.id, active: !rule.is_active })}>
                {rule.is_active ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(rule)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(rule.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) setEditingRule(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Alert Rule' : 'Add Alert Rule'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. 2 days before due" />
              </div>
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select value={formData.rule_type} onValueChange={(val) => setFormData({ ...formData, rule_type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.rule_type === 'before_due' && (
                <div className="space-y-2">
                  <Label>Days/Hours Before</Label>
                  <Input type="number" value={formData.days_before} onChange={(e) => setFormData({ ...formData, days_before: e.target.value })} />
                </div>
              )}
              {formData.rule_type === 'on_status_change' && (
                <div className="space-y-2">
                  <Label>Target Status Names (comma-separated)</Label>
                  <Input value={formData.target_statuses} onChange={(e) => setFormData({ ...formData, target_statuses: e.target.value })} placeholder="Client Pending, PMO Review" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!formData.name.trim()}>
                {editingRule ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
