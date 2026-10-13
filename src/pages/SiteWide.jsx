import React, { useEffect, useState } from 'react';
import { HardHat, RefreshCw } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { loadDashboard } from '@/lib/dashboardService';
import { todayIst } from '@/lib/format';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import StatTile from '@/components/common/StatTile';
import DataCaveats from '@/components/common/DataCaveats';
import ActivityRows from '@/components/common/ActivityRows';
import ProgressNote from '@/components/common/ProgressNote';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import NoProjectState from '@/components/common/NoProjectState';

/** Stage A / 9 — common infrastructure and site-wide works. */
export default function SiteWide() {
  const cat = useCatalogs();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [date, setDate] = useState(todayIst());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

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
    loadDashboard('sitewide', { projectId, phaseId, date })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Could not load site-wide works.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, phaseId, date, refresh]);

  const phases = projectId ? cat.phasesFor(projectId) : [];
  const counts = data?.counts || {};

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <NoProjectState icon={HardHat} description="Site-wide works appear once you are a member of a project." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Common works"
        title="Infrastructure & site-wide works"
        description="Roads, main gate, utilities, common drainage, landscaping and authority works — reported separately from villa work while still counting towards project totals."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setRefresh((n) => n + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
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
          <DataCaveats items={data.warnings} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Open site-wide works" value={counts.open ?? 0} />
            <StatTile label="Overdue" value={counts.overdue ?? 0} tone={counts.overdue ? 'danger' : 'default'} />
            <StatTile label="Blocked" value={counts.blocked ?? 0} tone={counts.blocked ? 'danger' : 'default'} />
            <StatTile label="Due within 7 days" value={counts.due_7 ?? 0} />
            <StatTile label="Without dates" value={counts.unscheduled ?? 0} tone={counts.unscheduled ? 'warning' : 'default'} />
            <StatTile label="Not tied to a common area" value={counts.unassigned_area ?? 0} hint="Recorded as site-wide with no area" />
          </div>

          <BoardSection title="Areas covered" description="Common areas and infrastructure recorded against this work.">
            {(data.areas || []).length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-muted-foreground">No site-wide work recorded for this scope.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.areas.map((area) => (
                  <span key={area} className="rounded-full border border-border px-3 py-1.5 text-xs">{area}</span>
                ))}
              </div>
            )}
          </BoardSection>

          {!loading && !(data.groups || []).length ? (
            <BoardSection title="By discipline">
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">No open site-wide work in this scope.</p>
            </BoardSection>
          ) : (
            (data.groups || []).map((group) => (
              <BoardSection
                key={group.discipline}
                title={group.discipline_name}
                description={`${group.counts.open} open · ${group.overdue} overdue · ${group.blocked} blocked · ${group.awaiting_verification} awaiting verification`}
              >
                <div className="mb-4 grid gap-3 lg:grid-cols-3">
                  <ProgressNote progress={group.progress} counts={group.counts} />
                  <div className="rounded-xl border border-border px-4 py-3 lg:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Areas</p>
                    <p className="mt-1 text-sm">{(group.areas || []).join(', ') || 'No area recorded'}</p>
                  </div>
                </div>
                <ActivityRows
                  rows={(data.rows || []).filter((row) => row.discipline === group.discipline)}
                  emptyLabel="No open work for this discipline."
                />
              </BoardSection>
            ))
          )}
        </div>
      )}
    </>
  );
}