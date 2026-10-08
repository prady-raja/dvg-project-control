import React from 'react';
import { Link } from 'react-router-dom';
import Pill from '@/components/common/Pill';
import { formatDate } from '@/lib/format';

const th = 'whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

/** Works that are holding other works up, with everything recorded about them. */
export default function BlockerTable({ rows = [] }) {
  if (!rows.length) {
    return <p className="px-1 py-8 text-center text-sm text-muted-foreground">No blocker is recorded in this scope.</p>;
  }

  return (
    <>
      <div className="scroll-slim hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={`${th} py-2 text-left`}>Blocking activity or issue</th>
              <th className={`${th} py-2 text-left`}>Villa</th>
              <th className={`${th} py-2 text-left`}>Responsible contractor</th>
              <th className={`${th} py-2 text-left`}>Category</th>
              <th className={`${th} py-2 text-left`}>Identified</th>
              <th className={`${th} py-2 text-left`}>Days blocked</th>
              <th className={`${th} py-2 text-left`}>Expected resolution</th>
              <th className={`${th} py-2 text-left`}>Holding up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 align-top last:border-0">
                <td className="max-w-[320px] py-2.5">
                  <Link to={`/tasks/${row.id}`} className="field-mono text-xs font-semibold hover:underline">{row.ref}</Link>
                  <div className="text-sm">{row.blocker || row.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{row.name}</div>
                  <div className="mt-1"><Pill value={row.status} /></div>
                </td>
                <td className="whitespace-nowrap py-2.5 text-sm">
                  {row.villa}
                  <div className="text-xs text-muted-foreground">{row.phase}</div>
                </td>
                <td className="whitespace-nowrap py-2.5 text-sm text-muted-foreground">
                  {row.contractor || 'Unassigned'}
                  {row.blocker_responsible && (
                    <div className="text-xs">Owner: {row.blocker_responsible}</div>
                  )}
                </td>
                <td className="whitespace-nowrap py-2.5 text-xs text-muted-foreground">{row.blocker_category || 'Not categorised'}</td>
                <td className="field-mono whitespace-nowrap py-2.5 text-xs text-muted-foreground">{formatDate(row.identified)}</td>
                <td className="field-mono whitespace-nowrap py-2.5 text-xs">
                  {row.days_blocked === null || row.days_blocked === undefined ? '—' : `${row.days_blocked} day(s)`}
                </td>
                <td className="field-mono whitespace-nowrap py-2.5 text-xs">
                  {row.expected_resolution_date ? formatDate(row.expected_resolution_date) : 'Not stated'}
                  {row.resolution_overdue && <div className="text-[10px] uppercase text-destructive">past expected date</div>}
                </td>
                <td className="max-w-[260px] py-2.5 text-xs text-muted-foreground">
                  {row.downstream_count === 0
                    ? 'No dependent task recorded'
                    : row.downstream.map((node) => (
                      <div key={node.id}>
                        {node.ref} · {node.discipline_name} · {node.status}
                      </div>
                    ))}
                </td>
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
              <Pill value={row.status} />
            </div>
            <p className="mt-2 text-sm">{row.blocker || row.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{row.villa} · {row.contractor || 'Unassigned'}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {row.blocker_category || 'Not categorised'} · identified {formatDate(row.identified)} ·{' '}
              {row.days_blocked === null || row.days_blocked === undefined ? 'duration not recorded' : `${row.days_blocked} day(s) blocked`}
            </p>
            <p className="mt-2 text-xs">
              Expected resolution: {row.expected_resolution_date ? formatDate(row.expected_resolution_date) : 'not stated'}
            </p>
            <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
              Holding up: {row.downstream_count === 0 ? 'no dependent task recorded' : row.downstream.map((n) => n.ref).join(', ')}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}