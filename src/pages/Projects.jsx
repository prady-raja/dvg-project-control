import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { rows } from '@/lib/dataHelpers';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import ProjectCard from '@/components/projects/ProjectCard';
import ProjectDialog from '@/components/projects/ProjectDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2 } from 'lucide-react';

export default function Projects() {
  const cat = useCatalogs();
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadCounts = useCallback(async () => {
    const [registered, onHold] = await Promise.all([
      base44.entities.Location.aggregate({ query: { location_type: 'Villa' }, groupBy: 'project_id' }),
      base44.entities.Location.aggregate({
        query: { location_type: 'Villa', active_status: 'On Hold' },
        groupBy: 'project_id',
      }),
    ]);
    const map = {};
    rows(registered).forEach((r) => {
      map[r.project_id] = { registered: r.count || 0, onHold: 0, active: r.count || 0 };
    });
    rows(onHold).forEach((r) => {
      if (!map[r.project_id]) map[r.project_id] = { registered: 0, onHold: 0, active: 0 };
      map[r.project_id].onHold = r.count || 0;
      map[r.project_id].active = Math.max(0, map[r.project_id].registered - (r.count || 0));
    });
    setCounts(map);
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (!cat.loading) loadCounts();
  }, [cat.loading, cat.locations.length, loadCounts]);

  // Step 1A is a private development build: every signed-in user may edit configuration.
  // Role-based restrictions arrive with server-side project permissions in Step 1B.
  const canEdit = Boolean(user);

  return (
    <>
      <PageHeader
        eyebrow="Dream Valley Group"
        title="Projects"
        description="Every phase, villa and task hangs off a project. Open a project to manage its phases and villas."
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New project
          </Button>
        }
      />

      {cat.loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : cat.projects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Building2}
            title="No projects yet"
            description="Create your first project to start registering construction tasks."
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {cat.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              phases={cat.phasesFor(project.id)}
              counts={counts[project.id]}
              canEdit={canEdit}
              onEdit={(p) => {
                setEditing(p);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} project={editing} cat={cat} onSaved={loadCounts} />
    </>
  );
}