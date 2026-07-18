import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import TaskDialog from '@/components/tasks/TaskDialog';
import { getPlannedMonthWeek, getOverdueDays, formatDate } from '@/lib/utils';
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
  const [subtaskParent, setSubtaskParent] = useState<Task | null>(null);

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

  const { data: macroProjects = [] } = useQuery({
    queryKey: ['master_macro_projects'],
    queryFn: async () => {
      const { data } = await supabase.from('master_macro_projects').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color: string }>;
    },
  });

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
    <div className="space-y-5">
      {/* Top actions - professional header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white dark:bg-card rounded-xl p-1 shadow-sm border">
            <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" className="h-9 rounded-lg font-medium" onClick={() => setView('list')}>
              <List className="h-4 w-4 mr-1.5" /> List
            </Button>
            <Button variant={view === 'board' ? 'default' : 'ghost'} size="sm" className="h-9 rounded-lg font-medium" onClick={() => setView('board')}>
              <LayoutGrid className="h-4 w-4 mr-1.5" /> Board
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-lg shadow-sm" onClick={() => exportTasksToCSV(filteredTasks, { statuses, priorities, taskTypes: taskTypes as any, categories: categories as any, users: members as any })}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
          <Button size="sm" className="h-9 rounded-lg shadow-sm font-medium" onClick={() => setShowAddTask(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Task
          </Button>
        </div>
      </div>

      {/* Multi-select filters - clean card */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-card rounded-xl border shadow-sm">
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
          macroProjects={macroProjects}
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
          onAddSubtask={(task) => { setSubtaskParent(task); }}
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

      {/* Subtask Dialog */}
      {subtaskParent && (
        <TaskDialog
          open={!!subtaskParent}
          onOpenChange={(open) => { if (!open) setSubtaskParent(null); }}
          task={null}
          departmentId={subtaskParent.department_id}
          projectId={subtaskParent.project_id}
          parentId={subtaskParent.id}
        />
      )}
    </div>
  );
}

// ============================================================
// HIERARCHICAL LIST VIEW
// ============================================================
function HierarchicalListView({
  filteredTasks, allTasks, macroProjects, projects, departments, statuses, priorities, members,
  expandedProjects, setExpandedProjects, expandedDepts, setExpandedDepts,
  expandedStatuses, setExpandedStatuses, expandedTasks, setExpandedTasks, onEditTask, onAddSubtask,
}: {
  filteredTasks: Task[]; allTasks: Task[];
  macroProjects: Array<{ id: string; name: string; color: string }>;
  projects: Project[]; departments: Department[];
  statuses: MasterStatus[]; priorities: MasterPriority[]; members: Array<{ id: string; name: string; color: string }>;
  expandedProjects: Set<string>; setExpandedProjects: (s: Set<string>) => void;
  expandedDepts: Set<string>; setExpandedDepts: (s: Set<string>) => void;
  expandedStatuses: Set<string>; setExpandedStatuses: (s: Set<string>) => void;
  expandedTasks: Set<string>; setExpandedTasks: (s: Set<string>) => void;
  onEditTask: (t: Task) => void;
  onAddSubtask: (t: Task) => void;
}) {
  const [expandedMacros, setExpandedMacros] = useState<Set<string>>(new Set(macroProjects.map((m) => m.id)));

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

  // Group projects by macro_project_id
  function getProjectsForMacro(macroId: string) {
    return projects.filter((p) => (p as any).macro_project_id === macroId);
  }

  const unassignedProjects = projects.filter((p) => !(p as any).macro_project_id);

  function renderTaskRow(task: Task, status: MasterStatus) {
    const priority = priorities.find((p) => p.id === task.priority_id);
    const overdue = getOverdueDays(task.planned_end_date, status.is_closed);
    const monthWeek = getPlannedMonthWeek(task.planned_start_date);
    const subtasks = getSubtasks(task.id);

    return (
      <React.Fragment key={task.id}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_90px_90px_90px_85px_60px_65px_30px] gap-1 md:gap-0 px-3 md:px-16 py-2 border-b hover:bg-accent/30 cursor-pointer text-sm items-center" onClick={() => onEditTask(task)}>
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
          <span className={`text-xs ${overdue > 0 ? 'text-red-600' : ''}`}>{formatDate(task.planned_end_date)}</span>
          <span className={`text-xs ${overdue > 0 ? 'text-red-600 font-bold' : ''}`}>{overdue > 0 ? `${overdue}d` : '-'}</span>
          <span className="text-xs text-muted-foreground">{monthWeek || '-'}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onAddSubtask(task); }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Add subtask"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {expandedTasks.has(task.id) && subtasks.map((sub) => {
          const subStatus = statuses.find((s) => s.id === sub.status_id);
          const subPri = priorities.find((p) => p.id === sub.priority_id);
          const subOver = getOverdueDays(sub.planned_end_date, subStatus?.is_closed ?? false);
          return (
            <div key={sub.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_90px_90px_90px_85px_60px_65px] gap-1 md:gap-0 px-3 md:px-22 py-1.5 border-b hover:bg-accent/20 cursor-pointer text-xs items-center bg-muted/10" onClick={() => onEditTask(sub)}>
              <span className="font-mono text-[10px] text-muted-foreground ml-4">{sub.task_no}</span>
              <span className="text-xs truncate">{sub.title}</span>
              <div>{subStatus && <Badge className="text-[8px] w-fit" style={{ backgroundColor: subStatus.color, color: '#fff' }}>{subStatus.name}</Badge>}</div>
              <div>{subPri && <span className="flex items-center gap-1 text-[10px]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: subPri.color }} />{subPri.name}</span>}</div>
              <span className="text-[10px]">{getMemberName(sub.assignee_id)}</span>
              <span className={`text-[10px] ${subOver > 0 ? 'text-red-600' : ''}`}>{formatDate(sub.planned_end_date)}</span>
              <span className={`text-[10px] ${subOver > 0 ? 'text-red-600 font-bold' : ''}`}>{subOver > 0 ? `${subOver}d` : '-'}</span>
              <span className="text-[10px] text-muted-foreground">{getPlannedMonthWeek(sub.planned_start_date) || '-'}</span>
            </div>
          );
        })}
      </React.Fragment>
    );
  }

  function renderProjectBlock(project: Project, indent: number) {
    const projectDepts = departments.filter((d) => d.project_id === project.id);
    const projectTasks = filteredTasks.filter((t) => t.project_id === project.id);
    if (projectTasks.length === 0) return null;

    return (
      <div key={project.id}>
        <div className={`flex items-center gap-2 py-1.5 border-b cursor-pointer hover:bg-muted/30`} style={{ paddingLeft: `${indent}px` }} onClick={() => toggleSet(expandedProjects, setExpandedProjects, project.id)}>
          {expandedProjects.has(project.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <FolderOpen className="h-3.5 w-3.5 text-primary/70" />
          <span className="font-medium text-sm">{project.name}</span>
          <Badge variant="secondary" className="text-[10px]">{projectTasks.length}</Badge>
        </div>

        {expandedProjects.has(project.id) && projectDepts.map((dept) => {
          const deptTasks = projectTasks.filter((t) => t.department_id === dept.id);
          if (deptTasks.length === 0) return null;

          return (
            <div key={dept.id}>
              <div className="flex items-center gap-2 py-1 border-b cursor-pointer hover:bg-muted/20" style={{ paddingLeft: `${indent + 20}px` }} onClick={() => toggleSet(expandedDepts, setExpandedDepts, dept.id)}>
                {expandedDepts.has(dept.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (dept as any).color || '#6b7280' }} />
                <span className="text-sm">{dept.name}</span>
                <Badge variant="secondary" className="text-[9px]">{deptTasks.length}</Badge>
              </div>

              {expandedDepts.has(dept.id) && statuses.map((status) => {
                const statusTasks = deptTasks.filter((t) => t.status_id === status.id);
                if (statusTasks.length === 0) return null;
                const key = `${dept.id}-${status.id}`;

                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 py-0.5 border-b cursor-pointer hover:bg-muted/10" style={{ paddingLeft: `${indent + 40}px` }} onClick={() => toggleSet(expandedStatuses, setExpandedStatuses, key)}>
                      {expandedStatuses.has(key) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-xs font-medium">{status.name}</span>
                      <Badge variant="secondary" className="text-[9px]">{statusTasks.length}</Badge>
                    </div>
                    {expandedStatuses.has(key) && statusTasks.map((task) => renderTaskRow(task, status))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="hidden md:grid grid-cols-[1fr_2fr_90px_90px_90px_85px_60px_65px_30px] gap-0 bg-muted/50 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Task #</span><span>Title</span><span>Status</span><span>Priority</span><span>Assignee</span><span>Due Date</span><span>Overdue</span><span>Mon/Wk</span><span></span>
      </div>

      {/* Macro Projects */}
      {macroProjects.map((macro) => {
        const macroProjectsList = getProjectsForMacro(macro.id);
        const macroTasks = filteredTasks.filter((t) => macroProjectsList.some((p) => p.id === t.project_id));
        if (macroTasks.length === 0) return null;

        return (
          <div key={macro.id}>
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b cursor-pointer hover:bg-primary/10" onClick={() => toggleSet(expandedMacros, setExpandedMacros, macro.id)}>
              {expandedMacros.has(macro.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="h-3 w-3 rounded" style={{ backgroundColor: macro.color }} />
              <span className="font-bold text-sm">{macro.name}</span>
              <Badge variant="secondary" className="text-[10px]">{macroTasks.length}</Badge>
            </div>
            {expandedMacros.has(macro.id) && macroProjectsList.map((project) => renderProjectBlock(project, 24))}
          </div>
        );
      })}

      {/* Unassigned projects */}
      {unassignedProjects.length > 0 && unassignedProjects.map((project) => renderProjectBlock(project, 12))}

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
                          {formatDate(task.planned_end_date)}
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
