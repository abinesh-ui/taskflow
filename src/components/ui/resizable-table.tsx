import { useState, useRef, useCallback } from 'react';

interface UseResizableColumnsOptions {
  initialWidths: number[];
  minWidth?: number;
}

export function useResizableColumns({ initialWidths, minWidth = 40 }: UseResizableColumnsOptions) {
  const [widths, setWidths] = useState<number[]>(initialWidths);
  const resizing = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const onMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { index, startX: e.clientX, startWidth: widths[index] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const diff = ev.clientX - resizing.current.startX;
      const newWidth = Math.max(minWidth, resizing.current.startWidth + diff);
      setWidths((prev) => {
        const next = [...prev];
        next[resizing.current!.index] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [widths, minWidth]);

  return { widths, onMouseDown };
}

export function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
      style={{ touchAction: 'none' }}
    />
  );
}
