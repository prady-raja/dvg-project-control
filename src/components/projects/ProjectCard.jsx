import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Pill from '@/components/common/Pill';
import { Metric } from '@/components/common/Metric';

export default function ProjectCard({ project, phases, counts, onEdit, canEdit }) {
  const planned =
    project.planned_villa_count ?? phases.reduce((sum, p) => sum + (Number(p.planned_villa_count) || 0), 0);
  const stats = counts || { registered: 0, active: 0, onHold: 0 };

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="field-mono rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
              {project.code}
            </span>
            <Pill value={project.status} />
          </div>
          <h2 className="mt-2 truncate font-display text-lg font-semibold text-foreground">{project.name}</h2>
          {project.location && <p className="mt-0.5 truncate text-sm text-muted-foreground">{project.location}</p>}
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon" onClick={() => onEdit(project)} className="shrink-0">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3 border-y border-border py-4">
        <Metric label="Planned" value={planned || '—'} />
        <Metric label="Registered" value={stats.registered ?? 0} />
        <Metric label="Active" value={stats.active ?? 0} tone="ok" />
        <Metric label="On hold" value={stats.onHold ?? 0} tone={stats.onHold ? 'danger' : 'muted'} />
      </div>

      {phases.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {phases.map((phase) => (
            <li key={phase.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-foreground">
                <span className="field-mono text-xs text-muted-foreground">{phase.code || '—'}</span>
                <span className="ml-2">{phase.name}</span>
              </span>
              <span className="field-mono shrink-0 text-xs text-muted-foreground">
                {phase.planned_villa_count ?? '—'} planned
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-2 pt-5">
        <Button asChild size="sm" className="gap-1.5">
          <Link to={`/projects/${project.id}`}>
            Open project <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to={`/tasks?project=${project.id}`}>Tasks</Link>
        </Button>
      </div>
    </article>
  );
}