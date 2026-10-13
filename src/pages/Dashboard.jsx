import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayIst } from '@/lib/format';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { loadDashboard } from '@/lib/dashboardService';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import StatTile from '@/components/common/StatTile';
import ProgressNote from '@/components/common/ProgressNote';
import DataCaveats from '@/components/common/DataCaveats';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import PriorityList from '@/components/dashboard/PriorityList';
import HeadlineTiles from '@/components/dashboard/HeadlineTiles';
import PhaseHealthStrip from '@/components/dashboard/PhaseHealthStrip';
import DelayCauses from '@/components/dashboard/DelayCauses';
import { saveHomePreference } from '@/lib/navigation';
import TaskDrilldownDialog from '@/components/dashboard/TaskDrilldownDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import ShareMenu from '@/components/common/ShareMenu';
import NoProjectState from '@/components/common/NoProjectState';

const ACTORS = ['Contractor', 'DVG', 'Villa owner'];

/** The priority list split by who has to act: the contractor, DVG or the villa owner. */
function PriorityGroups({ rows }) {
  const [actor, setActor] = React.useState('');
  const counts = Object.fromEntries(ACTORS.map((a) => [a, rows.filter((r) => r.act_by === a).length]));
  const shown = actor ? rows.filter((r) => r.act_by === actor) : rows;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant={actor === '' ? 'default' : 'outline'} onClick={() => setActor('')}>Everyone · {rows.length}</Button>
        {ACTORS.map((a) => (
          <Button key={a} size="sm" variant={actor === a ? 'default' : 'outline'} onClick={() => setActor(a)}>{a} · {counts[a]}</Button>
        ))}
      </div>
      <PriorityList rows={shown} />
    </div>
  );
}

/**
 * Stage A / 2 — Executive portfolio dashboard.
 *
 * Every figure is computed on the server from records for the chosen reporting
 * date. Each one opens the tasks behind it. Nothing here invents a percentage:
 * completion appears only when measured progress is complete.
 */
export default function Dashboard() {
  const cat = useCatalogs();
  const access = useAccess();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [date, setDate] = useState(todayIst());
  const [includeDemo, setIncludeDemo] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drill, setDrill] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    setLoading(true);
    setError('');
    loadDashboard('executive', { projectId, phaseId, date, includeDemo })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Could not load the dashboard.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, phaseId, date, includeDemo, refresh]);

  // The executive payload omits demo-only figures, so the switch is validated
  // against the project's own access rules rather than a page-local guess.
  const phases = projectId ? cat.phasesFor(projectId) : [];
  const filters = useMemo(() => ({ projectId, phaseId, date, includeDemo }), [projectId, phaseId, date, includeDemo]);
  const metrics = data?.metrics || {};
  const inventory = data?.inventory || {};

  const open = (metric, title, description) => setDrill({ filters: { ...filters, metric }, title, description });

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <NoProjectState icon={LayoutDashboard} description="The portfolio dashboard appears once you are a member of a project." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Executive overview"
        title="Overview"
        description="Villas, outstanding works, delays and blockers for the reporting date you choose. Every figure opens the records behind it."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRefresh((n) => n + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <ShareMenu
              title="Overview"
              text={() => [
                `DVG overview — ${date}`,
                `Open tasks: ${metrics.open_tasks ?? 0}`, `Overdue: ${metrics.overdue_tasks ?? 0}`, `Blocked: ${metrics.blocked_tasks ?? 0}`,
                `Due in 7 days: ${metrics.due_within_7 ?? 0}`, `Awaiting verification: ${metrics.awaiting_verification ?? 0}`,
                `Handed-over villas with open works: ${metrics.handed_over_open_works ?? 0} (${metrics.handed_over_open_tasks ?? 0} tasks)`,
              ].join('\n')}
            />
            <Button asChild size="sm" variant="outline">
              <Link to="/planning">Planning</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => saveHomePreference('overview')} title="Open the Overview when I sign in">Make this my home</Button>
          </>
        }
      />

      <DashboardFilters
        projects={cat.projects}
        phases={phases}
        projectId={projectId}
        phaseId={phaseId}
        date={date}
        includeDemo={includeDemo}
        canUseDemo={access.appAdmin}
        onProject={(value) => {
          setProjectId(value);
          setPhaseId('');
        }}
        onPhase={setPhaseId}
        onDate={setDate}
        onIncludeDemo={setIncludeDemo}
      />

      {loading ? (
        <Skeleton className="mt-5 h-96 rounded-xl" />
      ) : error ? (
        <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <DataCaveats items={data.warnings} tone={metrics.demo_view ? 'warning' : 'info'} />

          <HeadlineTiles metrics={metrics} change={data.change_since_last_week} onOpen={open} />

          <button
            type="button"
            onClick={() => open('handed_over_open_works', 'Handed-over villas with open works', 'Possession is handed over but construction work is still open on these villas.')}
            className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950 transition-colors hover:bg-amber-100"
          >
            <span className="font-semibold">Handed over with open works:</span>{' '}
            {metrics.handed_over_open_works ?? 0} villa{metrics.handed_over_open_works === 1 ? '' : 's'}, {metrics.handed_over_open_tasks ?? 0} task{metrics.handed_over_open_tasks === 1 ? '' : 's'}, {metrics.handed_over_waiting_on_owner ?? 0} waiting on owner access.
            <span className="ml-2 text-xs underline">Open the villas</span>
          </button>

          <BoardSection title="Phase health" description="Red, amber or green per phase, from the same counts as the tiles above." dense>
            <PhaseHealthStrip phases={data.phase_health || []} />
          </BoardSection>

          <BoardSection
            title="What to push, and who must act"
            description="Ranked from recorded facts: delay, blockage and priority. Grouped by who has to move."
          >
            <PriorityGroups rows={data.priorities || []} />
          </BoardSection>

          <BoardSection title="Why forecasts moved" description="Delay causes, counted from the category chosen with every forecast change." dense>
            <DelayCauses causes={data.delay_causes || []} />
          </BoardSection>

          <details className="rounded-xl border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Data details — inventory, every count and completion
            </summary>
            <div className="space-y-5 p-4">
          <BoardSection
            title="Villa and unit inventory"
            description="Registered units, what is active, what is on hold, and villas already handed over that still carry open works."
            dense
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Registered villas / units" value={inventory.registered ?? 0} />
              <StatTile label="Active villas" value={inventory.active ?? 0} />
              <StatTile label="Villas on hold" value={inventory.on_hold ?? 0} hint="In inventory, held out of active execution figures" />
              <StatTile label="Handed over" value={inventory.handed_over ?? 0} />
              <StatTile
                label="Handed over with open works"
                value={metrics.handed_over_open_works ?? 0}
                tone={metrics.handed_over_open_works ? 'warning' : 'default'}
                onClick={() => open('handed_over_open_works', 'Handed-over villas with open works', 'Possession is handed over but construction work is still open on these villas.')}
              />
            </div>
          </BoardSection>

          <BoardSection
            title="Works summary"
            description={`Counts as at ${data.as_of}. Click any figure to open the tasks.`}
            dense
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Open construction tasks" value={metrics.open_tasks ?? 0} onClick={() => open('open', 'Open construction tasks', 'Every task that is not closed.')} />
              <StatTile label="Overdue tasks" value={metrics.overdue_tasks ?? 0} tone="danger" onClick={() => open('overdue', 'Overdue tasks', 'Still to be executed, with the finish date already passed.')} />
              <StatTile label="Blocked tasks" value={metrics.blocked_tasks ?? 0} tone="danger" onClick={() => open('blocked', 'Blocked tasks', 'Marked Blocked on site.')} />
              <StatTile label="Awaiting verification" value={metrics.awaiting_verification ?? 0} tone="warning" onClick={() => open('awaiting_verification', 'Tasks awaiting verification', 'Execution complete or under inspection — awaiting a decision, not overdue.')} />
              <StatTile label="Approved — awaiting closure" value={metrics.awaiting_closure ?? 0} onClick={() => open('awaiting_closure', 'Approved tasks awaiting closure', 'Verified work that has not been closed on the register.')} />
              <StatTile label="Due within 7 days" value={metrics.due_within_7 ?? 0} onClick={() => open('due_7', 'Due within 7 days', 'Still to be executed and finishing within the next seven days.')} />
              <StatTile label="Due within 14 days" value={metrics.due_within_14 ?? 0} onClick={() => open('due_14', 'Due within 14 days', 'Still to be executed and finishing within the next fourteen days.')} />
              <StatTile label="Unscheduled tasks" value={metrics.unscheduled_tasks ?? 0} tone={metrics.unscheduled_tasks ? 'warning' : 'default'} onClick={() => open('unscheduled', 'Unscheduled tasks', 'Outstanding work with neither a baseline nor a forecast finish date.')} />
              <StatTile label="Site-wide open works" value={metrics.site_wide_open ?? 0} onClick={() => open('site_wide', 'Site-wide open works', 'Common infrastructure and common-area work.')} />
              <StatTile label="Villa work assignments" value={metrics.villa_work_assignments ?? 0} hint="Holding rows — their children are counted, never the parent" />
              <StatTile label="Children of villa assignments" value={metrics.villa_work_children ?? 0} />
              <StatTile label="Demo records held out" value={metrics.demo_tasks_excluded ?? 0} hint={access.appAdmin ? 'Switch the demo view on to include them' : 'Test data, excluded from management figures'} />
            </div>
            {(metrics.held_open_tasks > 0 || metrics.held_overdue_tasks > 0) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <StatTile label="Open works on held villas" value={metrics.held_open_tasks ?? 0} hint="Reported separately, not in the active figures" onClick={() => open('held', 'Open works on villas on hold', 'These villas stay in inventory; their work is excluded from active execution figures.')} />
                <StatTile label="Overdue on held villas" value={metrics.held_overdue_tasks ?? 0} />
                <StatTile label="Blocked on held villas" value={metrics.held_blocked_tasks ?? 0} />
              </div>
            )}
          </BoardSection>

          <div className="grid gap-5 lg:grid-cols-3">
            <ProgressNote progress={data.progress} counts={data.counts_by_status} className="lg:col-span-1" />
            <BoardSection
              title="By discipline"
              description="Open, overdue and blocked counts per discipline. A completion figure appears only when every outstanding task in that discipline is measured."
              className="lg:col-span-2"
              dense
            >
              {(data.counts_by_discipline || []).length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">No outstanding work recorded for this scope.</p>
              ) : (
                <div className="scroll-slim overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 text-left">Discipline</th>
                        <th className="py-2 text-left">Open</th>
                        <th className="py-2 text-left">Overdue</th>
                        <th className="py-2 text-left">Blocked</th>
                        <th className="py-2 text-left">Awaiting verification</th>
                        <th className="py-2 text-left">Measured completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.counts_by_discipline.map((row) => (
                        <tr key={row.discipline} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 font-medium">{row.discipline_name}</td>
                          <td className="field-mono py-2.5 tnum">{row.open}</td>
                          <td className="field-mono py-2.5 tnum">{row.overdue}</td>
                          <td className="field-mono py-2.5 tnum">{row.blocked}</td>
                          <td className="field-mono py-2.5 tnum">{row.awaitingVerification}</td>
                          <td className="py-2.5 text-xs text-muted-foreground">
                            {row.progress?.reliable ? (
                              <span className="field-mono text-foreground">{row.progress.percent}%</span>
                            ) : (
                              <span>{row.progress?.reason || 'Not yet measured'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </BoardSection>
          </div>

            </div>
          </details>

          {Object.keys(data.counts_by_status || {}).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Status breakdown for this scope: {data.counts_by_status.executing} executing · {data.counts_by_status.awaitingVerification} awaiting verification ·{' '}
              {data.counts_by_status.awaitingClosure} approved · {data.counts_by_status.closed} closed of {data.counts_by_status.total} tasks.
            </p>
          )}
        </div>
      )}

      <TaskDrilldownDialog
        open={!!drill}
        onOpenChange={(value) => !value && setDrill(null)}
        title={drill?.title || ''}
        description={drill?.description}
        filters={drill?.filters}
      />
    </>
  );
}