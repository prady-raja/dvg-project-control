import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { loadDashboard } from '@/lib/dashboardService';
import { todayIst } from '@/lib/format';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import StatTile from '@/components/common/StatTile';
import DataCaveats from '@/components/common/DataCaveats';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import BlockerTable from '@/components/blockers/BlockerTable';
import BlockerOwnerGroups from '@/components/blockers/BlockerOwnerGroups';
import { useInvalidateWork } from '@/hooks/useDashboardQuery';
import DependencyChain from '@/components/blockers/DependencyChain';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import TaskDrilldownDialog from '@/components/dashboard/TaskDrilldownDialog';
import { ACTIVITY_COLUMNS } from '@/lib/reportExport';
import ShareMenu from '@/components/common/ShareMenu';
import NoProjectState from '@/components/common/NoProjectState';

/** Stage A / 6 — Blockers and dependency chains. */
export default function BlockerBoard() {
  const cat = useCatalogs();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [date, setDate] = useState(todayIst());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drill, setDrill] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const invalidateWork = useInvalidateWork();
  const changed = async () => {
    await invalidateWork();
    setRefresh((n) => n + 1);
  };

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    loadDashboard('blockers', { projectId, phaseId, date })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Could not load blockers.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, phaseId, date, refresh]);

  const counts = data?.counts || {};
  const phases = projectId ? cat.phasesFor(projectId) : [];

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <NoProjectState icon={ShieldAlert} description="Blockers appear once you are a member of a project." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Constraints"
        title="Blockers & dependencies"
        description="What is stopping work, how long it has been stopped, and which recorded dependencies sit downstream of it."
        actions={
          <>
            <ShareMenu
              title="Blockers"
              filename="blockers"
              rows={data?.rows || []}
              columns={ACTIVITY_COLUMNS}
              text={() => {
                const list = data?.rows || [];
                return [`DVG blockers (${list.length})`, ...list.slice(0, 25).map((r) => `• ${r.ref} ${r.villa || ''} ${r.name || ''} — ${r.blocker || 'no reason recorded'}`.trim()), list.length > 25 ? `…and ${list.length - 25} more` : ''].filter(Boolean).join('\n');
              }}
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRefresh((n) => n + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      <DashboardFilters
        projects={cat.projects}
        phases={phases}
        projectId={projectId}
        phaseId={phaseId}
        date={date}
        onProject={(value) => {
          setProjectId(value);
          setPhaseId('');
        }}
        onPhase={setPhaseId}
        onDate={setDate}
      />

      {loading ? (
        <Skeleton className="mt-5 h-96 rounded-xl" />
      ) : error ? (
        <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <DataCaveats items={data.warnings} tone={counts.dependency_links ? 'info' : 'warning'} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Marked Blocked" value={counts.blocked ?? 0} tone="danger" onClick={() => setDrill({ metric: 'blocked', title: 'Tasks marked Blocked' })} />
            <StatTile label="With a blocker recorded" value={counts.with_blocker_recorded ?? 0} />
            <StatTile label="Blocked by another party" value={counts.blocked_by_another_party ?? 0} hint="Responsible party differs from the assigned contractor" />
            <StatTile label="Overdue and blocked" value={counts.overdue_and_blocked ?? 0} tone="danger" />
            <StatTile label="Past the date owners gave" value={counts.past_due ?? counts.resolution_overdue ?? 0} tone="warning" />
            <StatTile label="No owner or date" value={counts.without_owner ?? 0} hint="Cannot be chased until someone owns it" />
            <StatTile label="Recorded dependency links" value={counts.dependency_links ?? 0} />
            <StatTile label="Holding up other work" value={counts.tasks_with_downstream ?? 0} />
            <StatTile
              label="No dates recorded"
              value={(data.rows || []).filter((row) => !row.finish).length}
              hint="Scheduling impact cannot be judged"
            />
          </div>

          {!!(data.by_category || []).length && (
            <div className="flex flex-wrap gap-2">
              {data.by_category.map((row) => (
                <span key={row.category} className="rounded-full border border-border px-3 py-1.5 text-xs">
                  {row.category} · {row.count}
                </span>
              ))}
            </div>
          )}

          <BoardSection
            title="Who must clear them"
            description="Blockers grouped by owner, those past their date first. Owner-access blockers are grouped by villa."
          >
            <BlockerOwnerGroups groups={data.by_owner || []} onChanged={changed} />
          </BoardSection>

          <BoardSection
            title="Blocker register"
            description="Each line is a real task record. The responsible party is whoever is recorded against it, not an assumption."
          >
            <BlockerTable rows={data.rows || []} />
          </BoardSection>

          <BoardSection
            title="Dependency chains"
            description="Drawn only from recorded TaskDependency links between tasks you can see."
          >
            {(data.chains || []).length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No chain can be drawn: either no blocker is holding up a recorded successor, or no dependency links are recorded for this scope.
                Scheduling impact is therefore unknown rather than zero.
              </p>
            ) : (
              <div className="space-y-3">
                {data.chains.map((chain) => (
                  <DependencyChain key={chain.root.id || chain.root.ref} chain={chain} />
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              The critical path is deliberately not claimed: it cannot be determined from dates alone while task durations and
              dependencies are incomplete. <Link to="/tasks" className="underline">Open the task register</Link> to record a dependency.
            </p>
          </BoardSection>
        </div>
      )}

      <TaskDrilldownDialog
        open={!!drill}
        onOpenChange={(value) => !value && setDrill(null)}
        title={drill?.title || ''}
        filters={{ projectId, phaseId, date, metric: drill?.metric }}
      />
    </>
  );
}