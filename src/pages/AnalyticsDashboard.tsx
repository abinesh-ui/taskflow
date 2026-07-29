import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/use-access-control';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, getOverdueDays } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Users, FolderOpen, Target, Zap } from 'lucide-react';
import type { Task, MasterStatus, Project } from '@/types/database';

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const { isAdmin, userProjectIds } = useAccessControl();
  const [dateRange, setDateRange] = useState('30'); // days

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as Array<MasterStatus & { completion_weight?: number }>; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).order('position'); return (data || []) as Project[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('master_departments').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; project_id: string; color?: string }>; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*'); return (data || []) as Array<{ id: string; description: string; project_id: string }>; } });
  const { data: poaSubmissions = [] } = useQuery({ queryKey: ['poa_submissions', user?.id], queryFn: async () => { const { data } = await supabase.from('poa_submissions').select('*').eq('user_id', user!.id).order('submitted_date', { ascending: false }).limit(30); return (data || []) as Array<{ id: string; submitted_date: string; total_planned_mins: number; total_actual_mins: number }>; }, enabled: !!user });

  const today = new Date().toISOString().split('T')[0];
  const closedStatusIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
  const doneStatusIds = statuses.filter((s) => s.is_done).map((s) => s.id);

  // Access control: non-admin only sees assigned projects
  const visibleTasks = userProjectIds ? allTasks.filter((t) => userProjectIds.includes(t.project_id)) : allTasks;
  const visibleProjects = userProjectIds ? projects.filter((p) => userProjectIds.includes(p.id)) : projects;

  const topTasks = visibleTasks.filter((t) => !t.parent_id);
  const openTasks = topTasks.filter((t) => !closedStatusIds.includes(t.status_id));
  const overdueTasks = openTasks.filter((t) => t.planned_end_date && t.planned_end_date < today);
  const completedTasks = topTasks.filter((t) => doneStatusIds.includes(t.status_id));
  const totalCompletion = topTasks.length > 0 ? Math.round((completedTasks.length / topTasks.length) * 100) : 0;

  // Tasks by status
  const tasksByStatus = statuses.map((s) => ({ ...s, count: topTasks.filter((t) => t.status_id === s.id).length }));

  // Overdue aging
  const overdueAging = { light: 0, medium: 0, critical: 0 };
  overdueTasks.forEach((t) => {
    const days = getOverdueDays(t.planned_end_date, false);
    if (days <= 3) overdueAging.light++;
    else if (days <= 7) overdueAging.medium++;
    else overdueAging.critical++;
  });

  // Project health
  const projectHealth = visibleProjects.map((p) => {
    const pTasks = topTasks.filter((t) => t.project_id === p.id);
    const done = pTasks.filter((t) => closedStatusIds.includes(t.status_id)).length;
    const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
    const overdue = pTasks.filter((t) => !closedStatusIds.includes(t.status_id) && t.planned_end_date && t.planned_end_date < today).length;
    return { ...p, total: pTasks.length, done, pct, overdue };
  }).filter((p) => p.total > 0).sort((a, b) => b.total - a.total);

  // Team workload
  const teamWorkload = members.map((m) => {
    const mTasks = openTasks.filter((t) => t.assignee_id === m.id);
    const mOverdue = mTasks.filter((t) => t.planned_end_date && t.planned_end_date < today).length;
    return { ...m, openTasks: mTasks.length, overdue: mOverdue };
  }).filter((m) => m.openTasks > 0).sort((a, b) => b.openTasks - a.openTasks);

  // POA adherence
  const poaAdherence = poaSubmissions.length > 0 ? Math.round(poaSubmissions.reduce((s, p) => s + (p.total_planned_mins > 0 ? Math.min(p.total_actual_mins / p.total_planned_mins, 1) : 0), 0) / poaSubmissions.length * 100) : 0;

  // Alerts / Exceptions
  const alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string }> = [];
  if (overdueAging.critical > 0) alerts.push({ type: 'critical', message: `${overdueAging.critical} tasks overdue by 7+ days!` });
  if (overdueAging.medium > 0) alerts.push({ type: 'warning', message: `${overdueAging.medium} tasks overdue by 3-7 days` });
  overdueTasks.slice(0, 3).forEach((t) => alerts.push({ type: 'critical', message: `"${t.title}" overdue by ${getOverdueDays(t.planned_end_date, false)} days` }));
  if (poaAdherence < 70 && poaSubmissions.length > 3) alerts.push({ type: 'warning', message: `POA adherence is low (${poaAdherence}%). Plan better or log actuals.` });
  teamWorkload.filter((m) => m.openTasks > 10).forEach((m) => alerts.push({ type: 'warning', message: `${m.name} has ${m.openTasks} open tasks — possible overload` }));

  return (
    <div className="space-y-4">
      {/* Date range */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="h-8 text-xs border rounded px-2 bg-background">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Alerts / Exceptions */}
      {alerts.length > 0 && (
        <div className="space-y-1">
          {alerts.slice(0, 5).map((a, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${a.type === 'critical' ? 'bg-red-50 border-l-4 border-red-500 text-red-800' : a.type === 'warning' ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-800' : 'bg-blue-50 border-l-4 border-blue-500 text-blue-800'}`}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3.5 w-3.5" />Total Tasks</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{topTasks.length}</div><span className="text-[10px] text-muted-foreground">{allTasks.length - topTasks.length} subtasks</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" />Completed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{totalCompletion}%</div><span className="text-[10px] text-muted-foreground">{completedTasks.length} of {topTasks.length}</span></CardContent></Card>
        <Card className={overdueTasks.length > 0 ? 'border-red-200 bg-red-50/30' : ''}><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" />Overdue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{overdueTasks.length}</div><span className="text-[10px] text-muted-foreground">{overdueAging.critical} critical (7d+)</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-primary" />POA Score</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{poaAdherence}%</div><span className="text-[10px] text-muted-foreground">Plan vs Actual adherence</span></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks by Status</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {tasksByStatus.filter((s) => s.count > 0).map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs flex-1">{s.name}</span>
                <span className="text-xs font-bold">{s.count}</span>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.count / topTasks.length) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Project Health */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><FolderOpen className="h-4 w-4" />Project Health</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projectHealth.slice(0, 6).map((p) => (
              <div key={p.id} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{p.name}</span>
                  <div className="flex items-center gap-1">
                    {p.overdue > 0 && <Badge variant="destructive" className="text-[8px] h-4">{p.overdue} overdue</Badge>}
                    <span className="text-xs font-bold">{p.pct}%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, backgroundColor: p.pct >= 80 ? '#10b981' : p.pct >= 40 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Users className="h-4 w-4" />Team Workload</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {teamWorkload.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0" style={{ backgroundColor: m.color }}>{m.name.charAt(0)}</div>
                <span className="text-xs flex-1">{m.name}</span>
                <span className="text-xs">{m.openTasks} tasks</span>
                {m.overdue > 0 && <Badge variant="destructive" className="text-[8px] h-4">{m.overdue}</Badge>}
              </div>
            ))}
            {teamWorkload.length === 0 && <p className="text-xs text-muted-foreground">No assigned tasks</p>}
          </CardContent>
        </Card>

        {/* Overdue Aging */}
        <Card className={overdueAging.critical > 0 ? 'border-red-200' : ''}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Clock className="h-4 w-4" />Overdue Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded-lg bg-amber-50"><div className="text-lg font-bold text-amber-600">{overdueAging.light}</div><span className="text-[9px] text-amber-700">1-3 days</span></div>
              <div className="p-2 rounded-lg bg-orange-50"><div className="text-lg font-bold text-orange-600">{overdueAging.medium}</div><span className="text-[9px] text-orange-700">3-7 days</span></div>
              <div className="p-2 rounded-lg bg-red-50"><div className="text-lg font-bold text-red-600">{overdueAging.critical}</div><span className="text-[9px] text-red-700">7+ days</span></div>
            </div>
            {overdueTasks.length > 0 && (
              <div className="mt-3 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Most Overdue:</span>
                {overdueTasks.sort((a, b) => getOverdueDays(a.planned_end_date, false) - getOverdueDays(b.planned_end_date, false)).reverse().slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-1 text-[10px]">
                    <span className="text-red-600 font-bold">{getOverdueDays(t.planned_end_date, false)}d</span>
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* POA Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="h-4 w-4" />POA Trend (Last {poaSubmissions.length} days)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20">
              {poaSubmissions.slice(0, 14).reverse().map((p, i) => {
                const pct = p.total_planned_mins > 0 ? Math.min((p.total_actual_mins / p.total_planned_mins) * 100, 150) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${formatDate(p.submitted_date)}: ${p.total_actual_mins}/${p.total_planned_mins} mins`}>
                    <div className="w-full rounded-t" style={{ height: `${Math.max(pct * 0.6, 4)}px`, backgroundColor: pct >= 90 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
                    <span className="text-[7px] text-muted-foreground">{new Date(p.submitted_date).getDate()}</span>
                  </div>
                );
              })}
            </div>
            {poaSubmissions.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No POA data yet</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
