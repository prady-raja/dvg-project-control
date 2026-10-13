import React from 'react';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

/**
 * The reporting scope: project, phase, reporting date, and — for application
 * administrators only — the clearly labelled demo view. Every figure on the
 * screen is stated for this scope and this date.
 */
export default function DashboardFilters({
  projects = [],
  phases = [],
  projectId,
  phaseId,
  date,
  onProject,
  onPhase,
  onDate,
  includeDemo,
  onIncludeDemo,
  canUseDemo = false,
  children,
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Project</Label>
          <EnumSelect
            className="mt-1.5"
            value={projectId}
            onChange={onProject}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Project"
          />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Phase</Label>
          <EnumSelect
            className="mt-1.5"
            value={phaseId}
            onChange={onPhase}
            options={[{ value: '', label: 'All phases' }, ...phases.map((p) => ({ value: p.id, label: p.name }))]}
            placeholder="All phases"
          />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Measure overdue against</Label>
          <Input type="date" className="mt-1.5" value={date} onChange={(e) => onDate(e.target.value)} />
        </div>
        {children}
      </div>

      {canUseDemo && (
        <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
          <Switch id="demo-view" checked={!!includeDemo} onCheckedChange={onIncludeDemo} />
          <Label htmlFor="demo-view" className="text-xs">
            Demo/Test view — include labelled demo records
          </Label>
          <span className="text-[11px] text-muted-foreground">
            {includeDemo
              ? 'Demo records are included. They are test data, not site progress.'
              : 'Demo records are held out of every operational figure.'}
          </span>
        </div>
      )}
    </div>
  );
}