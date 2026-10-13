import React from 'react';
import { cn } from '@/lib/utils';

/** Simple label/value grid used on the detail screens. */
export default function DetailList({ items = [], columns = 2, className }) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2', className)}>
      {visible.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              'mt-1 text-sm text-foreground',
              item.mono && 'field-mono',
              item.value === undefined || item.value === null || item.value === '' ? 'text-muted-foreground' : '',
            )}
          >
            {item.value === undefined || item.value === null || item.value === '' ? '—' : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}