import { useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  color?: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options, selected, onChange, placeholder = 'Select...', className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function clear() {
    onChange([]);
  }

  return (
    <div className={`relative ${className || ''}`}>
      <button
        type="button"
        className="flex items-center gap-1 h-8 w-full min-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 text-left truncate">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="flex items-center gap-1 flex-wrap">
              {selected.length <= 2 ? (
                selected.map((s) => {
                  const opt = options.find((o) => o.value === s);
                  return (
                    <Badge key={s} variant="secondary" className="text-[9px] h-5 px-1">
                      {opt?.color && <span className="h-2 w-2 rounded-full mr-0.5 inline-block" style={{ backgroundColor: opt.color }} />}
                      {opt?.label}
                    </Badge>
                  );
                })
              ) : (
                <span>{selected.length} selected</span>
              )}
            </span>
          )}
        </span>
        {selected.length > 0 && (
          <X className="h-3 w-3 text-muted-foreground hover:text-foreground flex-shrink-0" onClick={(e) => { e.stopPropagation(); clear(); }} />
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-9 left-0 w-full min-w-[180px] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer hover:bg-accent ${
                  selected.includes(opt.value) ? 'bg-accent/50' : ''
                }`}
                onClick={() => toggle(opt.value)}
              >
                <input type="checkbox" checked={selected.includes(opt.value)} readOnly className="h-3 w-3 rounded" />
                {opt.color && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
                <span>{opt.label}</span>
              </div>
            ))}
            {options.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No options</p>}
          </div>
        </>
      )}
    </div>
  );
}
