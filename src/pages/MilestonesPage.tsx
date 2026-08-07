import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/use-access-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NestedFilterBuilder, type FilterCondition } from '@/components/tasks/NestedFilter';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { Plus, Filter } from 'lucide-react';
import type { Project, Task } from '@/types/database';

const STATUS_LABELS: Record<string, string> = { yet_to_initiate: 'Yet to Initiate', wip: 'WIP', done: 'Done', closed: 'Closed' };
const STATUS_COLORS: Record<string, string> = { yet_to_initiate: '#6b7280', wip: '#3b82f6', done: '#10b981', closed: '#8b5cf6' };

export default function MilestonesPage() {
  const { user } = useAuth();
  const { userProjectIds, isAdmin } = useAccessControl();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState<Record<string, string>>({});
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Get current user's role from members
  const { data: currentMember } = useQuery({
    queryKey: ['current-member', user?.email],
    queryFn: async () => {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', user!.id).single();
      if (!profile) return null;
      const { data } = await supabase.from('master_members').select('*').ilike('email', profile.email.toLowerCase()).single();
      return data as { role?: string } | null;
    },
    enabled: !!user,
  });
  const { data: permissions = [] } = useQuery({ queryKey: ['role_permissions'], queryFn: async () => { const { data } = await supabase.from('role_permissions').select('*'); return (data || []) as Array<{ role: string; permission: string; allowed: boolean }>; } });
  const userRole = currentMember?.role || 'team_member';
  const canManage = userRole === 'admin' || userRole === 'manager'; // kept for backward compat

  function hasPerm(perm: string) {
    if (userRole === 'admin') return true;
    const p = permissions.find((x) => x.role === userRole && x.permission === perm);
    return p?.allowed ?? false;
  }

  const canCreate = hasPerm('create_milestone');
  const canEdit = hasPerm('edit_milestone');
  const canDelete = hasPerm('delete_milestone');
  const canClose = hasPerm('close_milestone');

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones'],
    queryFn: async () => {
      const { data } = await supabase.from('milestones').select('*').order('created_at', { ascending: false });
      return (data || []) as Array<{ id: string; milestone_no: string; project_id: string; description: string; planned_start_date: string | null; planned_end_date: string | null; actual_start_date: string | null; actual_end_date: string | null; status: string; created_at: string }>;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return (data || []) as Project[];
    },
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*');
      return (data || []) as Task[];
    },
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['master_statuses'],
    queryFn: async () => {
      const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; is_closed: boolean }>;
    },
  });

  // Compute milestone status from linked tasks
  function computeStatus(milestone: any): { status: string; actualStart: string | null; actualEnd: string | null } {
    const tasks = allTasks.filter((t) => (t as any).milestone_id === milestone.id);
    if (tasks.length === 0) return { status: milestone.status, actualStart: milestone.actual_start_date, actualEnd: milestone.actual_end_date };

    // Actual start = earliest actual_start_date among tasks
    const startDates = tasks.map((t) => t.actual_start_date).filter(Boolean).sort();
    const actualStart = startDates[0] || null;

    // Actual end = latest actual_end_date, but ONLY if ALL tasks are in closed status
    const closedStatusIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
    const allClosed = tasks.every((t) => closedStatusIds.includes(t.status_id));
    const endDates = tasks.map((t) => t.actual_end_date).filter(Boolean).sort();
    const actualEnd = allClosed && endDates.length === tasks.length ? endDates[endDates.length - 1] || null : null;

    // Status logic
    let status = 'yet_to_initiate';
    if (milestone.status === 'closed') status = 'closed'; // Manual override
    else if (actualStart && actualEnd) status = 'done';
    else if (actualStart && !actualEnd) status = 'wip';

    return { status, actualStart, actualEnd };
  }

  async function handleCreate() {
    if (!nf.description?.trim() || !nf.project_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Project and Description are required' });
      return;
    }
    const { error } = await supabase.from('milestones').insert({
      project_id: nf.project_id,
      description: nf.description.trim(),
      planned_start_date: nf.planned_start_date || null,
      planned_end_date: nf.planned_end_date || null,
      created_by: user!.id,
    });
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    queryClient.invalidateQueries({ queryKey: ['milestones'] });
    setAdding(false); setNf({});
    toast({ title: 'Milestone created' });
  }

  async function updateField(id: string, field: string, value: any) {
    await supabase.from('milestones').update({ [field]: value || null, updated_at: new Date().toISOString() }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['milestones'] });
  }

  async function closeManually(id: string) {
    await supabase.from('milestones').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['milestones'] });
    toast({ title: 'Milestone closed' });
  }

  async function deleteMilestone(id: string) {
    if (!confirm('Delete this milestone permanently? Tasks linked to it will be unlinked.')) return;
    // Unlink tasks first
    await supabase.from('tasks').update({ milestone_id: null }).eq('milestone_id', id);
    await supabase.from('milestones').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['milestones'] });
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    toast({ title: 'Milestone deleted' });
  }

  // Filter milestones
  const visibleProjects = userProjectIds ? projects.filter((p) => userProjectIds.includes(p.id)) : projects;
  const msFilterFields = [
    { key: 'project_id', label: 'Project', type: 'select' as const, options: visibleProjects.map((p) => ({ value: p.id, label: p.name })) },
    { key: 'status', label: 'Status', type: 'select' as const, options: [{ value: 'yet_to_initiate', label: 'Yet to Initiate' }, { value: 'wip', label: 'WIP' }, { value: 'done', label: 'Done' }, { value: 'closed', label: 'Closed' }] },
    { key: 'due_date', label: 'Due Date', type: 'date' as const },
  ];

  function applyMsFilters(list: any[]): any[] {
    if (filterConditions.length === 0) return list;
    return list.filter((ms) => {
      let result = true;
      for (let i = 0; i < filterConditions.length; i++) {
        const cond = filterConditions[i];
        let match = true;
        if (cond.values.length === 0 || (cond.values.length === 1 && !cond.values[0])) { match = true; }
        else if (cond.field === 'due_date') {
          const d = ms.planned_end_date;
          if (!d) match = false;
          else {
            const today = new Date(); today.setHours(0,0,0,0);
            const preset = cond.values[0];
            if (preset === 'today') match = d === today.toISOString().split('T')[0];
            else if (preset === 'this_week') { const s = new Date(today); s.setDate(s.getDate()-s.getDay()); const e = new Date(s); e.setDate(e.getDate()+6); match = d >= s.toISOString().split('T')[0] && d <= e.toISOString().split('T')[0]; }
            else if (preset === 'this_month') match = d.startsWith(today.toISOString().slice(0,7));
            else if (preset === 'custom') { if (cond.values[1] && d < cond.values[1]) match = false; if (cond.values[2] && d > cond.values[2]) match = false; }
            else match = true;
          }
        } else {
          const val = ms[cond.field];
          if (!val) match = false;
          else match = cond.values.includes(val);
        }
        if (i === 0) result = match;
        else if (cond.connector === 'AND') result = result && match;
        else result = result || match;
      }
      return result;
    });
  }

  const filteredMilestones = applyMsFilters(userProjectIds ? milestones.filter((ms) => userProjectIds.includes(ms.project_id)) : milestones);

  return (
    <div className="space-y-3">
      {/* Header + Filter + Add */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <Button size="sm" className="h-8 text-xs font-medium" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Milestone
          </Button>
        )}
        <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3 w-3 mr-1" /> Filter {filterConditions.length > 0 && `(${filterConditions.length})`}
        </Button>
        <Badge variant="secondary" className="text-[10px] ml-auto">{filteredMilestones.length} milestones</Badge>
      </div>

      {/* Nested filters */}
      {showFilters && <NestedFilterBuilder fields={msFilterFields} conditions={filterConditions} onChange={setFilterConditions} />}

      <div className="border rounded-lg overflow-x-auto bg-white dark:bg-card shadow-sm">
        <table className="w-full text-[10px] min-w-[900px]">
          <thead>
            <tr className="bg-muted/60 border-b font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2 px-2 text-left w-20">MS #</th>
              <th className="py-2 px-2 text-left w-24">Project</th>
              <th className="py-2 px-2 text-left min-w-[200px]">Description</th>
              <th className="py-2 px-2 text-left w-24">Plan Start</th>
              <th className="py-2 px-2 text-left w-24">Plan End</th>
              <th className="py-2 px-2 text-left w-24">Act. Start</th>
              <th className="py-2 px-2 text-left w-24">Act. End</th>
              <th className="py-2 px-2 text-left w-16">Tasks</th>
              <th className="py-2 px-2 text-left w-16">%</th>
              <th className="py-2 px-2 text-left w-24">Status</th>
              <th className="py-2 px-2 text-left w-16"></th>
            </tr>
          </thead>
          <tbody>
            {/* New milestone row */}
            {adding && (
              <tr className="border-b bg-primary/5">
                <td className="py-1.5 px-2 text-[9px] italic text-muted-foreground">New</td>
                <td className="py-1.5 px-1"><select value={nf.project_id || ''} onChange={(e) => setNf({ ...nf, project_id: e.target.value })} className="h-6 text-[9px] w-full bg-transparent border-0 outline-none"><option value="">Project *</option>{visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td className="py-1.5 px-1"><input value={nf.description || ''} onChange={(e) => setNf({ ...nf, description: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }} placeholder="Description *" className="w-full h-6 text-[10px] bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary/30 rounded px-1" autoFocus /></td>
                <td className="py-1.5 px-1"><input type="date" value={nf.planned_start_date || ''} onChange={(e) => setNf({ ...nf, planned_start_date: e.target.value })} className="h-6 text-[9px] w-full bg-transparent border-0 outline-none" /></td>
                <td className="py-1.5 px-1"><input type="date" value={nf.planned_end_date || ''} onChange={(e) => setNf({ ...nf, planned_end_date: e.target.value })} className="h-6 text-[9px] w-full bg-transparent border-0 outline-none" /></td>
                <td className="py-1.5 px-2 text-[9px] italic text-muted-foreground">Auto</td>
                <td className="py-1.5 px-2 text-[9px] italic text-muted-foreground">Auto</td>
                <td className="py-1.5 px-2">-</td>
                <td className="py-1.5 px-2 text-[9px]">-</td>
                <td className="py-1.5 px-1"><div className="flex gap-0.5"><Button size="sm" className="h-5 text-[8px] px-1.5" onClick={handleCreate}>Save</Button><Button size="sm" variant="ghost" className="h-5 text-[8px] px-1" onClick={() => { setAdding(false); setNf({}); }}>✕</Button></div></td>
              </tr>
            )}

            {/* Milestone rows */}
            {filteredMilestones.map((ms) => {
              const computed = computeStatus(ms);
              const taskCount = allTasks.filter((t) => (t as any).milestone_id === ms.id).length;
              const msTasks = allTasks.filter((t) => (t as any).milestone_id === ms.id);
              const completionPct = msTasks.length > 0 ? Math.round(msTasks.reduce((sum, t) => { const s = statuses.find((st) => st.id === t.status_id); return sum + ((s as any)?.completion_weight ?? 0); }, 0) / msTasks.length * 100) : 0;
              const projName = projects.find((p) => p.id === ms.project_id)?.name || '';
              return (
                <tr key={ms.id} className="border-b hover:bg-accent/20">
                  <td className="py-1.5 px-2 font-mono text-[9px] text-muted-foreground">{ms.milestone_no}</td>
                  <td className="py-1.5 px-2 text-[9px]">{projName}</td>
                  <td className="py-1.5 px-1"><input defaultValue={ms.description} onBlur={(e) => { if (canEdit && e.target.value !== ms.description) updateField(ms.id, 'description', e.target.value); }} readOnly={!canEdit} className={`w-full text-[10px] font-medium bg-transparent border-0 outline-none rounded px-1 ${canEdit ? 'hover:bg-muted/50' : 'cursor-default'}`} /></td>
                  <td className="py-1.5 px-1"><input type="date" defaultValue={ms.planned_start_date || ''} onBlur={(e) => { if (canEdit && e.target.value !== (ms.planned_start_date || '')) updateField(ms.id, 'planned_start_date', e.target.value); }} readOnly={!canEdit} className={`text-[9px] bg-transparent border-0 outline-none w-full rounded ${canEdit ? 'hover:bg-muted/50' : 'cursor-default'}`} /></td>
                  <td className="py-1.5 px-1"><input type="date" defaultValue={ms.planned_end_date || ''} onBlur={(e) => { if (canEdit && e.target.value !== (ms.planned_end_date || '')) updateField(ms.id, 'planned_end_date', e.target.value); }} readOnly={!canEdit} className={`text-[9px] bg-transparent border-0 outline-none w-full rounded ${canEdit ? 'hover:bg-muted/50' : 'cursor-default'}`} /></td>
                  <td className="py-1.5 px-2 text-[9px] text-muted-foreground">{computed.actualStart ? formatDate(computed.actualStart) : '-'}</td>
                  <td className="py-1.5 px-2 text-[9px] text-muted-foreground">{computed.actualEnd ? formatDate(computed.actualEnd) : '-'}</td>
                  <td className="py-1.5 px-2 text-[9px]">{taskCount}</td>
                  <td className="py-1.5 px-2 text-center">{(() => { const color = completionPct >= 100 ? '#10b981' : completionPct >= 50 ? '#f59e0b' : '#6b7280'; return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{backgroundColor: color+'20', color}}>{completionPct}%</span>; })()}</td>
                  <td className="py-1.5 px-2"><Badge style={{ backgroundColor: STATUS_COLORS[computed.status], color: '#fff' }} className="text-[8px]">{STATUS_LABELS[computed.status]}</Badge></td>
                  <td className="py-1.5 px-1">
                    <div className="flex items-center gap-0.5">
                      {computed.status === 'done' && canClose && (
                        <Button size="sm" variant="outline" className="h-5 text-[8px] px-1.5" onClick={() => closeManually(ms.id)}>Close</Button>
                      )}
                      {canDelete && (
                        <button onClick={() => deleteMilestone(ms.id)} className="h-4 w-4 flex items-center justify-center rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 text-[8px]" title="Delete milestone">🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredMilestones.length === 0 && !adding && (
              <tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">No milestones. Click "Add Milestone" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
