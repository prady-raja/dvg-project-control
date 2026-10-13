import React from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/common/StatusPill';
import { STATUS_TOKENS } from '@/lib/tokens';

const TONES = {
  'Handed Over': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Handed Over': 'bg-amber-50 text-amber-800 border-amber-200',
  Critical: 'bg-red-50 text-red-700 border-red-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Medium: 'bg-amber-50 text-amber-800 border-amber-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
  'Works Pending': 'bg-amber-50 text-amber-800 border-amber-200',
  'Under Construction': 'bg-sky-50 text-sky-700 border-sky-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Planning: 'bg-violet-50 text-violet-700 border-violet-200',
  Archived: 'bg-slate-100 text-slate-500 border-slate-200',
  'Internal Execution Team': 'bg-teal-50 text-teal-700 border-teal-200',
  'External Contractor': 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function Pill({ value, className, dot = false }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (STATUS_TOKENS[value] || value === 'On Hold' || value === 'Active') return <StatusPill status={value} className={className} />;
  const tone = TONES[value] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-xs font-medium leading-5',
        tone,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />}
      <span className="truncate">{value}</span>
    </span>
  );
}