import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/use-access-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { Calendar, CheckCircle } from 'lucide-react';
import type { Task, MasterStatus, Project, Department } from '@/types/database';

export default function POAPage() {
  const { user } = useAuth();
  const { userProjectIds } = useAccessControl();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const today = new Date().toISOString().split('T')[0];

  // Check edit_poa permission
  const { data: currentMember } = useQuery({ queryKey: ['current-member', user?.id], queryFn: async () => { const { data: profile } = await supabase.from('profiles').select('email').eq('id', user!.id).single(); if (!profile) return null; const { data } = await supabase.from('master_members').select('role').eq('email', profile.email).single(); return data as { role?: string } | null; }, enabled: !!user });
  const { data: permissions = [] } = useQuery({ queryKey: ['role_permissions'], queryFn: async () => { const { data } = await supabase.from('role_permissions').select('*'); return (data || []) as Array<{ role: string; permission: string; allowed: boolean }>; } });
  const canEditPoa = (() => { const role = currentMember?.role || 'team_member'; if (role === 'admin') return true; const perm = permissions.find((p) => p.role === role && p.permission === 'edit_poa'); return perm?.allowed ?? false; })();
  const canDeletePoa = (() => { const role = currentMember?.role || 'team_member'; if (role === 'admin') return true; const perm = permissions.find((p) => p.role === role && p.permission === 'delete_poa'); return perm?.allowed ?? false; })();

  async function deletePoa(poaId: string) {
    if (!confirm('Delete this POA submission permanently?')) return;
    await supabase.from('poa_items').delete().eq('poa_id', poaId);
    await supabase.from('poa_submissions').delete().eq('id', poaId);
    queryClient.invalidateQueries({ queryKey: ['poa_submissions'] });
    queryClient.invalidateQueries({ queryKey: ['poa_items'] });
    queryClient.invalidateQueries({ queryKey: ['poa_today'] });
    toast({ title: 'POA deleted' });
  }

  const { data: poaSubmissions = [] } = useQuery({
    queryKey: ['poa_submissions', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('poa_submissions').select('*').eq('user_id', user!.id).order('submitted_date', { ascending: false });
      return (data || []) as Array<{ id: string; submitted_date: string; total_planned_mins: number; total_actual_mins: number; submitted_at: string }>;
    },
    enabled: !!user,
  });

  const { data: poaItems = [] } = useQuery({
    queryKey: ['poa_items'],
    queryFn: async () => {
      const { data } = await supabase.from('poa_items').select('*');
      return (data || []) as Array<{ id: string; poa_id: string; task_id: string; planned_mins: number; actual_mins: number }>;
    },
  });

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return (data || []) as Task[]; } });

  // Access control: non-admin only sees tasks from assigned projects
  const visibleTasks = userProjectIds ? allTasks.filter((t) => userProjectIds.includes(t.project_id)) : allTasks;
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });

  const todaySubmitted = poaSubmissions.find((p) => p.submitted_date === today);

  function getTasksForPoa(poaId: string) {
    const items = poaItems.filter((i) => i.poa_id === poaId);
    return items.map((item) => {
      const task = visibleTasks.find((t) => t.id === item.task_id);
      return { ...item, task };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Plan of Action (POA)</h2>
        <div className="flex items-center gap-2">
          {todaySubmitted && <Badge className="bg-green-600 text-white text-[10px]"><CheckCircle className="h-3 w-3 mr-1" /> Today's POA submitted</Badge>}
          {!canEditPoa && <span className="text-[9px] text-muted-foreground">(Edit requires permission)</span>}
        </div>
      </div>

      {/* POA History */}
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-muted/60 border-b font-semibold text-muted-foreground uppercase">
              <th className="py-2 px-3 text-left">Date</th>
              <th className="py-2 px-3 text-left">Tasks</th>
              <th className="py-2 px-3 text-left">Planned Mins</th>
              <th className="py-2 px-3 text-left">Actual Mins</th>
              <th className="py-2 px-3 text-left">Status</th>
              <th className="py-2 px-3 text-left w-16"></th>
            </tr>
          </thead>
          <tbody>
            {poaSubmissions.map((poa) => {
              const items = poaItems.filter((i) => i.poa_id === poa.id);
              return (
                <tr key={poa.id} className="border-b hover:bg-accent/20">
                  <td className="py-2 px-3 font-medium">{formatDate(poa.submitted_date)}</td>
                  <td className="py-2 px-3">{items.length} tasks</td>
                  <td className="py-2 px-3">{poa.total_planned_mins} mins</td>
                  <td className="py-2 px-3">{poa.total_actual_mins} mins</td>
                  <td className="py-2 px-3"><Badge className="bg-green-600 text-white text-[8px]">Submitted</Badge></td>
                  <td className="py-2 px-2">{canDeletePoa && <button onClick={() => deletePoa(poa.id)} className="text-[9px] text-destructive hover:underline">Delete</button>}</td>
                </tr>
              );
            })}
            {poaSubmissions.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No POA submissions yet. Use "Daily POA" button on the All Tasks page to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Expandable details for each POA — editable */}
      {poaSubmissions.map((poa) => {
        const tasks = getTasksForPoa(poa.id);
        if (tasks.length === 0) return null;
        return (
          <details key={poa.id} className="border rounded-lg bg-white dark:bg-card shadow-sm">
            <summary className="p-3 cursor-pointer text-xs font-medium flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(poa.submitted_date)} — {tasks.length} tasks, {poa.total_planned_mins} mins planned
            </summary>
            <div className="border-t p-3">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b text-muted-foreground"><th className="py-1 px-2 text-left">Task</th><th className="py-1 px-2 text-left">Project</th><th className="py-1 px-2 text-left">Status</th><th className="py-1 px-2 text-left">POA Planned</th><th className="py-1 px-2 text-left">POA Actual</th>{canEditPoa && <th className="py-1 px-2 w-12"></th>}</tr></thead>
                <tbody>
                  {tasks.map((item) => {
                    const status = statuses.find((s) => s.id === item.task?.status_id);
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="py-1.5 px-2"><span className="font-mono text-[9px] text-muted-foreground mr-1">{item.task?.task_no}</span>{item.task?.title}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">{projects.find((p) => p.id === item.task?.project_id)?.name}</td>
                        <td className="py-1.5 px-2">{status && <Badge style={{ backgroundColor: status.color, color: '#fff' }} className="text-[8px]">{status.name}</Badge>}</td>
                        <td className="py-1.5 px-2">{canEditPoa ? <input type="number" defaultValue={item.planned_mins} onBlur={async (e) => { const v = Number(e.target.value) || 0; await supabase.from('poa_items').update({ planned_mins: v }).eq('id', item.id); const totalP = tasks.reduce((s, t) => s + (t.id === item.id ? v : t.planned_mins), 0); await supabase.from('poa_submissions').update({ total_planned_mins: totalP }).eq('id', poa.id); queryClient.invalidateQueries({ queryKey: ['poa_submissions'] }); queryClient.invalidateQueries({ queryKey: ['poa_items'] }); }} className="h-6 w-16 text-[10px] border rounded px-1 bg-background" /> : <span>{item.planned_mins} mins</span>}</td>
                        <td className="py-1.5 px-2">{canEditPoa ? <input type="number" defaultValue={item.actual_mins} onBlur={async (e) => { const v = Number(e.target.value) || 0; await supabase.from('poa_items').update({ actual_mins: v }).eq('id', item.id); await supabase.from('tasks').update({ poa_actual_mins: v }).eq('id', item.task_id); const totalA = tasks.reduce((s, t) => s + (t.id === item.id ? v : t.actual_mins), 0); await supabase.from('poa_submissions').update({ total_actual_mins: totalA }).eq('id', poa.id); queryClient.invalidateQueries({ queryKey: ['poa_submissions'] }); queryClient.invalidateQueries({ queryKey: ['poa_items'] }); queryClient.invalidateQueries({ queryKey: ['all-tasks'] }); }} className="h-6 w-16 text-[10px] border rounded px-1 bg-background" /> : <span>{item.actual_mins} mins</span>}</td>
                        {canEditPoa && <td className="py-1.5 px-2"><button onClick={async () => { await supabase.from('poa_items').delete().eq('id', item.id); queryClient.invalidateQueries({ queryKey: ['poa_items'] }); }} className="text-[9px] text-destructive hover:underline">Remove</button></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {canEditPoa && <p className="text-[9px] text-muted-foreground mt-2">Edit planned/actual mins inline. Changes save on blur.</p>}
            </div>
          </details>
        );
      })}
    </div>
  );
}
