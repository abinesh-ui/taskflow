import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { MasterStatus, MasterPriority, MasterTaskType, MasterTaskCategory, Profile } from '@/types/database';

export interface FilterState {
  status_id?: string;
  priority_id?: string;
  assignee_id?: string;
  task_type_id?: string;
  category_id?: string;
  search?: string;
  overdue_only?: boolean;
}

interface TaskFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  statuses: MasterStatus[];
  priorities: MasterPriority[];
  taskTypes: MasterTaskType[];
  categories: MasterTaskCategory[];
  users: Profile[];
}

export default function TaskFilters({
  filters,
  onFiltersChange,
  statuses,
  priorities,
  taskTypes,
  categories,
  users,
}: TaskFiltersProps) {
  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search tasks..."
        value={filters.search || ''}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        className="h-8 w-48 text-sm"
      />

      <Select
        value={filters.status_id || 'all'}
        onValueChange={(val) => onFiltersChange({ ...filters, status_id: val === 'all' ? undefined : val })}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority_id || 'all'}
        onValueChange={(val) => onFiltersChange({ ...filters, priority_id: val === 'all' ? undefined : val })}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {priorities.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.assignee_id || 'all'}
        onValueChange={(val) => onFiltersChange({ ...filters, assignee_id: val === 'all' ? undefined : val })}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assignees</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.task_type_id || 'all'}
        onValueChange={(val) => onFiltersChange({ ...filters, task_type_id: val === 'all' ? undefined : val })}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {taskTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.category_id || 'all'}
        onValueChange={(val) => onFiltersChange({ ...filters, category_id: val === 'all' ? undefined : val })}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={filters.overdue_only ? 'destructive' : 'outline'}
        size="sm"
        className="h-8 text-xs"
        onClick={() => onFiltersChange({ ...filters, overdue_only: !filters.overdue_only })}
      >
        Overdue Only
      </Button>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onFiltersChange({})}>
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
