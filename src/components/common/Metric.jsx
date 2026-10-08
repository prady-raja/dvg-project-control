import React from 'react';
import { cn } from '@/lib/utils';

export function Metric({ label, value, tone = 'default', className }) {
  const tones = {
    default: 'text-foreground',
    muted: 'text-muted-foreground',
    brand: 'text-[hsl(var(--brand))]',
    warn: 'text-[hsl(var(--warning))]',
    danger: 'text-destructive',
    ok: 'text-[hsl(var(--success))]',
  };
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('field-mono mt-0.5 text-lg font-medium leading-tight', tones[tone])}>{value}</p>
    </div>
  );
}

export default function MetricRow({ children, className }) {
  return <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-4', className)}>{children}</div>;
}