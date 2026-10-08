import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Pill from '@/components/common/Pill';
import ProgressNote from '@/components/common/ProgressNote';
import ActivityRows from '@/components/common/ActivityRows';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** One contractor's position: works, delays, manpower and what needs a decision. */
export default function ContractorBoardCard({ row }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <article className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold">{row.contractor}</h3>
            {row.classification && (
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {row.classification}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.trade || 'Trade not recorded'} · {row.villas.length ? row.villas.join(', ') : 'no villa assigned'}
            {row.on_hold_tasks ? ` · ${row.on_hold_tasks} on villas on hold` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={() => setOpen((value) => !value)}>
          <Chevron className="h-3.5 w-3.5" /> {open ? 'Hide works' : `Open works (${row.open})`}
        </Button>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Assigned works', row.assigned, ''],
          ['Open works', row.open, ''],
          ['Overdue', row.overdue, row.overdue ? 'danger' : ''],
          ['Blocked', row.blocked, row.blocked ? 'danger' : ''],
          ['Due this week', row.due_this_week, ''],
          ['Awaiting approval', row.awaiting_approval, row.awaiting_approval ? 'warning' : ''],
        ].map(([label, value, tone]) => (
          <div key={label}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn('field-mono mt-1 text-lg font-semibold tnum', tone === 'danger' && 'text-destructive', tone === 'warning' && 'text-[hsl(var(--warning))]')}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 px-5 pb-4 lg:grid-cols-3">
        <ProgressNote progress={row.progress} label="Measured progress" />
        <div className="rounded-xl border border-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reported manpower (last 7 days)</p>
          <p className="field-mono mt-1 text-lg font-semibold tnum">{row.manpower_7d}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{row.manpower_basis}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{row.reports_7d} report(s) filed in the last seven days.</p>
        </div>
        <div className="rounded-xl border border-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest reported progress</p>
          {row.latest_report ? (
            <>
              <p className="mt-1 text-sm">{row.latest_report.text || 'No narrative recorded'}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {row.latest_report.by || 'Site'} · {String(row.latest_report.at || '').slice(0, 10)}
                {row.latest_report.progress !== null && ` · ${row.latest_report.progress}%`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No site report filed yet for this contractor's work.</p>
          )}
          {row.stale_tasks > 0 && (
            <p className="mt-2 text-[11px] font-medium text-[hsl(var(--warning))]">
              {row.stale_tasks} open work(s) not updated in the last seven days.
            </p>
          )}
        </div>
      </div>

      {row.needs_intervention.length > 0 && (
        <div className="mx-5 mb-4 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--warning))]">
            Waiting on another party ({row.needs_intervention.length})
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {row.needs_intervention.slice(0, 6).map((task) => (
              <li key={task.id}>
                <Link to={`/tasks/${task.id}`} className="field-mono font-medium hover:underline">{task.ref}</Link>{' '}
                <span className="text-muted-foreground">
                  {task.villa} · {task.blocker || task.name} · owner recorded as {task.blocker_responsible || 'not stated'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Pill value={`${row.open} open`} />
            {row.unscheduled > 0 && <span className="text-xs text-muted-foreground">{row.unscheduled} without dates</span>}
          </div>
          <ActivityRows rows={row.tasks} emptyLabel="No open work for this contractor." />
        </div>
      )}
    </article>
  );
}