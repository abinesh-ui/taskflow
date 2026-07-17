import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TaskDialog from '@/components/tasks/TaskDialog';
import { getPlannedMonthWeek, getOverdueDays } from '@/lib/utils';
import { exportTasksToCSV } from '@/lib/csv-export';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Download,
  List,
  LayoutGrid,
  Calendar,
  FolderOpen,
  Layers,
} from 'lucide-react';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskContext, setAddTaskContext] = useState<{ projectId: string; departmentId: string } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return (data || []) as Project[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position');
      return (data || []) as Department[];
    },
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').order('position');
      return (data || []) as Task[];
    },
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['master_statuses'],
    queryFn: async () => {
      const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position');
      return (data || []) as MasterStatus[];
    },
  });

  const { data: priorities = [] } = useQuery({
    queryKey: ['master_priorities'],
    queryFn: async () => {
      const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position');
      return (data || []) as MasterPriority[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['master_members'],
    queryFn: async () => {
      const { data } = await supabase.from('master_members').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color: string }>;
    },
  });

  // Filter tasks
  function getFilteredTasks(): Task[] {
    let filtered = allTasks.filter((t) => !t.parent_id); // Only top-level tasks
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') filtered = filtered.filter((t) => t.status_id === filterStatus);
    if (filterPriority !== 'all') filtered = filtered.filter((t) => t.priority_id === filterPriority);
    if (filterAssignee !== 'all') filtered = filtered.filter((t) => t.assignee_id === filterAssignee);
    return filtered;
  }

  const filteredTasks = getFilteredTasks();

  function getSubtasks(taskId: string): Task[] {
    return allTasks.filter((t) => t.parent_id === taskId);
  }

  function toggleProject(id: string) {
    const next = new Set(expandedProjects);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedProjects(next);
  }

  function toggleDept(id: string) {
    const next = new Set(expandedDepts);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedDepts(next);
  }

  function toggleStatus(key: string) {
    const next = new Set(expandedStatuses);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedStatuses(next);
  }

  function toggleTask(id: string) {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedTasks(next);
  }

  function getMemberName(id: string | null) {
    if (!id) return '-';
    const m = members.find((m) => m.id === id);
    return m?.name || '-';
  }

  // Expand all projects by default on first render
  React.useEffect(() => {
    if (projects.length > 0 && expandedProjects.size === 0) {
      setExpandedProjects(new Set(projects.map((p) => p.id)));
      setExpandedDepts(new Set(departments.map((d) => d.id)));
      setExpandedStatuses(new Set(
        departments.flatMap((d) => statuses.map((s) => `${d.id}-${s.id}`))
      ));
    }
  }, [projects, departments, statuses]);

  return (
    <div className="space-y-4">
      {/* Top actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold">All Tasks</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTasksToCSV(filteredTasks, { statuses, priorities, taskTypes: [], categories: [], users: members as any })}
          >
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddTask(true)}>
            <Plus className="h-4 w-4 mr-1" /> Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-48 text-sm"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {priorities.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Hierarchical List: Project → Department → Status → Task → Subtask */}
      <div className="border rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_2fr_100px_100px_100px_90px_70px_70px] gap-0 bg-muted/50 border-b px-3 py-2 text-xs font-medium text-muted-foreground hidden md:grid">
          <span>Task #</span>
          <span>Title</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Assignee</span>
          <span>Due Date</span>
          <span>Overdue</span>
          <span>Mon/Wk</span>
        </div>

        {projects.map((project) => {
          const projectDepts = departments.filter((d) => d.project_id === project.id);
          const projectTasks = filteredTasks.filter((t) => t.project_id === project.id);
          if (projectTasks.length === 0 && filterStatus !== 'all') return null;

          return (
            <div key={project.id}>
              {/* Project row */}
              <div
                className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b cursor-pointer hover:bg-muted/40"
                onClick={() => toggleProject(project.id)}
              >
                {expandedProjects.has(project.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{project.name}</span>
                <Badge variant="secondary" className="text-[10px] ml-2">{projectTasks.length} tasks</Badge>
              </div>

              {/* Departments under this project */}
              {expandedProjects.has(project.id) && projectDepts.map((dept) => {
                const deptTasks = projectTasks.filter((t) => t.department_id === dept.id);
                if (deptTasks.length === 0 && filterStatus !== 'all') return null;

                return (
                  <div key={dept.id}>
                    {/* Department row */}
                    <div
                      className="flex items-center gap-2 px-6 py-1.5 border-b cursor-pointer hover:bg-muted/30"
                      onClick={() => toggleDept(dept.id)}
                    >
                      {expandedDepts.has(dept.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (dept as any).color || '#6b7280' }} />
                      <span className="font-medium text-sm">{dept.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{deptTasks.length}</Badge>
                    </div>

                    {/* Statuses under this department */}
                    {expandedDepts.has(dept.id) && statuses.map((status) => {
                      const statusTasks = deptTasks.filter((t) => t.status_id === status.id);
                      if (statusTasks.length === 0) return null;
                      const statusKey = `${dept.id}-${status.id}`;

                      return (
                        <div key={statusKey}>
                          {/* Status row */}
                          <div
                            className="flex items-center gap-2 px-10 py-1 border-b cursor-pointer hover:bg-muted/20"
                            onClick={() => toggleStatus(statusKey)}
                          >
                            {expandedStatuses.has(statusKey) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                            <span className="text-xs font-medium">{status.name}</span>
                            <Badge variant="secondary" className="text-[9px]">{statusTasks.length}</Badge>
                          </div>

                          {/* Tasks under this status */}
                          {expandedStatuses.has(statusKey) && statusTasks.map((task) => {
                            const priority = priorities.find((p) => p.id === task.priority_id);
                            const overdue = getOverdueDays(task.planned_end_date, status.is_closed);
                            const monthWeek = getPlannedMonthWeek(task.planned_start_date);
                            const subtasks = getSubtasks(task.id);

                            return (
                              <React.Fragment key={task.id}>
                                {/* Task row */}
                                <div
                                  className="grid grid-cols-1 md:grid-cols-[1fr_2fr_100px_100px_100px_90px_70px_70px] gap-1 md:gap-0 px-3 md:px-14 py-2 border-b hover:bg-accent/30 cursor-pointer text-sm items-center"
                                  onClick={() => setEditingTask(task)}
                                >
                                  <div className="flex items-center gap-1">
                                    {subtasks.length > 0 && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                                        className="p-0.5 hover:bg-accent rounded"
                                      >
                                        {expandedTasks.has(task.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      </button>
                                    )}
                                    <span className="font-mono text-[10px] text-muted-foreground">{task.task_no}</span>
                                  </div>
                                  <span className="font-medium text-sm truncate">{task.title}</span>
                                  <div>
                                    <Badge className="text-[9px]" style={{ backgroundColor: status.color, color: '#fff' }}>
                                      {status.name}
                                    </Badge>
                                  </div>
                                  <div>
                                    {priority && (
                                      <span className="flex items-center gap-1 text-xs">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color }} />
                                        {priority.name}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs">{getMemberName(task.assignee_id)}</span>
                                  <span className={`text-xs ${overdue > 0 ? 'text-red-600' : ''}`}>{task.planned_end_date || '-'}</span>
                                  <span className={`text-xs ${overdue > 0 ? 'text-red-600 font-bold' : ''}`}>{overdue > 0 ? `${overdue}d` : '-'}</span>
                                  <span className="text-xs text-muted-foreground">{monthWeek || '-'}</span>
                                </div>

                                {/* Subtasks */}
                                {expandedTasks.has(task.id) && subtasks.map((sub) => {
                                  const subStatus = statuses.find((s) => s.id === sub.status_id);
                                  const subPriority = priorities.find((p) => p.id === sub.priority_id);
                                  const subOverdue = getOverdueDays(sub.planned_end_date, subStatus?.is_closed ?? false);

                                  return (
                                    <div
                                      key={sub.id}
                                      className="grid grid-cols-1 md:grid-cols-[1fr_2fr_100px_100px_100px_90px_70px_70px] gap-1 md:gap-0 px-3 md:px-20 py-1.5 border-b hover:bg-accent/20 cursor-pointer text-xs items-center bg-muted/10"
                                      onClick={() => setEditingTask(sub)}
                                    >
                                      <span className="font-mono text-[10px] text-muted-foreground">{sub.task_no}</span>
                                      <span className="text-xs truncate">{sub.title}</span>
                                      <div>
                                        {subStatus && (
                                          <Badge className="text-[8px]" style={{ backgroundColor: subStatus.color, color: '#fff' }}>
                                            {subStatus.name}
                                          </Badge>
                                        )}
                                      </div>
                                      <div>
                                        {subPriority && (
                                          <span className="flex items-center gap-1 text-[10px]">
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: subPriority.color }} />
                                            {subPriority.name}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px]">{getMemberName(sub.assignee_id)}</span>
                                      <span className={`text-[10px] ${subOverdue > 0 ? 'text-red-600' : ''}`}>{sub.planned_end_date || '-'}</span>
                                      <span className={`text-[10px] ${subOverdue > 0 ? 'text-red-600 font-bold' : ''}`}>{subOverdue > 0 ? `${subOverdue}d` : '-'}</span>
                                      <span className="text-[10px] text-muted-foreground">{getPlannedMonthWeek(sub.planned_start_date) || '-'}</span>
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No tasks found. Create a project and department first, then add tasks.</p>
          </div>
        )}
      </div>

      {/* Task Dialog */}
      {(showAddTask || editingTask) && (
        <TaskDialog
          open={showAddTask || !!editingTask}
          onOpenChange={(open) => {
            if (!open) { setShowAddTask(false); setEditingTask(null); setAddTaskContext(null); }
          }}
          task={editingTask}
          departmentId={addTaskContext?.departmentId || editingTask?.department_id || departments[0]?.id || ''}
          projectId={addTaskContext?.projectId || editingTask?.project_id || projects[0]?.id || ''}
        />
      )}
    </div>
  );
}
