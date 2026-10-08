import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The caveats that belong to a set of figures, shown with the figures. */
export default function DataCaveats({ items = [], tone = 'info' }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <ul className={cn('space-y-1.5 rounded-lg border px-4 py-3 text-xs', tone === 'warning' ? 'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5' : 'border-border bg-muted/40')}>
      {list.map((item) => (
        <li key={item} className="flex gap-2 text-muted-foreground">
          <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tone === 'warning' ? 'text-[hsl(var(--warning))]' : 'text-primary')} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}