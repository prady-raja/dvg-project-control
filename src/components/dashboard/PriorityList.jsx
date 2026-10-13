import React from 'react';
import { Link } from 'react-router-dom';
import Pill from '@/components/common/Pill';
import { formatDate } from '@/lib/format';

const th = 'whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground';

/**
 * The management priority list: the highest-scoring outstanding issues, each
 * one reconciled to a real task record and carrying what has to be done next.
 */
export default function PriorityList({ rows = [] }) {
  if (!rows.length) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        No outstanding issue scores as a management priority for this scope and date.
      </p>
    );
  }

  return (
    <>
      <div className="scroll-slim hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={`${th} py-2 pl-1 text-left`}>#</th>
              <th className={`${th} py-2 text-left`}>Priority</th>
              <th className={`${th} py-2 text-left`}>Villa</th>
              <th className={`${th} py-2 text-left`}>Task</th>
              <th className={`${th} py-2 text-left`}>Contractor</th>
              <th className={`${th} py-2 text-left`}>Engineer</th>
              <th className={`${th} py-2 text-left`}>Forecast finish</th>
              <th className={`${th} py-2 text-left`}>Delay</th>
              <th className={`${th} py-2 text-left`}>Blocker</th>
              <th className={`${th} py-2 pr-1 text-left`}>Action required</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 align-top last:border-0">
                <td className="field-mono py-2.5 pl-1 text-xs text-muted-foreground">{row.rank}</td>
                <td className="whitespace-nowrap py-2.5"><Pill value={row.priority} /></td>
                <td className="whitespace-nowrap py-2.5 text-sm">
                  {row.villa}
                  <div className="text-xs text-muted-foreground">{row.phase}</div>
                </td>
                <td className="max-w-[280px] py-2.5">
                  <Link to={`/tasks/${row.id}`} className="field-mono text-xs font-semibold hover:underline">{row.ref}</Link>
                  <div className="text-sm">{row.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Pill value={row.status} />
                    {row.blocked_days !== null && row.blocked_days !== undefined && (
                      <span className="rounded border border-destructive/40 px-1.5 py-0.5 text-xs uppercase text-destructive">
                        blocked {row.blocked_days}d
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap py-2.5 text-sm text-muted-foreground">{row.contractor || '—'}</td>
                <td className="whitespace-nowrap py-2.5 text-sm text-muted-foreground">{row.engineer || '—'}</td>
                <td className="field-mono whitespace-nowrap py-2.5 text-xs">
                  {formatDate(row.forecast_finish)}
                  <div className="text-xs uppercase text-muted-foreground">{row.finish_source || 'no date'}</div>
                </td>
                <td className="whitespace-nowrap py-2.5 text-xs">
                  {row.overdue_days > 0 ? (
                    <span className="text-destructive">{row.overdue_days} day(s) late</span>
                  ) : row.due_in_days !== null && row.due_in_days !== undefined ? (
                    <span className="text-muted-foreground">due in {row.due_in_days} day(s)</span>
                  ) : (
                    <span className="text-muted-foreground">not scheduled</span>
                  )}
                </td>
                <td className="max-w-[220px] py-2.5 text-xs text-muted-foreground">
                  {row.blocker || '—'}
                  {row.blocker_responsible && <div className="mt-0.5">Owner: {row.blocker_responsible}</div>}
                </td>
                <td className="max-w-[200px] py-2.5 pr-1 text-xs font-medium">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/tasks/${row.id}`} className="field-mono text-xs font-semibold hover:underline">{row.ref}</Link>
              <Pill value={row.priority} />
            </div>
            <p className="mt-2 text-sm font-medium">{row.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{row.villa} · {row.phase} · {row.contractor || 'Unassigned'}</p>
            <p className="mt-2 text-xs">
              {row.overdue_days > 0 ? <span className="text-destructive">{row.overdue_days} day(s) overdue</span> : 'Not overdue'}
              {' · forecast '}
              <span className="field-mono">{formatDate(row.forecast_finish)}</span>
            </p>
            {row.blocker && <p className="mt-2 text-xs text-muted-foreground">Blocker: {row.blocker}</p>}
            <p className="mt-2 border-t border-border pt-2 text-xs font-medium">Action: {row.action}</p>
          </article>
        ))}
      </div>
    </>
  );
}