import React from 'react';
import { Link } from 'react-router-dom';
import HealthBadge from '@/components/common/HealthBadge';
import Pill from '@/components/common/Pill';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The shared activity flags: delay, due-soon, blocker, demo, on-hold villa. */
export function ActivityFlags({ row }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.overdue_days > 0 && (
        <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
          {row.overdue_days}d overdue
        </span>
      )}
      {row.overdue_days === 0 && row.due_in_days !== null && row.due_in_days <= 7 && (
        <span className="rounded border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[hsl(var(--warning))]">
          due in {row.due_in_days}d
        </span>
      )}
      {!row.finish && (
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">no date</span>
      )}
      {row.blocker && (
        <span className="rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] uppercase text-destructive">blocker</span>
      )}
      {row.villa_on_hold && (
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">villa on hold</span>
      )}
      {row.is_demo && (
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">demo</span>
      )}
    </span>
  );
}

/** One activity on a narrow screen — the same facts as the table row. */
export default function ActivityCard({ row, showAction = false, rowAction }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/tasks/${row.id}`} className="field-mono text-xs font-semibold hover:underline">
          {row.ref}
        </Link>
        <span className="flex flex-wrap items-center gap-1.5">
          {row.health && <HealthBadge health={row.health} slipDays={row.slip_days} />}
          <Pill value={row.status} />
        </span>
      </div>
      <p className="mt-2 text-sm font-medium">{row.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {row.villa}
        {row.phase ? ` · ${row.phase}` : ''} · {row.discipline_name}
      </p>
      <div className="mt-3">
        <ActivityFlags row={row} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Baseline finish</dt>
          <dd className="field-mono">{formatDate(row.baseline_finish)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Forecast finish</dt>
          <dd className={cn('field-mono', row.forecast_finish && !row.baseline_finish ? 'font-semibold' : '')}>
            {formatDate(row.forecast_finish)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contractor</dt>
          <dd className="truncate">{row.contractor || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Engineer</dt>
          <dd className="truncate">{row.engineer || '—'}</dd>
        </div>
        {row.progress !== null && (
          <div>
            <dt className="text-muted-foreground">Progress</dt>
            <dd className="field-mono">{row.progress}%</dd>
          </div>
        )}
        {row.quantity?.percent !== null && row.quantity?.percent !== undefined && (
          <div>
            <dt className="text-muted-foreground">Quantity</dt>
            <dd className="field-mono">
              {row.quantity.completed} / {row.quantity.planned} {row.quantity.unit} ({row.quantity.percent}%)
            </dd>
          </div>
        )}
      </dl>
      {(row.blocker || showAction) && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          {row.blocker ? `Blocker: ${row.blocker}` : row.action}
        </p>
      )}
      {rowAction && <div className="mt-3 border-t border-border pt-3">{rowAction(row)}</div>}
    </article>
  );
}