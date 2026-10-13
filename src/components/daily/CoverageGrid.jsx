import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useDashboardQuery } from '@/hooks/useDashboardQuery';
import { useQuickActions } from '@/components/layout/QuickActions';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { dialDigits, whatsappLink } from '@/lib/shared/constraints.ts';
import DataState from '@/components/common/DataState';
import { cn } from '@/lib/utils';

const STYLE = {
  reported: 'bg-emerald-500/80',
  blocked: 'bg-red-500/80',
  none: 'border border-dashed border-border bg-transparent',
};
const LABEL = { reported: 'reported', blocked: 'blocker reported', none: 'no report' };

/**
 * Which villas went unreported over the last 14 working days, and a team table
 * (D-05). Tapping a gap opens Log update for that villa and day; the engineer's
 * name opens a WhatsApp chase when a number is on record.
 */
export default function CoverageGrid({ projectId, phaseId, date, canReport }) {
  const quick = useQuickActions();
  const navigate = useNavigate();
  const { members } = useProjectMembers(projectId);
  const { data, isLoading, error, refetch } = useDashboardQuery('coverage', { projectId, phaseId, date }, { enabled: !!projectId });
  const phoneOf = (userId) => members.find((m) => m.user_id === userId)?.phone || '';

  return (
    <section className="rounded-xl border border-border bg-card p-4 print:hidden">
      <h2 className="font-display text-sm font-semibold">Report coverage</h2>
      <p className="mt-1 text-xs text-muted-foreground">Working days only. Green: reported. Red: a blocker was reported. Dashed: nothing filed.</p>
      <DataState loading={isLoading} error={error} onRetry={refetch} empty={!!data && !data.rows?.length} emptyTitle="No villas to cover" emptyDescription="Villas appear here once they are on the register and active.">
        {data && (
          <>
            <p className="mt-2 text-xs">
              <span className="font-medium">{data.totals.unreported_today}</span> of {data.totals.villas} villas have no report today
              {data.totals.never_reported ? <> · <span className="font-medium text-destructive">{data.totals.never_reported}</span> not reported in 14 working days</> : null}.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card pr-3 text-left font-medium">Villa</th>
                    {data.days.map((d) => <th key={d} className="px-0.5 text-center font-normal text-muted-foreground">{d.slice(8)}</th>)}
                    <th className="pl-3 text-left font-medium">Engineer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.location_id}>
                      <td className="sticky left-0 bg-card pr-3 font-mono"><button type="button" className="underline-offset-2 hover:underline" onClick={() => navigate(`/locations/${row.location_id}`)}>{row.villa}</button></td>
                      {row.cells.map((c) => (
                        <td key={c.day} className="px-0.5 text-center">
                          <button
                            type="button"
                            disabled={c.state !== 'none' || !canReport}
                            aria-label={`${row.villa} ${c.day}: ${LABEL[c.state]}${c.state === 'none' && canReport ? '. Log an update' : ''}`}
                            onClick={() => quick.openLogUpdate({ locationId: row.location_id, date: c.day })}
                            className={cn('inline-block h-6 w-6 rounded', STYLE[c.state])}
                          />
                        </td>
                      ))}
                      <td className="whitespace-nowrap pl-3 text-muted-foreground">
                        {row.engineer || '—'}
                        {row.engineer_user_id && dialDigits(phoneOf(row.engineer_user_id)) && row.cells[row.cells.length - 1]?.state === 'none' && (
                          <a
                            className="ml-2 inline-flex items-center gap-1 text-primary underline"
                            target="_blank"
                            rel="noreferrer"
                            href={whatsappLink(phoneOf(row.engineer_user_id), `Hello ${row.engineer} — there is no site report for ${row.villa} today yet. Could you log one?`)}
                          >
                            <MessageCircle className="h-3 w-3" aria-hidden /> Chase
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Engineer</th><th className="px-2 font-medium">Villas</th><th className="px-2 font-medium">Open</th>
                    <th className="px-2 font-medium">Overdue</th><th className="px-2 font-medium">Blocked</th><th className="px-2 font-medium">Not updated</th><th className="px-2 font-medium">Reports today</th>
                  </tr>
                </thead>
                <tbody>
                  {data.team.map((t) => (
                    <tr key={t.user_id || t.name} className="border-t border-border">
                      <td className="py-1.5 pr-3 font-medium">{t.name}</td>
                      <td className="px-2 tnum">{t.villas}</td><td className="px-2 tnum">{t.open}</td>
                      <td className={cn('px-2 tnum', t.overdue && 'font-semibold text-destructive')}>{t.overdue}</td>
                      <td className="px-2 tnum">{t.blocked}</td>
                      <td className={cn('px-2 tnum', t.stale && 'font-semibold text-[hsl(var(--warning))]')}>{t.stale}</td>
                      <td className="px-2 tnum">{t.reports_today}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DataState>
    </section>
  );
}
