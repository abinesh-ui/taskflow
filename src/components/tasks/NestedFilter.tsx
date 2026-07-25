import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { Plus, X, Filter } from 'lucide-react';

export interface FilterCondition {
  id: string;
  field: string;
  operator: 'in' | 'not_in' | 'gt' | 'lt' | 'between' | 'eq';
  values: string[];
  connector: 'AND' | 'OR';
}

interface FieldDef {
  key: string;
  label: string;
  type: 'select' | 'date' | 'number';
  options?: Array<{ value: string; label: string; color?: string }>;
}

interface NestedFilterProps {
  fields: FieldDef[];
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
}

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

let idCounter = 0;
function genId() { return `f_${++idCounter}`; }

export function NestedFilterBuilder({ fields, conditions, onChange }: NestedFilterProps) {
  const [expanded, setExpanded] = useState(conditions.length > 0);

  function addCondition() {
    const first = fields[0];
    onChange([...conditions, { id: genId(), field: first.key, operator: 'in', values: [], connector: 'AND' }]);
    setExpanded(true);
  }

  function removeCondition(id: string) {
    onChange(conditions.filter((c) => c.id !== id));
  }

  function updateCondition(id: string, updates: Partial<FilterCondition>) {
    onChange(conditions.map((c) => c.id === id ? { ...c, ...updates } : c));
  }

  function clearAll() {
    onChange([]);
  }

  if (!expanded && conditions.length === 0) {
    return (
      <div className="p-3 border rounded-lg bg-white dark:bg-card shadow-sm">
        <button onClick={addCondition} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
          <Plus className="h-3.5 w-3.5" /> Add filter condition
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 border rounded-lg bg-white dark:bg-card shadow-sm space-y-1.5">
      {conditions.map((cond, idx) => {
        const fieldDef = fields.find((f) => f.key === cond.field);
        return (
          <div key={cond.id} className="flex flex-wrap items-center gap-1.5">
            {/* Connector (AND/OR) - not shown for first */}
            {idx > 0 && (
              <select
                value={cond.connector}
                onChange={(e) => updateCondition(cond.id, { connector: e.target.value as 'AND' | 'OR' })}
                className="h-6 text-[10px] font-bold bg-muted rounded px-1.5 border-0 text-primary"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            {idx === 0 && <span className="text-[10px] font-medium text-muted-foreground w-8">Where</span>}

            {/* Field selector */}
            <select
              value={cond.field}
              onChange={(e) => updateCondition(cond.id, { field: e.target.value, values: [] })}
              className="h-6 text-[10px] bg-muted rounded px-1.5 border-0"
            >
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>

            {/* Value selector */}
            {fieldDef?.type === 'select' && (
              <MultiSelect
                options={fieldDef.options || []}
                selected={cond.values}
                onChange={(vals) => updateCondition(cond.id, { values: vals })}
                placeholder="Select..."
                className="min-w-[140px]"
              />
            )}
            {fieldDef?.type === 'date' && (
              <div className="flex items-center gap-1">
                <select
                  value={cond.values[0] || ''}
                  onChange={(e) => updateCondition(cond.id, { values: [e.target.value, cond.values[1] || ''] })}
                  className="h-6 text-[10px] bg-muted rounded px-1 border-0"
                >
                  <option value="">Pick...</option>
                  {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {cond.values[0] === 'custom' && (
                  <>
                    <Input type="date" value={cond.values[1] || ''} onChange={(e) => updateCondition(cond.id, { values: ['custom', e.target.value, cond.values[2] || ''] })} className="h-6 text-[10px] w-28" />
                    <Input type="date" value={cond.values[2] || ''} onChange={(e) => updateCondition(cond.id, { values: ['custom', cond.values[1] || '', e.target.value] })} className="h-6 text-[10px] w-28" />
                  </>
                )}
              </div>
            )}
            {fieldDef?.type === 'number' && (
              <div className="flex items-center gap-1">
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(cond.id, { operator: e.target.value as any })}
                  className="h-6 text-[10px] bg-muted rounded px-1 border-0"
                >
                  <option value="gt">Above</option>
                  <option value="lt">Below</option>
                  <option value="between">Between</option>
                </select>
                <Input
                  type="number"
                  value={cond.values[0] || ''}
                  onChange={(e) => updateCondition(cond.id, { values: [e.target.value, cond.values[1] || ''] })}
                  className="h-6 text-[10px] w-16"
                  placeholder="days"
                />
                {cond.operator === 'between' && (
                  <Input
                    type="number"
                    value={cond.values[1] || ''}
                    onChange={(e) => updateCondition(cond.id, { values: [cond.values[0] || '', e.target.value] })}
                    className="h-6 text-[10px] w-16"
                    placeholder="to"
                  />
                )}
              </div>
            )}

            {/* Remove */}
            <button onClick={() => removeCondition(cond.id)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {/* + button right after conditions (left side) */}
      <div className="flex items-center gap-2">
        <button onClick={addCondition} className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 font-medium h-6 px-1.5 rounded hover:bg-primary/10">
          <Plus className="h-3 w-3" /> Add condition
        </button>
        {conditions.length > 0 && (
          <button onClick={clearAll} className="text-[10px] text-destructive hover:text-destructive/80 h-6 px-1.5 rounded hover:bg-destructive/10">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// Apply filter conditions to tasks
export function applyFilters(tasks: any[], conditions: FilterCondition[], getOverdueDays: (t: any) => number): any[] {
  if (conditions.length === 0) return tasks;

  return tasks.filter((task) => {
    let result = true;
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const match = evaluateCondition(task, cond, getOverdueDays);
      if (i === 0) {
        result = match;
      } else {
        if (cond.connector === 'AND') result = result && match;
        else result = result || match;
      }
    }
    return result;
  });
}

function evaluateCondition(task: any, cond: FilterCondition, getOverdueDays: (t: any) => number): boolean {
  if (cond.values.length === 0 || (cond.values.length === 1 && !cond.values[0])) return true;

  if (cond.field === 'overdue_days') {
    const overdue = getOverdueDays(task);
    const val = Number(cond.values[0]) || 0;
    if (cond.operator === 'gt') return overdue > val;
    if (cond.operator === 'lt') return overdue < val;
    if (cond.operator === 'between') return overdue >= val && overdue <= (Number(cond.values[1]) || 999);
    return true;
  }

  if (cond.field === 'due_date') {
    const dueDate = task.planned_end_date;
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const preset = cond.values[0];

    if (preset === 'today') return dueDate === today.toISOString().split('T')[0];
    if (preset === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); return dueDate === y.toISOString().split('T')[0]; }
    if (preset === 'this_week') {
      const start = new Date(today); start.setDate(start.getDate() - start.getDay());
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return dueDate >= start.toISOString().split('T')[0] && dueDate <= end.toISOString().split('T')[0];
    }
    if (preset === 'next_week') {
      const start = new Date(today); start.setDate(start.getDate() + (7 - start.getDay()));
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return dueDate >= start.toISOString().split('T')[0] && dueDate <= end.toISOString().split('T')[0];
    }
    if (preset === 'this_month') {
      const m = today.toISOString().slice(0, 7);
      return dueDate.startsWith(m);
    }
    if (preset === 'custom') {
      const from = cond.values[1] || '';
      const to = cond.values[2] || '';
      if (from && dueDate < from) return false;
      if (to && dueDate > to) return false;
      return true;
    }
    return true;
  }

  // Multi-select field (in)
  const fieldValue = task[cond.field];
  if (!fieldValue) return false;
  return cond.values.includes(fieldValue);
}
