import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EnumSelect from '@/components/common/EnumSelect';
import { TASK_STATUSES } from '@/lib/constants';

const PROJECT_ALL = '__all__';

export default function TaskFilters({ filters, setFilters, cat }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const projects = cat.projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const phases = filters.project_id
    ? cat.phasesFor(filters.project_id).map((p) => ({ value: p.id, label: `${p.code || ''} ${p.name}`.trim() }))
    : cat.phases.map((p) => ({ value: p.id, label: p.name }));
  const locations = cat.locations
    .filter((l) => !filters.project_id || l.project_id === filters.project_id)
    .filter((l) => !filters.phase_id || l.phase_id === filters.phase_id)
    .map((l) => ({ value: l.id, label: l.villa_code }));
  const disciplines = cat.disciplines
    .filter((d) => d.active !== false)
    .map((d) => ({ value: d.code, label: d.name }));
  const contractors = cat.contractors.map((c) => ({ value: c.id, label: c.name }));

  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search task name, reference or description…"
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <EnumSelect
            value={filters.project_id}
            onChange={(v) => set({ project_id: v, phase_id: '', location_id: '' })}
            options={projects}
            placeholder="All projects"
          />
          <EnumSelect
            value={filters.phase_id}
            onChange={(v) => set({ phase_id: v, location_id: '' })}
            options={phases}
            placeholder="All phases"
          />
          <EnumSelect
            value={filters.location_id}
            onChange={(v) => set({ location_id: v })}
            options={locations}
            placeholder="All villas / locations"
          />
          <EnumSelect
            value={filters.discipline}
            onChange={(v) => set({ discipline: v })}
            options={disciplines}
            placeholder="All disciplines"
          />
          <EnumSelect
            value={filters.contractor_id}
            onChange={(v) => set({ contractor_id: v })}
            options={contractors}
            placeholder="All contractors"
          />
          <EnumSelect
            value={filters.status}
            onChange={(v) => set({ status: v })}
            options={TASK_STATUSES}
            placeholder="All statuses"
          />
        </div>

        {hasFilters && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() =>
                setFilters({
                  search: '',
                  project_id: '',
                  phase_id: '',
                  location_id: '',
                  discipline: '',
                  contractor_id: '',
                  status: '',
                  assignee: '',
                })
              }
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const EMPTY_TASK_FILTERS = {
  search: '',
  project_id: '',
  phase_id: '',
  location_id: '',
  discipline: '',
  contractor_id: '',
  status: '',
  assignee: '',
};

export { PROJECT_ALL };