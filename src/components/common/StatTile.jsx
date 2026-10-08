import React from 'react';
import { cn } from '@/lib/utils';

/**
 * One headline figure. Every number on a dashboard is clickable so management
 * can open the records behind it instead of trusting the tile.
 */
export default function StatTile({ label, value, hint, onClick, tone = 'default', active = false }) {
  const clickable = typeof onClick === 'function';
  const tones = {
    default: 'text-foreground',
    warning: 'text-[hsl(var(--warning))]',
    danger: 'text-destructive',
    success: 'text-[hsl(var(--success))]',
  };

  const content = (
    <>
      <p className={cn('field-mono text-2xl font-semibold tnum', tones[tone] || tones.default)}>{value}</p>
      <p className="mt-1 text-[11px] uppercase leading-tight tracking-wide text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </>
  );

  if (!clickable) {
    return <div className="rounded-xl border border-border bg-card px-4 py-3">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50',
        active ? 'border-primary' : 'border-border',
      )}
    >
      {content}
      <span className="mt-2 block text-[10px] uppercase tracking-wide text-primary">Open list</span>
    </button>
  );
}