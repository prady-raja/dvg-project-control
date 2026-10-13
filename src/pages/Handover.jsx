import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { loadDashboard } from '@/lib/dashboardService';
import { updateSnag } from '@/lib/snagService';
import { todayIst } from '@/lib/format';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import StatTile from '@/components/common/StatTile';
import DataCaveats from '@/components/common/DataCaveats';
import Pill from '@/components/common/Pill';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import SnagList from '@/components/handover/SnagList';
import SnagDialog from '@/components/handover/SnagDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import NoProjectState from '@/components/common/NoProjectState';

/** Stage A / 8 — handover and snagging. */
export default function Handover() {
  const cat = useCatalogs();
  const access = useAccess();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [date, setDate] = useState(todayIst());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snagFor, setSnagFor] = useState(null);
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
    loadDashboard('handover', { projectId, phaseId, date })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Could not load handover tracking.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, phaseId, date, refresh]);

  const phases = projectId ? cat.phasesFor(projectId) : [];
  const project = cat.projectById(projectId);
  const disciplines = projectId ? cat.enabledDisciplines(project) : cat.disciplines;
  const canEdit = projectId ? access.can(projectId, 'edit_tasks') : false;
  const summary = data?.summary || {};

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <NoProjectState icon={ClipboardCheck} description="Handover tracking appears once you are a member of a project." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Completion"
        title="Handover & snagging"
        description="Possession and works completion are tracked independently: a villa already handed over keeps every open work and snag on this list."
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
            <StatTile label="Villas tracked" value={summary.villas ?? 0} />
            <StatTile label="Handed over" value={summary.handed_over ?? 0} />
            <StatTile label="Handed over with open works" value={summary.handed_over_with_open_works ?? 0} tone={summary.handed_over_with_open_works ? 'warning' : 'default'} />
            <StatTile label="Handed over with open snags" value={summary.handed_over_with_open_snags ?? 0} tone={summary.handed_over_with_open_snags ? 'warning' : 'default'} />
            <StatTile label="Works complete — possession pending" value={summary.works_complete_possession_pending ?? 0} />
            <StatTile label="Ready for handover" value={summary.ready_for_handover ?? 0} />
            <StatTile label="Open snags" value={summary.open_snags ?? 0} tone={summary.open_snags ? 'warning' : 'default'} />
            <StatTile label="Snags awaiting reinspection" value={summary.snags_awaiting_reinspection ?? 0} />
          </div>

          <BoardSection
            title="Villa handover board"
            description="Handed-over villas with work or snags outstanding are listed first — possession never hides a defect or an open work."
          >
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 text-left">Villa</th>
                    <th className="py-2 text-left">Phase</th>
                    <th className="py-2 text-left">Possession</th>
                    <th className="py-2 text-left">Works status</th>
                    <th className="py-2 text-left">Outstanding</th>
                    <th className="py-2 text-left">Awaiting verification</th>
                    <th className="py-2 text-left">Open snags</th>
                    <th className="py-2 text-left">Reinspection</th>
                    <th className="py-2 text-left">Handover stage</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rows || []).map((row) => (
                    <tr key={row.location_id} className={cn('border-b border-border/60 last:border-0', row.needs_attention && 'bg-[hsl(var(--warning))]/5')}>
                      <td className="py-2.5">
                        <Link to={`/locations/${row.location_id}/execution`} className="field-mono text-xs font-semibold hover:underline">
                          {row.villa}
                        </Link>
                        <div className="text-xs text-muted-foreground">{row.plot_numbers}</div>
                        {row.on_hold && <span className="text-xs uppercase text-muted-foreground">on hold</span>}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">{row.phase}</td>
                      <td className="py-2.5"><Pill value={row.possession_status} /></td>
                      <td className="py-2.5"><Pill value={row.works_stage} /></td>
                      <td className="field-mono py-2.5 tnum">{row.outstanding}</td>
                      <td className="field-mono py-2.5 tnum">{row.awaiting_verification}</td>
                      <td className="field-mono py-2.5 tnum">{row.open_snags}</td>
                      <td className="field-mono py-2.5 tnum">{row.snags_awaiting_reinspection}</td>
                      <td className="py-2.5 text-xs">{row.handover_stage}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/locations/${row.location_id}/execution`}>Open</Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/villas/${row.location_id}/statement`}>Statement</Link>
                          </Button>
                          {canEdit && (
                            <Button size="sm" variant="outline" onClick={() => setSnagFor(row)}>
                              Raise snag
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BoardSection>

          <BoardSection
            title="Snag register"
            description="Open and recently closed snags. Photographs are optional on every snag."
          >
            <SnagList
              rows={data.snags || []}
              canEdit={canEdit}
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
      )}

      <SnagDialog
        open={!!snagFor}
        onOpenChange={(value) => !value && setSnagFor(null)}
        projectId={projectId}
        phaseId={snagFor?.location_id ? cat.locationById(snagFor.location_id)?.phase_id : phaseId}
        locationId={snagFor?.location_id}
        disciplines={disciplines}
        contractors={cat.contractors}
        onSaved={() => {
          setSnagFor(null);
          setRefresh((n) => n + 1);
        }}
      />
    </>
  );
}