import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAccessControl } from '@/hooks/use-access-control';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { formatDate, getOverdueDays } from '@/lib/utils';
import { Archive, ChevronDown, ChevronRight, RotateCcw, FolderOpen } from 'lucide-react';
import TaskListView from '@/components/tasks/TaskListView';
import TaskDialog from '@/components/tasks/TaskDialog';
import type { Task, MasterStatus, MasterPriority, Project, Department, Profile } from '@/types/database';

/**
 * Dedicated screen for archived ("not live") projects. This is the ONLY place
 * in the app where a non-live project's tasks/subtasks/milestones are shown —
 * every other screen (Dashboard, All Tasks, Pending Tasks, Milestones, My
 * Tasks, mobile views, etc.) excludes them. Admins can reactivate a project
 * here, which immediately restores it to every normal screen.
 */
export default function ClosedProjectsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, userProjectIds } = useAccessControl();
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sortField, setSortField] = useState('planned_end_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Deliberately unfiltered-by-is_live — this screen's entire purpose is to
  // show the archived projects every other screen excludes.
  const { data: closedProjects = [] } = useQuery({
    queryKey: ['projects-closed'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', false).order('name');
      return (data || []) as Array<Project & { macro_project_id?: string }>;
    },
  });
  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position'); return (data || []) as MasterStatus[]; } });
  const { data: priorities = [] } = useQuery({ queryKey: ['master_priorities'], queryFn: async () => { const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position'); return (data || []) as MasterPriority[]; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true).order('position'); return (data || []) as Profile[]; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: async () => { const { data } = await supabase.from('milestones').select('*'); return (data || []) as Array<{ id: string; milestone_no?: string; project_id: string; description: string; status: string }>; } });

  // Non-admins only see archived projects they were assigned to (fail-closed,
  // same rule as everywhere else). Admins see every archived project.
  const visibleClosedProjects = userProjectIds ? closedProjects.filter((p) => userProjectIds.includes(p.id)) : closedProjects;

  function getProjectTasks(projectId: string) {
    const tasks = allTasks.filter((t) => t.project_id === projectId && !t.parent_id);
    return [...tasks].sort((a, b) => {
      const av = (a as any)[sortField] ?? '';
      const bv = (b as any)[sortField] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  function getProjectMilestones(projectId: string) { return milestones.filter((m) => m.project_id === projectId); }
  function getProjectDepartments(projectId: string) { return departments.filter((d) => d.project_id === projectId); }

  function handleSort(field: string) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  async function reactivateProject(project: Project & { macro_project_id?: string }) {
    if (!confirm(`Make "${project.name}" live again? Its tasks, subtasks, and milestones will immediately reappear on all normal screens.`)) return;
    // Restore the project's macro grouping from before it was archived, if we
    // have one on record (set when it was archived), falling back to leaving
    // it under Closed Projects if we don't (admin can reassign in Settings).
    const { data: fresh } = await supabase.from('projects').select('pre_archive_macro_project_id').eq('id', project.id).maybeSingle();
    const restoreMacroId = (fresh as any)?.pre_archive_macro_project_id || null;
    const update: Record<string, unknown> = { is_live: true };
    if (restoreMacroId) { update.macro_project_id = restoreMacroId; update.pre_archive_macro_project_id = null; }
    const { error } = await supabase.from('projects').update(update).eq('id', project.id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    queryClient.invalidateQueries({ queryKey: ['projects-closed'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['projects-live'] });
    queryClient.invalidateQueries({ queryKey: ['projects-all-for-macro'] });
    toast({ title: 'Project reactivated', description: `${project.name} is live again.` });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Archive className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-bold">Closed Projects</h2>
        <Badge variant="secondary" className="text-[10px]">{visibleClosedProjects.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Projects marked "not live" land here. Their tasks, subtasks, and milestones are hidden from every other screen until an admin makes the project live again.
      </p>

      {visibleClosedProjects.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No closed projects.</CardContent></Card>
      )}

      <div className="space-y-3">
        {visibleClosedProjects.map((project) => {
          const isExpanded = expandedProjectId === project.id;
          const tasks = getProjectTasks(project.id);
          const projMilestones = getProjectMilestones(project.id);
          const overdueCount = tasks.filter((t) => { const s = statuses.find((st) => st.id === t.status_id); return getOverdueDays(t.planned_end_date, s?.is_closed ?? false) > 0; }).length;
          return (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{project.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Badge>
                    {overdueCount > 0 && <Badge variant="destructive" className="text-[10px]">{overdueCount} overdue</Badge>}
                    {projMilestones.length > 0 && <Badge variant="outline" className="text-[10px]">{projMilestones.length} milestone{projMilestones.length !== 1 ? 's' : ''}</Badge>}
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => reactivateProject(project)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Make Live Again
                    </Button>
                  )}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-4">
                  {projMilestones.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Milestones</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {projMilestones.map((m) => (
                          <Badge key={m.id} variant="outline" className="text-[10px]">
                            {m.milestone_no ? `${m.milestone_no}: ` : ''}{m.description}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <TaskListView
                    tasks={tasks}
                    statuses={statuses}
                    priorities={priorities}
                    users={members}
                    onEdit={(task) => setEditingTask(task)}
                    onSort={handleSort}
                    sortField={sortField}
                    sortDir={sortDir}
                    departmentId={getProjectDepartments(project.id)[0]?.id || ''}
                    projectId={project.id}
                  />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {editingTask && (
        <TaskDialog
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          task={editingTask}
          departmentId={editingTask.department_id}
          projectId={editingTask.project_id}
        />
      )}
    </div>
  );
}
