import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useTasks, useMasterData } from '@/hooks/use-tasks';
import TaskDialog from '@/components/tasks/TaskDialog';
import TaskListView from '@/components/tasks/TaskListView';
import TaskBoardView from '@/components/tasks/TaskBoardView';
import TaskCalendarView from '@/components/tasks/TaskCalendarView';
import { exportTasksToCSV } from '@/lib/csv-export';
import TaskFilters, { type FilterState } from '@/components/tasks/TaskFilters';
import StatusTimeline from '@/components/tasks/StatusTimeline';
import { MultiLevelSortBuilder, SaveViewDialog, type SortLevel } from '@/components/tasks/MultiLevelSort';
import { Plus, List, LayoutGrid, Calendar, SlidersHorizontal, Save, BookmarkCheck, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Task, SavedView } from '@/types/database';

type ViewType = 'list' | 'board' | 'calendar';

export default function DepartmentPage() {
  const { projectId, departmentId } = useParams<{ projectId: string; departmentId: string }>();
  const { user } = useAuth();
  const [view, setView] = useState<ViewType>('list');
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [timelineTask, setTimelineTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const [sortField, setSortField] = useState<string>('position');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([]);
  const [showSortBuilder, setShowSortBuilder] = useState(false);
  const [showSaveView, setShowSaveView] = useState(false);
  const [showSavedViews, setShowSavedViews] = useState(false);

  const { data: tasks = [], isLoading } = useTasks(departmentId);
  const { statuses, priorities, taskTypes, categories, users } = useMasterData();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('id', projectId!).single();
      return data;
    },
    enabled: !!projectId,
  });

  const { data: department } = useQuery({
    queryKey: ['department', departmentId],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').eq('id', departmentId!).single();
      return data;
    },
    enabled: !!departmentId,
  });

  const { data: savedViews = [] } = useQuery({
    queryKey: ['saved_views'],
    queryFn: async () => {
      const { data } = await supabase.from('saved_views').select('*').eq('user_id', user!.id).order('created_at');
      return (data as SavedView[]) || [];
    },
    enabled: !!user,
  });

  // Apply filters
  function getFilteredTasks(): Task[] {
    let filtered = [...tasks];
    if (filters.status_id) filtered = filtered.filter((t) => t.status_id === filters.status_id);
    if (filters.priority_id) filtered = filtered.filter((t) => t.priority_id === filters.priority_id);
    if (filters.assignee_id) filtered = filtered.filter((t) => t.assignee_id === filters.assignee_id);
    if (filters.task_type_id) filtered = filtered.filter((t) => t.task_type_id === filters.task_type_id);
    if (filters.category_id) filtered = filtered.filter((t) => t.category_id === filters.category_id);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((t) => t.title.toLowerCase().includes(q) || t.task_no.toLowerCase().includes(q));
    }
    if (filters.overdue_only) {
      const today = new Date().toISOString().split('T')[0];
      const closedIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
      filtered = filtered.filter((t) => !closedIds.includes(t.status_id) && t.planned_end_date && t.planned_end_date < today);
    }

    // Apply multi-level sort (or single-column sort fallback)
    if (sortLevels.length > 0) {
      filtered.sort((a, b) => {
        for (const level of sortLevels) {
          const cmp = compareTasks(a, b, level.field, level.direction);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    } else {
      filtered.sort((a, b) => compareTasks(a, b, sortField, sortDir));
    }

    return filtered;
  }

  function compareTasks(a: Task, b: Task, field: string, dir: 'asc' | 'desc'): number {
    let aVal: any;
    let bVal: any;

    if (field === 'priority') {
      const aP = priorities.find((p) => p.id === a.priority_id);
      const bP = priorities.find((p) => p.id === b.priority_id);
      aVal = aP?.sort_weight ?? 0;
      bVal = bP?.sort_weight ?? 0;
    } else if (field === 'overdue_days') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const closedIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
      const getOverdue = (t: Task) => {
        if (closedIds.includes(t.status_id) || !t.planned_end_date) return 0;
        const end = new Date(t.planned_end_date);
        end.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - end.getTime()) / 86400000);
        return diff > 0 ? diff : 0;
      };
      aVal = getOverdue(a);
      bVal = getOverdue(b);
    } else if (field === 'task_type_id') {
      const aT = taskTypes.find((t) => t.id === a.task_type_id);
      const bT = taskTypes.find((t) => t.id === b.task_type_id);
      aVal = aT?.position ?? 999;
      bVal = bT?.position ?? 999;
    } else {
      aVal = (a as any)[field];
      bVal = (b as any)[field];
    }

    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    if (aVal < bVal) return dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return dir === 'asc' ? 1 : -1;
    return 0;
  }

  const filteredTasks = getFilteredTasks();

  function handleSort(field: string) {
    // Single column sort (resets multi-level)
    setSortLevels([]);
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function loadSavedView(sv: SavedView) {
    setFilters((sv.filters as FilterState) || {});
    setSortLevels((sv.sort_config as unknown as SortLevel[]) || []);
    setView(sv.view_type);
    setShowSavedViews(false);
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
  }

  function handleViewTimeline(task: Task) {
    setTimelineTask(task);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{project?.name}</span>
        <span>/</span>
        <span className="font-medium text-foreground">{department?.name}</span>
      </div>

      {/* Top bar: View switcher + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')} className="h-8">
              <List className="h-4 w-4 mr-1" /> List
            </Button>
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('board')} className="h-8">
              <LayoutGrid className="h-4 w-4 mr-1" /> Board
            </Button>
            <Button variant={view === 'calendar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('calendar')} className="h-8">
              <Calendar className="h-4 w-4 mr-1" /> Calendar
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowSortBuilder(true)}>
            <SlidersHorizontal className="h-4 w-4 mr-1" />
            Sort{sortLevels.length > 0 ? ` (${sortLevels.length})` : ''}
          </Button>

          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowSaveView(true)}>
            <Save className="h-4 w-4 mr-1" /> Save View
          </Button>

          {savedViews.length > 0 && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowSavedViews(true)}>
              <BookmarkCheck className="h-4 w-4 mr-1" /> Views
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTasksToCSV(filteredTasks, { statuses, priorities, taskTypes, categories, users })}
          >
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={() => setShowAddTask(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TaskFilters
        filters={filters}
        onFiltersChange={setFilters}
        statuses={statuses}
        priorities={priorities}
        taskTypes={taskTypes}
        categories={categories}
        users={users}
      />

      {/* Active multi-level sort indicator */}
      {sortLevels.length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
          <span className="font-medium">Sort:</span>
          {sortLevels.map((l, i) => (
            <span key={i} className="bg-muted px-2 py-0.5 rounded">
              {l.field} ({l.direction})
              {i < sortLevels.length - 1 && <span className="ml-1">→</span>}
            </span>
          ))}
          <Button variant="ghost" size="sm" className="h-5 text-xs" onClick={() => setSortLevels([])}>Clear</Button>
        </div>
      )}

      {/* View content */}
      {view === 'list' && (
        <TaskListView
          tasks={filteredTasks}
          statuses={statuses}
          priorities={priorities}
          users={users}
          onEdit={handleEditTask}
          onViewTimeline={handleViewTimeline}
          onSort={handleSort}
          sortField={sortField}
          sortDir={sortDir}
          departmentId={departmentId!}
          projectId={projectId!}
        />
      )}
      {view === 'board' && (
        <TaskBoardView
          tasks={filteredTasks}
          statuses={statuses}
          priorities={priorities}
          users={users}
          onEdit={handleEditTask}
          departmentId={departmentId!}
          projectId={projectId!}
        />
      )}
      {view === 'calendar' && (
        <TaskCalendarView
          tasks={filteredTasks}
          statuses={statuses}
          priorities={priorities}
          onEdit={handleEditTask}
        />
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={showAddTask || !!editingTask}
        onOpenChange={(open) => {
          if (!open) { setShowAddTask(false); setEditingTask(null); }
        }}
        task={editingTask}
        departmentId={departmentId!}
        projectId={projectId!}
      />

      {/* Status Timeline Dialog */}
      {timelineTask && (
        <StatusTimeline
          open={!!timelineTask}
          onOpenChange={(open) => { if (!open) setTimelineTask(null); }}
          task={timelineTask}
          statuses={statuses}
        />
      )}

      {/* Multi-Level Sort Builder Dialog */}
      <Dialog open={showSortBuilder} onOpenChange={setShowSortBuilder}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Multi-Level Sort</DialogTitle>
          </DialogHeader>
          <MultiLevelSortBuilder sortLevels={sortLevels} onSortChange={setSortLevels} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowSortBuilder(false)}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save View Dialog */}
      <SaveViewDialog
        open={showSaveView}
        onOpenChange={setShowSaveView}
        viewType={view}
        filters={filters as unknown as Record<string, unknown>}
        sortConfig={sortLevels}
      />

      {/* Saved Views List */}
      <Dialog open={showSavedViews} onOpenChange={setShowSavedViews}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Saved Views</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {savedViews.map((sv) => (
              <div
                key={sv.id}
                className="p-3 border rounded cursor-pointer hover:bg-accent transition-colors"
                onClick={() => loadSavedView(sv)}
              >
                <div className="font-medium text-sm">{sv.name}</div>
                <div className="text-xs text-muted-foreground">
                  {sv.view_type} view · {(sv.sort_config as any[])?.length || 0} sort levels
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
