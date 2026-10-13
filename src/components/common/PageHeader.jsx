import React from 'react';
import { cn } from '@/lib/utils';

export default function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="truncate text-2xl font-semibold text-foreground sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}