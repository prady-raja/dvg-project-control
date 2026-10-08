import React from 'react';
import { cn } from '@/lib/utils';

/** Unknown progress stays blank rather than becoming 0% or 100%. */
export default function ProgressMeter({ value, className, showLabel = true }) {
  const known = value !== null && value !== undefined && value !== '';
  const pct = known ? Math.max(0, Math.min(100, Number(value))) : null;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
        {known && (
          <div
            className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--brand))]')}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {showLabel && (
        <span className="field-mono text-xs text-foreground">{known ? `${pct}%` : <span className="text-muted-foreground">—</span>}</span>
      )}
    </div>
  );
}