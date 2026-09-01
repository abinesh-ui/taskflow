import { useState, useRef, useEffect } from 'react';
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
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

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

  // Compute dropdown position using fixed positioning so it's never clipped by overflow containers
  function openDropdown() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropHeight = Math.min(240, options.length * 32 + 48);

      if (spaceBelow >= dropHeight || spaceBelow >= spaceAbove) {
        // Open below
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 200),
          zIndex: 9999,
        });
      } else {
        // Open above
        setDropdownStyle({
          position: 'fixed',
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: Math.max(rect.width, 200),
          zIndex: 9999,
        });
      }
    }
    setOpen(true);
    setSearch('');
  }

  // Close on scroll or resize
  useEffect(() => {
    if (!open) return;
    function handleClose() { setOpen(false); }
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [open]);

  const filteredOptions = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className={`relative ${className || ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className="flex items-center gap-1 h-8 w-full min-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => open ? setOpen(false) : openDropdown()}
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
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
            style={dropdownStyle}
          >
            {options.length > 6 && (
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1 text-xs border rounded mb-1 bg-background outline-none focus:ring-1 focus:ring-ring"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {filteredOptions.map((opt) => (
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
            {filteredOptions.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No options</p>}
          </div>
        </>
      )}
    </div>
  );
}
