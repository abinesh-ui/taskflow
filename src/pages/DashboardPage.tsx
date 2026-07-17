import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
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
  FolderOpen,
  X,
} from 'lucide-react';
import type { Task, MasterStatus, MasterPriority, Project, Department } from '@/types/database';

type ViewType = 'list' | 'board';

export default function DashboardPage() {
  const [view, setView] = useState<ViewType>('list');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Multi-select filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterTaskTypes, setFilterTaskTypes] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

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

  const { data: taskTypes = [] } = useQuery({
    queryKey: ['master_task_types'],
    queryFn: async () => {
      const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color?: string }>;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['master_task_categories'],
    queryFn: async () => {
      const { data } = await supabase.from('master_task_categories').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color?: string }>;
    },
  });

  // Filter logic
  function getFilteredTasks(): Task[] {
    let filtered = allTasks.filter((t) => !t.parent_id);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q));
    }
    if (filterStatuses.length > 0) filtered = filtered.filter((t) => filterStatuses.includes(t.status_id));
    if (filterPriorities.length > 0) filtered = filtered.filter((t) => t.priority_id && filterPriorities.includes(t.priority_id));
    if (filterAssignees.length > 0) filtered = filtered.filter((t) => t.assignee_id && filterAssignees.includes(t.assignee_id));
    if (filterTaskTypes.length > 0) filtered = filtered.filter((t) => t.task_type_id && filterTaskTypes.includes(t.task_type_id));
    if (filterCategories.length > 0) filtered = filtered.filter((t) => t.category_id && filterCategories.includes(t.category_id));
    if (filterProjects.length > 0) filtered = filtered.filter((t) => filterProjects.includes(t.project_id));
    if (filterDateFrom) filtered = filtered.filter((t) => t.planned_end_date && t.planned_end_date >= filterDateFrom);
    if (filterDateTo) filtered = filtered.filter((t) => t.planned_end_date && t.planned_end_date <= filterDateTo);
    if (overdueOnly) {
      const today = new Date().toISOString().split('T')[0];
      const closedIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
      filtered = filtered.filter((t) => !closedIds.includes(t.status_id) && t.planned_end_date && t.planned_end_date < today);
    }
    return filtered;
  }

  const filteredTasks = getFilteredTasks();
  const hasAnyFilter = searchQuery || filterStatuses.length || filterPriorities.length || filterAssignees.length || filterTaskTypes.length || filterCategories.length || filterProjects.length || filterDateFrom || filterDateTo || overdueOnly;

  function clearAllFilters() {
    setSearchQuery('');
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterAssignees([]);
    setFilterTaskTypes([]);
    setFilterCategories([]);
    setFilterProjects([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setOverdueOnly(false);
  }

  function getSubtasks(taskId: string): Task[] {
    return allTasks.filter((t) => t.parent_id === taskId);
  }

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function getMemberName(id: string | null) {
    if (!id) return '-';
    return members.find((m) => m.id === id)?.name || '-';
  }

  // Auto-expand everything on first load
  useEffect(() => {
    if (projects.length > 0 && expandedProjects.size === 0) {
      setExpandedProjects(new Set(projects.map((p) => p.id)));
      setExpandedDepts(new Set(departments.map((d) => d.id)));
      setExpandedStatuses(new Set(departments.flatMap((d) => statuses.map((s) => `${d.id}-${s.id}`))));
    }
  }, [projects, departments, statuses]);

  return (
    <div className="space-y-4">
      {/* Top actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('list')}>
              <List className="h-4 w-4 mr-1" /> List
            </Button>
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('board')}>
              <LayoutGrid className="h-4 w-4 mr-1" /> Board
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportTasksToCSV(filteredTasks, { statuses, priorities, taskTypes: taskTypes as any, categories: categories as any, users: members as any })}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddTask(true)}>
            <Plus className="h-4 w-4 mr-1" /> Task
          </Button>
        </div>
      </div>

      {/* Multi-select filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-40 text-xs"
        />
        <MultiSelect
          options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
          selected={filterStatuses}
          onChange={setFilterStatuses}
          placeholder="Status"
          className="w-32"
        />
        <MultiSelect
          options={priorities.map((p) => ({ value: p.id, label: p.name, color: p.color }))}
          selected={filterPriorities}
          onChange={setFilterPriorities}
          placeholder="Priority"
          className="w-32"
        />
        <MultiSelect
          options={members.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
          selected={filterAssignees}
          onChange={setFilterAssignees}
          placeholder="Assignee"
          className="w-32"
        />
        <MultiSelect
          options={taskTypes.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
          selected={filterTaskTypes}
          onChange={setFilterTaskTypes}
          placeholder="Task Type"
          className="w-32"
        />
        <MultiSelect
          options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
          selected={filterCategories}
          onChange={setFilterCategories}
          placeholder="Category"
          className="w-32"
        />
        <MultiSelect
          options={projects.map((p) => ({ value: p.id, label: p.name, color: (p as any).color }))}
          selected={filterProjects}
          onChange={setFilterProjects}
          placeholder="Project"
          className="w-32"
        />
        <div className="flex items-center gap-1">
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-xs w-32" title="Due from" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-xs w-32" title="Due to" />
        </div>
        <Button
          variant={overdueOnly ? 'destructive' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setOverdueOnly(!overdueOnly)}
        >
          Overdue
        </Button>
        {hasAnyFilter && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAllFilters}>
            <X className="h-3 w-3 mr-1" /> Clear all
          </Button>
        )}
      </div>

      {/* Views */}
      {view === 'list' && (
        <HierarchicalListView
          filteredTasks={filteredTasks}
          allTasks={allTasks}
          projects={projects}
          departments={departments}
          statuses={statuses}
          priorities={priorities}
          members={members}
          expandedProjects={expandedProjects}
          setExpandedProjects={setExpandedProjects}
          expandedDepts={expandedDepts}
          setExpandedDepts={setExpandedDepts}
          expandedStatuses={expandedStatuses}
          setExpandedStatuses={setExpandedStatuses}
          expandedTasks={expandedTasks}
          setExpandedTasks={setExpandedTasks}
          onEditTask={setEditingTask}
        />
      )}
      {view === 'board' && (
        <BoardView
          filteredTasks={filteredTasks}
          statuses={statuses}
          priorities={priorities}
          members={members}
          onEditTask={setEditingTask}
        />
      )}

      {/* Task Dialog */}
      {(showAddTask || editingTask) && (
        <TaskDialog
          open={showAddTask || !!editingTask}
          onOpenChange={(open) => { if (!open) { setShowAddTask(false); setEditingTask(null); } }}
          task={editingTask}
          departmentId={editingTask?.department_id || departments[0]?.id || ''}
          projectId={editingTask?.project_id || projects[0]?.id || ''}
        />
      )}
    </div>
  );
}

// ============================================================
// HIERARCHICAL LIST VIEW
// ============================================================
function HierarchicalListView({
  filteredTasks, allTasks, projects, departments, statuses, priorities, members,
  expandedProjects, setExpandedProjects, expandedDepts, setExpandedDepts,
  expandedStatuses, setExpandedStatuses, expandedTasks, setExpandedTasks, onEditTask,
}: {
  filteredTasks: Task[]; allTasks: Task[]; projects: Project[]; departments: Department[];
  statuses: MasterStatus[]; priorities: MasterPriority[]; members: Array<{ id: string; name: string; color: string }>;
  expandedProjects: Set<string>; setExpandedProjects: (s: Set<string>) => void;
  expandedDepts: Set<string>; setExpandedDepts: (s: Set<string>) => void;
  expandedStatuses: Set<string>; setExpandedStatuses: (s: Set<string>) => void;
  expandedTasks: Set<string>; setExpandedTasks: (s: Set<string>) => void;
  onEditTask: (t: Task) => void;
}) {
  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function getMemberName(id: string | null) {
    if (!id) return '-';
    return members.find((m) => m.id === id)?.name || '-';
  }

  function getSubtasks(taskId: string) {
    return allTasks.filter((t) => t.parent_id === taskId);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="hidden md:grid grid-cols-[1fr_2fr_90px_90px_90px_85px_60px_65px] gap-0 bg-muted/50 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Task #</span><span>Title</span><span>Status</span><span>Priority</span><span>Assignee</span><span>Due Date</span><span>Overdue</span><span>Mon/Wk</span>
      </div>

      {projects.map((project) => {
        const projectDepts = departments.filter((d) => d.project_id === project.id);
        const projectTasks = filteredTasks.filter((t) => t.project_id === project.id);
        if (projectTasks.length === 0) return null;

        return (
          <div key={project.id}>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b cursor-pointer hover:bg-muted/40" onClick={() => toggleSet(expandedProjects, setExpandedProjects, project.id)}>
              {expandedProjects.has(project.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{project.name}</span>
              <Badge variant="secondary" className="text-[10px] ml-1">{projectTasks.length}</Badge>
            </div>

            {expandedProjects.has(project.id) && projectDepts.map((dept) => {
              const deptTasks = projectTasks.filter((t) => t.department_id === dept.id);
              if (deptTasks.length === 0) return null;

              return (
                <div key={dept.id}>
                  <div className="flex items-center gap-2 px-6 py-1.5 border-b cursor-pointer hover:bg-muted/30" onClick={() => toggleSet(expandedDepts, setExpandedDepts, dept.id)}>
                    {expandedDepts.has(dept.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (dept as any).color || '#6b7280' }} />
                    <span className="font-medium text-sm">{dept.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{deptTasks.length}</Badge>
                  </div>

                  {expandedDepts.has(dept.id) && statuses.map((status) => {
                    const statusTasks = deptTasks.filter((t) => t.status_id === status.id);
                    if (statusTasks.length === 0) return null;
                    const key = `${dept.id}-${status.id}`;

                    return (
                      <div key={key}>
                        <div className="flex items-center gap-2 px-10 py-1 border-b cursor-pointer hover:bg-muted/20" onClick={() => toggleSet(expandedStatuses, setExpandedStatuses, key)}>
                          {expandedStatuses.has(key) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                          <span className="text-xs font-medium">{status.name}</span>
                          <Badge variant="secondary" className="text-[9px]">{statusTasks.length}</Badge>
                        </div>

                        {expandedStatuses.has(key) && statusTasks.map((task) => {
                          const priority = priorities.find((p) => p.id === task.priority_id);
                          const overdue = getOverdueDays(task.planned_end_date, status.is_closed);
                          const monthWeek = getPlannedMonthWeek(task.planned_start_date);
                          const subtasks = getSubtasks(task.id);

                          return (
                            <React.Fragment key={task.id}>
                              <div
                                className="grid grid-cols-1 md:grid-cols-[1fr_2fr_90px_90px_90px_85px_60px_65px] gap-1 md:gap-0 px-3 md:px-14 py-2 border-b hover:bg-accent/30 cursor-pointer text-sm items-center"
                                onClick={() => onEditTask(task)}
                              >
                                <div className="flex items-center gap-1">
                                  {subtasks.length > 0 && (
                                    <button onClick={(e) => { e.stopPropagation(); toggleSet(expandedTasks, setExpandedTasks, task.id); }} className="p-0.5 hover:bg-accent rounded">
                                      {expandedTasks.has(task.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </button>
                                  )}
                                  <span className="font-mono text-[10px] text-muted-foreground">{task.task_no}</span>
                                </div>
                                <span className="font-medium text-sm truncate">{task.title}</span>
                                <Badge className="text-[9px] w-fit" style={{ backgroundColor: status.color, color: '#fff' }}>{status.name}</Badge>
                                <div>{priority && <span className="flex items-center gap-1 text-xs"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color }} />{priority.name}</span>}</div>
                                <span className="text-xs">{getMemberName(task.assignee_id)}</span>
                                <span className={`text-xs ${overdue > 0 ? 'text-red-600' : ''}`}>{task.planned_end_date || '-'}</span>
                                <span className={`text-xs ${overdue > 0 ? 'text-red-600 font-bold' : ''}`}>{overdue > 0 ? `${overdue}d` : '-'}</span>
                                <span className="text-xs text-muted-foreground">{monthWeek || '-'}</span>
                              </div>
                              {expandedTasks.has(task.id) && subtasks.map((sub) => {
                                const subStatus = statuses.find((s) => s.id === sub.status_id);
                                const subPri = priorities.find((p) => p.id === sub.priority_id);
                                const subOver = getOverdueDays(sub.planned_end_date, subStatus?.is_closed ?? false);
                                return (
                                  <div key={sub.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_90px_90px_90px_85px_60px_65px] gap-1 md:gap-0 px-3 md:px-20 py-1.5 border-b hover:bg-accent/20 cursor-pointer text-xs items-center bg-muted/10" onClick={() => onEditTask(sub)}>
                                    <span className="font-mono text-[10px] text-muted-foreground">{sub.task_no}</span>
                                    <span className="text-xs truncate">{sub.title}</span>
                                    <div>{subStatus && <Badge className="text-[8px] w-fit" style={{ backgroundColor: subStatus.color, color: '#fff' }}>{subStatus.name}</Badge>}</div>
                                    <div>{subPri && <span className="flex items-center gap-1 text-[10px]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: subPri.color }} />{subPri.name}</span>}</div>
                                    <span className="text-[10px]">{getMemberName(sub.assignee_id)}</span>
                                    <span className={`text-[10px] ${subOver > 0 ? 'text-red-600' : ''}`}>{sub.planned_end_date || '-'}</span>
                                    <span className={`text-[10px] ${subOver > 0 ? 'text-red-600 font-bold' : ''}`}>{subOver > 0 ? `${subOver}d` : '-'}</span>
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
        <div className="text-center py-12 text-muted-foreground text-sm">No tasks found.</div>
      )}
    </div>
  );
}

// ============================================================
// BOARD / KANBAN VIEW
// ============================================================
function BoardView({
  filteredTasks, statuses, priorities, members, onEditTask,
}: {
  filteredTasks: Task[]; statuses: MasterStatus[]; priorities: MasterPriority[];
  members: Array<{ id: string; name: string; color: string }>; onEditTask: (t: Task) => void;
}) {
  function getMemberName(id: string | null) {
    if (!id) return '';
    return members.find((m) => m.id === id)?.name || '';
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statuses.map((status) => {
        const statusTasks = filteredTasks.filter((t) => t.status_id === status.id);
        return (
          <div key={status.id} className="flex flex-col w-72 min-w-[280px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
              <span className="font-medium text-sm">{status.name}</span>
              <Badge variant="secondary" className="text-[10px]">{statusTasks.length}</Badge>
            </div>
            <div className="flex-1 space-y-2 p-2 bg-muted/30 rounded-lg min-h-[200px]">
              {statusTasks.map((task) => {
                const priority = priorities.find((p) => p.id === task.priority_id);
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = !status.is_closed && task.planned_end_date && task.planned_end_date < today;
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-md border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onEditTask(task)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[10px] text-muted-foreground font-mono">{task.task_no}</span>
                      {priority && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: priority.color }} />}
                    </div>
                    <p className="text-sm font-medium leading-tight mb-2">{task.title}</p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{getMemberName(task.assignee_id)}</span>
                      {task.planned_end_date && (
                        <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                          {task.planned_end_date}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {statusTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
