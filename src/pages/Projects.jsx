import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
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

  const projectKey = cat.projects.map((p) => p.id).join(',');

  const loadCounts = useCallback(async () => {
    try {
      const entries = await Promise.all(
        cat.projects.map(async (project) => {
          const [registered, onHold] = await Promise.all([
            base44.entities.Location.count({ project_id: project.id, location_type: 'Villa' }),
            base44.entities.Location.count({
              project_id: project.id,
              location_type: 'Villa',
              active_status: 'On Hold',
            }),
          ]);
          const total = registered || 0;
          const held = onHold || 0;
          return [project.id, { registered: total, onHold: held, active: Math.max(0, total - held) }];
        }),
      );
      const map = {};
      entries.forEach(([id, value]) => {
        map[id] = value;
      });
      setCounts(map);
    } catch {
      // Keep the last known figures rather than briefly showing zeroes.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  useEffect(() => {
    if (cat.loading) return;
    loadCounts();
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