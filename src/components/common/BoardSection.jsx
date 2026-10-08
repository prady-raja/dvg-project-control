import React from 'react';
import { cn } from '@/lib/utils';

/** A titled panel used by every board, so the screens read the same way. */
export default function BoardSection({ title, description, actions, children, className, dense }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={dense ? 'p-3 sm:p-4' : 'p-5'}>{children}</div>
    </section>
  );
}