import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const { profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [projectsRes, tasksRes, statusesRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact' }).eq('is_live', true),
        supabase.from('tasks').select('id, status_id, planned_end_date'),
        supabase.from('master_statuses').select('id, is_closed, is_done'),
      ]);

      const statuses = statusesRes.data || [];
      const tasks = tasksRes.data || [];
      const closedStatusIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
      const doneStatusIds = statuses.filter((s) => s.is_done).map((s) => s.id);

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => doneStatusIds.includes(t.status_id)).length;
      const openTasks = tasks.filter((t) => !closedStatusIds.includes(t.status_id)).length;
      const today = new Date().toISOString().split('T')[0];
      const overdueTasks = tasks.filter(
        (t) => !closedStatusIds.includes(t.status_id) && t.planned_end_date && t.planned_end_date < today
      ).length;

      return {
        projects: projectsRes.count || 0,
        totalTasks,
        completedTasks,
        openTasks,
        overdueTasks,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0]}</h2>
        <p className="text-muted-foreground">Here's an overview of your workspace.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.projects ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openTasks ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedTasks ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.overdueTasks ?? '-'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Create a Project from the sidebar (click the + next to "Projects").</p>
          <p>2. Add Departments within that Project.</p>
          <p>3. Navigate to a Department and start creating Tasks.</p>
          <p>4. Use the view switcher (List, Board, Calendar) at the top of each department.</p>
          <p>5. Go to Settings to manage Master Data (Statuses, Priorities, Task Types, Categories).</p>
        </CardContent>
      </Card>
    </div>
  );
}
