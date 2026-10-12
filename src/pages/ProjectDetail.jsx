import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCatalogs } from '@/lib/CatalogContext';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import { Metric } from '@/components/common/Metric';
import PhaseDialog from '@/components/projects/PhaseDialog';
import BaselineSection from '@/components/baselines/BaselineSection';
import { useAccess } from '@/lib/AccessContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const cat = useCatalogs();
  const access = useAccess();
  const canManage = access.can(projectId, 'manage_project');
  const [phaseCounts, setPhaseCounts] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const project = cat.projectById(projectId);
  const phases = cat.phasesFor(projectId);
  const commonLocations = cat.locations.filter((l) => l.project_id === projectId && l.location_type !== 'Villa');
  const heldVillas = cat.locations.filter((l) => l.project_id === projectId && l.location_type === 'Villa' && l.active_status === 'On Hold');

  const phaseKey = cat.phasesFor(projectId).map((p) => p.id).join(',');

  const loadCounts = useCallback(async () => {
    if (!projectId) return;
    try {
      const phaseList = cat.phasesFor(projectId);
      const entries = await Promise.all(
        phaseList.map(async (phase) => {
          const [registered, onHold] = await Promise.all([
            base44.entities.Location.count({ project_id: projectId, phase_id: phase.id, location_type: 'Villa' }),
            base44.entities.Location.count({
              project_id: projectId,
              phase_id: phase.id,
              location_type: 'Villa',
              active_status: 'On Hold',
            }),
          ]);
          const total = registered || 0;
          const held = onHold || 0;
          return [phase.id, { registered: total, onHold: held, active: Math.max(0, total - held) }];
        }),
      );
      const map = {};
      entries.forEach(([id, value]) => {
        map[id] = value;
      });
      setPhaseCounts(map);
    } catch {
      // Keep the last known figures rather than briefly showing zeroes.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, phaseKey]);

  useEffect(() => {
    if (cat.loading) return;
    loadCounts();
  }, [cat.loading, cat.locations.length, loadCounts]);

  if (cat.loading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Project not found</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const totalPlanned =
    phases.reduce((sum, p) => sum + (Number(p.planned_villa_count) || 0), 0) || project.planned_villa_count || 0;
  // Show a dash until the server totals arrive, so a delay never reads as "zero villas".
  const countsReady = phases.length > 0 && phases.every((p) => phaseCounts[p.id] !== undefined);
  const registeredTotal = countsReady
    ? phases.reduce((sum, p) => sum + (phaseCounts[p.id].registered || 0), 0)
    : '—';
  const onHoldTotal = countsReady ? phases.reduce((sum, p) => sum + (phaseCounts[p.id].onHold || 0), 0) : '—';

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5 text-muted-foreground">
        <Link to="/projects">          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${project.code}${project.location ? ` · ${project.location}` : ''}`}
        title={project.name}
        description={project.notes || undefined}
        actions={
          <>
            <Pill value={project.status} />
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add phase
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Planned villas" value={totalPlanned || '—'} />
        <Metric label="Phases" value={phases.length} />
        <Metric label="Registered villas" value={registeredTotal} />
        <Metric label="On hold" value={onHoldTotal} tone={countsReady && onHoldTotal ? 'danger' : 'muted'} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Phases
        </h2>
        {phases.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No phases yet. Add Phase A, Phase B and any later phases here.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {phases.map((phase) => {
              const stats = phaseCounts[phase.id];
              const stat = (key) => (stats && stats[key] !== undefined ? stats[key] : '—');
              return (
                <article key={phase.id} className="min-w-0 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="field-mono rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                          {phase.code || '—'}
                        </span>
                        <Pill value={phase.status} />
                      </div>
                      <h3 className="mt-2 truncate font-display text-base font-semibold">{phase.name}</h3>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => {
                          setEditing(phase);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-3 border-t border-border pt-4">
                    <Metric label="Planned" value={phase.planned_villa_count ?? '—'} />
                    <Metric label="Registered" value={stat('registered')} />
                    <Metric label="Active" value={stat('active')} tone={stats ? 'ok' : 'muted'} />
                    <Metric label="On hold" value={stat('onHold')} tone={stats && stats.onHold ? 'danger' : 'muted'} />
                  </div>

                  <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-1.5">
                    <Link to={`/locations?project=${projectId}&phase=${phase.id}`}>
                      View villas <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>

                  <BaselineSection projectId={projectId} phaseId={phase.id} canManage={canManage} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      {commonLocations.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Common work locations
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {commonLocations.map((l) => (
              <Link key={l.id} to={`/locations/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.villa_code}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.location_type} · works stage {l.works_stage}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill value={l.active_status} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        Possession status and construction completion are tracked separately.
        {heldVillas.length > 0
          ? ` On hold (kept in inventory, excluded from active-work figures): ${heldVillas
            .map((l) => `${l.villa_code}${l.on_hold_reason ? ` — ${l.on_hold_reason}` : ''}`)
            .join('; ')}.`
          : ' No villa is on hold.'}
        {' '}Latest data change: {formatDate(project.updated_date)}.
      </div>

      <PhaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        phase={editing}
        projectId={projectId}
        cat={cat}
        onSaved={loadCounts}
      />
    </>
  );
}