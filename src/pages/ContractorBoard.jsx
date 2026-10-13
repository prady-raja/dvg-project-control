import React, { useEffect, useState } from 'react';
import { HardHat, RefreshCw } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { loadDashboard } from '@/lib/dashboardService';
import { todayIst } from '@/lib/format';
import PageHeader from '@/components/common/PageHeader';
import StatTile from '@/components/common/StatTile';
import DataCaveats from '@/components/common/DataCaveats';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import ContractorBoardCard from '@/components/contractors/ContractorBoardCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import NoProjectState from '@/components/common/NoProjectState';

/** Stage A / 4 — Contractor dashboard. */
export default function ContractorBoard() {
  const cat = useCatalogs();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [discipline, setDiscipline] = useState('');
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
    loadDashboard('contractor', { projectId, phaseId, locationId, discipline, date })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Could not load contractors.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, phaseId, locationId, discipline, date, refresh]);

  const project = cat.projectById(projectId);
  const phases = projectId ? cat.phasesFor(projectId) : [];
  const villas = projectId ? cat.locationsFor(projectId, phaseId) : [];
  const disciplines = projectId ? cat.enabledDisciplines(project) : cat.disciplines;
  const totals = data?.totals || {};

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <NoProjectState icon={HardHat} description="Contractor performance appears once you are a member of a project." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Execution teams"
        title="Contractor dashboard"
        description="Assigned, open, overdue and blocked works by contractor, with reported progress, reported manpower and anything waiting on another party."
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
          setLocationId('');
          setDiscipline('');
        }}
        onPhase={(value) => {
          setPhaseId(value);
          setLocationId('');
        }}
        onDate={setDate}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Villa</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">All villas</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>{v.villa_code}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Discipline</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            >
              <option value="">All disciplines</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </DashboardFilters>

      {loading ? (
        <Skeleton className="mt-5 h-96 rounded-xl" />
      ) : error ? (
        <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <DataCaveats items={data.warnings} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Contractors with work" value={totals.contractors ?? 0} />
            <StatTile label="Open works" value={totals.open ?? 0} />
            <StatTile label="Overdue" value={totals.overdue ?? 0} tone={totals.overdue ? 'danger' : 'default'} />
            <StatTile label="Blocked" value={totals.blocked ?? 0} tone={totals.blocked ? 'danger' : 'default'} />
            <StatTile label="Due this week" value={totals.due_this_week ?? 0} />
            <StatTile label="Awaiting approval" value={totals.awaiting_approval ?? 0} tone="warning" />
            <StatTile label="Open works not updated in 7 days" value={totals.stale_tasks ?? 0} tone={totals.stale_tasks ? 'warning' : 'default'} />
            <StatTile label="Open works with no contractor" value={totals.unassigned ?? 0} tone={totals.unassigned ? 'warning' : 'default'} />
          </div>

          <div className="space-y-4">
            {(data.rows || []).map((row) => (
              <ContractorBoardCard key={row.contractor_id} row={row} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}