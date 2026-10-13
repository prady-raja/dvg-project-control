import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, ClipboardCheck, HandHelping, Sparkles, Sun, TriangleAlert } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { useAuth } from '@/lib/AuthContext';
import { formatDate, todayIst } from '@/lib/format';
import { queryKeys } from '@/lib/queries/keys';
import { saveHomePreference } from '@/lib/navigation';
import { useDashboardQuery } from '@/hooks/useDashboardQuery';
import PageHeader from '@/components/common/PageHeader';
import DataState from '@/components/common/DataState';
import StatTile from '@/components/common/StatTile';
import StatusPill from '@/components/common/StatusPill';
import HealthBadge from '@/components/common/HealthBadge';
import EnumSelect from '@/components/common/EnumSelect';
import BoardSection from '@/components/common/BoardSection';
import { Button } from '@/components/ui/button';
import { useQuickActions } from '@/components/layout/QuickActions';
import { cn } from '@/lib/utils';
import NoProjectState from '@/components/common/NoProjectState';
import { useScopeState } from '@/lib/ScopeContext';

const REASON_TONE = {
  overdue: 'border-red-300 bg-red-50 text-red-800',
  blocked: 'border-red-300 bg-red-50 text-red-800',
  due: 'border-amber-300 bg-amber-50 text-amber-900',
  stale: 'border-amber-300 bg-amber-50 text-amber-900',
  verify: 'border-slate-300 bg-slate-50 text-slate-700',
};

function TaskCardRow({ row, quick }) {
  const blocked = row.status === 'Blocked' || row.reasons.some((r) => r.code === 'blocked');
  const waiting = ['Execution Complete', 'Under Inspection', 'Approved'].includes(row.status);
  return (
    <li className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/tasks/${row.id}`} className="field-mono text-xs font-semibold text-muted-foreground hover:underline">{row.ref} · {row.villa}</Link>
          <p className="mt-0.5 text-sm font-medium leading-snug">{row.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={row.status} />
          {row.health && <HealthBadge health={row.health} slipDays={row.slip_days} />}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {row.reasons.map((r) => (
          <span key={r.code} className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', REASON_TONE[r.code])}>{r.label}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{row.action}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!waiting && <Button size="sm" onClick={() => quick.openLogUpdate({ taskId: row.id })}>Update</Button>}
        {blocked && <Button size="sm" variant="outline" onClick={() => quick.openBlocker({ ...row, status: 'Blocked' })}>Unblock</Button>}
        {!blocked && !waiting && <Button size="sm" variant="outline" onClick={() => quick.openBlocker(row)}>Block</Button>}
        {waiting && <Button asChild size="sm" variant="outline"><Link to={`/tasks/${row.id}`}>Inspect</Link></Button>}
      </div>
    </li>
  );
}

/**
 * Today (N-02): the work that is mine, on one screen — my villas and whether they
 * have been reported today, what is overdue, blocked or going stale, yesterday's
 * plan, commitments due or missed, snags to re-inspect and AI proposals waiting.
 * Coordinators can switch to all villas to see today's report coverage.
 */
export default function Today() {
  const cat = useCatalogs();
  const access = useAccess();
  const { user } = useAuth();
  const quick = useQuickActions();
  const [projectId, setProjectId] = useScopeState();
  const [all, setAll] = useState(false);
  const asOf = todayIst();

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects.find((p) => p.status === 'Active')?.id || cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  const canSeeAll = projectId ? access.can(projectId, 'manage_project') : false;
  const params = { projectId, date: asOf, allVillas: all && canSeeAll };
  const { data, isLoading, error, refetch } = useDashboardQuery('myWork', params, { key: queryKeys.myWork(params), enabled: !!projectId });

  if (cat.loading) return <DataState loading />;
  if (!cat.projects.length) return <NoProjectState icon={Sun} description="Today appears once you are a member of a project." />;

  const view = data;
  const counts = view?.counts || {};
  const first = (user?.full_name || '').split(' ')[0];

  return (
    <>
      <PageHeader
        eyebrow={formatDate(asOf)}
        title={`Today${first ? `, ${first}` : ''}`}
        description={all && canSeeAll ? 'All villas: report coverage and what needs chasing.' : 'Your villas and the work that needs you.'}
        actions={
          <>
            {cat.projects.length > 1 && (
              <div className="w-44">
                <EnumSelect value={projectId} onChange={setProjectId} options={cat.projects.map((p) => ({ value: p.id, label: p.name }))} />
              </div>
            )}
            {canSeeAll && (
              <Button size="sm" variant={all ? 'default' : 'outline'} onClick={() => setAll((v) => !v)}>
                {all ? 'My work' : 'All villas'}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => saveHomePreference('today')} title="Open Today when I sign in">Make this my home</Button>
          </>
        }
      />

      <DataState loading={isLoading} error={error ? error.message : ''} onRetry={refetch} rows={5}>
        {view && (
          <div className="space-y-6">
            {view.headline && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Overdue" value={view.headline.overdue} tone={view.headline.overdue ? 'danger' : 'default'} />
                <StatTile label="At risk" value={view.headline.at_risk} tone={view.headline.at_risk ? 'warning' : 'default'} />
                <StatTile label="Blocked" value={view.headline.blocked} tone={view.headline.blocked ? 'danger' : 'default'} />
                <StatTile label="Awaiting verification" value={view.headline.awaiting_verification} />
              </div>
            )}

            {view.coverage && (
              <BoardSection title="Reports today" description={`${view.coverage.reported} of ${view.coverage.villas} villas have a report today.`}>
                {view.coverage.not_reported.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Every villa has been reported on today.</p>
                ) : (
                  <p className="text-sm"><span className="text-muted-foreground">Not yet reported: </span>{view.coverage.not_reported.join(', ')}</p>
                )}
              </BoardSection>
            )}

            <section aria-label="My villas">
              <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{all ? 'Villas' : 'My villas'}</h2>
              {view.villas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No villa is assigned to you yet. Ask the coordinator to assign your villas or tasks.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {view.villas.map((v) => (
                    <div key={v.id} className={cn('min-w-[150px] rounded-xl border p-3', v.reported_today ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50')}>
                      <Link to={`/locations/${v.id}`} className="text-sm font-semibold hover:underline">{v.code}</Link>
                      <p className="mt-0.5 text-xs">{v.reported_today ? (v.reported_by_me ? 'You reported today' : 'Reported today') : 'Not reported today'}</p>
                      <p className="text-xs text-muted-foreground">{v.open} open{v.overdue ? ` · ${v.overdue} overdue` : ''}{v.blocked ? ` · ${v.blocked} blocked` : ''}</p>
                      {!v.reported_today && quick.canReport && (
                        <div className="mt-2 flex gap-1.5">
                          <Button size="sm" className="h-9 flex-1" onClick={() => quick.openLogUpdate({ locationId: v.id })}>Log update</Button>
                          <Button size="sm" variant="outline" className="h-9 flex-1" onClick={() => quick.openDaySheet({ locationId: v.id })}>Day sheet</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-label="Needs you">
              <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {all ? 'Needs attention' : 'Needs you'} · {counts.tasks || 0}
              </h2>
              {view.tasks.length === 0 ? (
                <p className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Nothing overdue, blocked or going stale.</p>
              ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {view.tasks.slice(0, all ? 12 : 30).map((row) => <TaskCardRow key={row.id} row={row} quick={quick} />)}
                </ul>
              )}
              {view.tasks.length > 12 && all && <Button asChild variant="link" className="px-0"><Link to="/attention">Open Needs attention</Link></Button>}
            </section>

            {view.plan.length > 0 && (
              <BoardSection title="Today's plan" description={`What was planned for today in the reports of ${formatDate(view.plan_day)}.`} dense>
                <ul className="divide-y divide-border">
                  {view.plan.map((p) => (
                    <li key={p.id} className="py-2 text-sm">
                      <span className="field-mono text-xs text-muted-foreground">{p.task_ref} · {p.villa}</span>
                      <p>{p.plan}</p>
                    </li>
                  ))}
                </ul>
              </BoardSection>
            )}

            {view.commitments.length > 0 && (
              <BoardSection title="Commitments due or missed" description="Promised in meetings and still open." dense>
                <ul className="divide-y divide-border">
                  {view.commitments.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span><HandHelping className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />{c.commitment}<span className="block text-xs text-muted-foreground">{c.contractor || c.person}{c.task_ref ? ` · ${c.task_ref}` : ''}</span></span>
                      <span className={cn('field-mono shrink-0 text-xs', c.missed ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{c.missed ? 'missed ' : 'due '}{formatDate(c.promised_date)}</span>
                    </li>
                  ))}
                </ul>
              </BoardSection>
            )}

            {view.snags.length > 0 && (
              <BoardSection title="Snags to re-inspect" description="Marked fixed — waiting for you to check." dense>
                <ul className="divide-y divide-border">
                  {view.snags.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span><TriangleAlert className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />{s.title}<span className="block text-xs text-muted-foreground">{s.snag_ref} · {s.villa}{s.area_label ? ` · ${s.area_label}` : ''}</span></span>
                      <Button asChild size="sm" variant="outline"><Link to="/handover">Reinspect</Link></Button>
                    </li>
                  ))}
                </ul>
              </BoardSection>
            )}

            {view.proposals.length > 0 && (
              <BoardSection title="Waiting for your confirmation" description="Updates the assistant read from your messages. Nothing is written until you confirm." dense>
                <ul className="divide-y divide-border">
                  {view.proposals.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span><Sparkles className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />{p.message}<span className="block text-xs text-muted-foreground">{p.actions} proposed change{p.actions === 1 ? '' : 's'}</span></span>
                      <Button asChild size="sm" variant="outline"><Link to="/ai">Review</Link></Button>
                    </li>
                  ))}
                </ul>
              </BoardSection>
            )}

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Data as of {formatDate(view.as_of)}. <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
              <Link to="/attention" className="underline">Needs attention</Link>
            </p>
          </div>
        )}
      </DataState>
    </>
  );
}
