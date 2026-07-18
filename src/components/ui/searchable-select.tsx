import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  color?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Select...', className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div className={`relative ${className || ''}`}>
      <button
        type="button"
        className="flex items-center gap-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        <span className="flex-1 text-left truncate">
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.color && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedOption.color }} />}
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        {value && (
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground flex-shrink-0" onClick={(e) => { e.stopPropagation(); onChange(''); }} />
        )}
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-11 left-0 w-full min-w-[200px] rounded-md border bg-popover shadow-lg">
            {/* Search input */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            {/* Options */}
            <div className="max-h-52 overflow-y-auto p-1">
              {filtered.map((opt) => (
                <div
                  key={opt.value}
                  className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-accent ${
                    opt.value === value ? 'bg-accent/50 font-medium' : ''
                  }`}
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                >
                  {opt.color && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />}
                  <span>{opt.label}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-2 text-center">No results found</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
