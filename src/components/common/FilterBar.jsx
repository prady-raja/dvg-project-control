import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A list's filters, quiet by default: a few chips for what people ask for most, then one
 * "More filters" control that carries a count of what is switched on inside it. Clear
 * filters is always in view. The list itself decides what the chips and the rest are.
 */
export default function FilterBar({ chips = [], moreCount = 0, totalActive = 0, onClear, children, extra, defaultOpen = false, className }) {
  const [open, setOpen] = useState(defaultOpen || moreCount > 0);
  return (
    <div className={cn('rounded-xl border border-border bg-card p-3 sm:p-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const cls = cn('min-h-11 rounded-full border px-4 text-sm font-medium transition-colors', chip.active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40');
          return chip.to
            ? <Link key={chip.key} to={chip.to} className={cn(cls, 'inline-flex items-center')}>{chip.label}</Link>
            : <button key={chip.key} type="button" aria-pressed={!!chip.active} onClick={chip.onClick} className={cls}>{chip.label}</button>;
        })}
        {children && (
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-medium">
            More filters
            {moreCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-label={`${moreCount} active`}>{moreCount}</span>}
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {extra}
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" disabled={!totalActive} onClick={onClear}>
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters{totalActive ? ` (${totalActive})` : ''}
          </Button>
        </div>
      </div>
      {children && open && <div className="mt-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}
