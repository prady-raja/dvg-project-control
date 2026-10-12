import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, ClipboardCheck, Plus, ShieldAlert } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { useQuickActions } from '@/components/layout/QuickActions';
import { loadDashboard } from '@/lib/dashboardService';
import { todayIst } from '@/lib/format';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import StatTile from '@/components/common/StatTile';
import DataCaveats from '@/components/common/DataCaveats';
import DetailList from '@/components/common/DetailList';
import Pill from '@/components/common/Pill';
import ProgressNote from '@/components/common/ProgressNote';
import ActivityRows from '@/components/common/ActivityRows';
import DisciplineSection from '@/components/villa/DisciplineSection';
import SnagList from '@/components/handover/SnagList';
import ProgressMeter from '@/components/tasks/ProgressMeter';
import DailyUpdateFeed from '@/components/daily/DailyUpdateFeed';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { updateSnag } from '@/lib/snagService';
import { useToast } from '@/components/ui/use-toast';

/** Stage A / 3 — the execution dashboard for one physical villa. */
export default function VillaExecution() {
  const { locationId } = useParams();
  const cat = useCatalogs();
  const access = useAccess();
  const navigate = useNavigate();
  const quick = useQuickActions();
  const [date, setDate] = useState(todayIst());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!locationId) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    loadDashboard('villa', { locationId, date })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Could not load this villa.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locationId, date, refresh, quick.version]);

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Villa not available</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/locations">Back to villas &amp; locations</Link>
        </Button>
      </div>
    );
  }

  if (loading || !data) return <Skeleton className="h-96 rounded-xl" />;

  const villa = data.villa;
  const canEdit = access.can(villa.project_id, 'edit_tasks');
  const counts = data.counts || {};

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5 text-muted-foreground">
        <Link to={`/locations/${villa.id}`}>
          <ArrowLeft className="h-4 w-4" /> Villa record
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${villa.project} · ${villa.phase} · Execution dashboard`}
        title={villa.code}
        description={`Figures as at ${data.as_of}. Completion is shown only where measured progress exists for every outstanding task.`}
        actions={
          <>
            <Pill value={villa.possession_status} />
            <Pill value={villa.active_status} />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRefresh((n) => n + 1)}>Refresh</Button>
            {canEdit && (
              <Button size="sm" className="gap-2" onClick={() => quick.openLogUpdate({ locationId })}>
                <CalendarCheck className="h-4 w-4" /> Log update
              </Button>
            )}
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <DetailList
          columns={3}
          items={[
            { label: 'Original plot references', value: villa.plot_numbers || 'Not recorded' },
            { label: 'Possession status', value: <Pill value={villa.possession_status} /> },
            { label: 'Possession date', value: formatDate(villa.possession_date), mono: true },
            { label: 'Construction works status', value: <Pill value={villa.works_stage} /> },
            { label: 'Assigned engineer', value: villa.assigned_engineer || 'Not assigned' },
            { label: 'Planned completion', value: formatDate(villa.planned_completion_date), mono: true },
          ]}
        />
      </div>

      {villa.on_hold && (
        <p className="mt-4 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 px-4 py-3 text-sm text-muted-foreground">
          This villa is on hold. It stays in inventory and everything recorded here stays visible, but its work is excluded from the
          project's active execution figures.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Outstanding tasks" value={counts.open ?? 0} />
        <StatTile label="Overdue" value={counts.overdue ?? 0} tone={counts.overdue ? 'danger' : 'default'} />
        <StatTile label="Blocked" value={counts.blocked ?? 0} tone={counts.blocked ? 'danger' : 'default'} />
        <StatTile label="Awaiting verification" value={counts.awaitingVerification ?? 0} tone={counts.awaitingVerification ? 'warning' : 'default'} />
        <StatTile label="Awaiting closure" value={counts.awaitingClosure ?? 0} />
        <StatTile label="Without dates" value={counts.unscheduled ?? 0} tone={counts.unscheduled ? 'warning' : 'default'} />
        <StatTile label="Open snags" value={data.snags?.open ?? 0} tone={data.snags?.open ? 'warning' : 'default'} />
        <StatTile label="Recorded dependency links" value={data.dependency_count ?? 0} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ProgressNote progress={data.progress} counts={counts} label="Villa completion" />
        <BoardSection title="Contractor assignments" className="lg:col-span-2" dense>
          {(data.contractors || []).length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">No contractor assigned to work on this villa yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.contractors.map((row) => (
                <div key={row.contractor_id || 'unassigned'} className="rounded-lg border border-border px-4 py-3">
                  <p className="text-sm font-medium">{row.contractor}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.open} open · {row.overdue} overdue · {row.blocked} blocked · {row.awaitingVerification} awaiting verification
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.progress?.reliable ? `Measured ${row.progress.percent}%` : row.progress?.reason || 'Not yet measured'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </BoardSection>
      </div>

      <BoardSection
        title="Progress by discipline"
        description="Civil, Finishes, Electrical, Plumbing, HVAC, Automation, Swimming Pool, Irrigation, External Works, Testing & Snagging — plus any discipline this project adds."
        className="mt-5"
      >
        <div className="space-y-4">
          {(data.disciplines || []).length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">No task recorded against this villa yet.</p>
          ) : (
            data.disciplines.map((group) => (
              <DisciplineSection
                key={group.discipline}
                group={group}
                onTask={(row) => (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/tasks/${row.id}`)}>Open</Button>
                )}
              />
            ))
          )}
        </div>
      </BoardSection>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <BoardSection title="Open blockers" description="Blockers recorded against this villa's work.">
          <ActivityRows rows={data.blockers} emptyLabel="No blocker recorded for this villa." />
        </BoardSection>
        <BoardSection title="Overdue activities">
          <ActivityRows rows={data.overdue} emptyLabel="Nothing is overdue on this villa." />
        </BoardSection>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <BoardSection title="Work scheduled this week" description="Still to be executed, finishing within the next seven days.">
          <ActivityRows rows={data.this_week} emptyLabel="Nothing scheduled in the next seven days." />
        </BoardSection>
        <div className="space-y-5">
          <BoardSection title="Awaiting inspection or approval">
            {[...(data.awaiting_verification || []), ...(data.awaiting_closure || [])].length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nothing is waiting on a decision.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...(data.awaiting_verification || []), ...(data.awaiting_closure || [])].map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                    <span>
                      <Link to={`/tasks/${row.id}`} className="field-mono text-xs font-semibold hover:underline">{row.ref}</Link>
                      <span className="ml-2">{row.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill value={row.status} />
                      <ProgressMeter value={row.progress} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </BoardSection>
          <BoardSection
            title="Snags"
            description="Tracked separately from tasks. Photographs are optional."
            actions={
              <Button asChild size="sm" variant="ghost">
                <Link to="/handover">Handover board</Link>
              </Button>
            }
          >
            <SnagList
              rows={data.snags?.rows || []}
              canEdit={canEdit}
              emptyLabel="No snag recorded against this villa."
              onAdvance={async (row, patch) => {
                try {
                  await updateSnag(row.id, patch);
                  setRefresh((n) => n + 1);
                } catch (e) {
                  toast({ description: e?.message || 'Could not update the snag.', variant: 'destructive' });
                }
              }}
            />
          </BoardSection>
        </div>
      </div>

      <BoardSection
        title="Latest daily site updates"
        description="Every report filed for this villa, newest first, with any photographs — nothing is overwritten."
        className="mt-5"
        actions={
          canEdit && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => quick.openLogUpdate({ locationId })}>
              <Plus className="h-4 w-4" /> Log update
            </Button>
          )
        }
      >
        <DailyUpdateFeed
          key={refresh}
          filter={{ location_id: villa.id }}
          hideVilla
          emptyTitle="No daily update for this villa yet"
          emptyDescription="Log an update from the field and it appears here with the engineer, the time and any photos."
        />
      </BoardSection>

      {counts.unscheduled > 0 && (
        <BoardSection title="Without dates" className="mt-5" description="Outstanding work that cannot appear in a look-ahead until a date is set.">
          <ActivityRows rows={data.unscheduled} />
        </BoardSection>
      )}

      <div className="mt-5">
        <DataCaveats
          items={[
            data.progress?.reliable
              ? `Completion is measured: ${data.progress.measured} of ${data.progress.total} outstanding tasks carry progress, weighted by ${data.progress.basis?.toLowerCase()}.`
              : `${data.progress?.reason || 'Progress has not been measured for this villa'} — status counts are shown instead of a completion score.`,
            'Quantity progress is shown per task where both the planned and completed quantities exist.',
          ]}
        />
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" /> Possession and works completion are independent: handing over a villa never closes work.
      </p>



      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <ClipboardCheck className="h-3.5 w-3.5" />
        <Link to={`/locations/${villa.id}`} className="underline">Open the villa record</Link> for its register and history.
      </p>
    </>
  );
}