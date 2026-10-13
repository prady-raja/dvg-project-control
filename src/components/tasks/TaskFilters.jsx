import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import EnumSelect from '@/components/common/EnumSelect';
import FilterBar from '@/components/common/FilterBar';
import { TASK_STATUSES } from '@/lib/constants';
import { countActive } from '@/lib/rememberedFilters';
import { useToast } from '@/components/ui/use-toast';
import { copyText } from '@/lib/reportExport';
import { Button } from '@/components/ui/button';
import { Link2 } from 'lucide-react';

const PROJECT_ALL = '__all__';

const BLANK = {
  search: '', project_id: '', phase_id: '', location_id: '', discipline: '', contractor_id: '', status: '', assignee: '',
};

/**
 * The work list's filters (MVP gap, step 1): three chips — Mine, Overdue, Blocked — and
 * everything else under More filters. Overdue opens Planning's Overdue tab, the one
 * place that decides what overdue means, so the number cannot differ from the dashboard.
 */
export default function TaskFilters({ filters, setFilters, cat, onClear, overdueTo }) {
  const { toast } = useToast();
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

  const mine = filters.assignee === 'me';
  const blocked = filters.status === 'Blocked';
  const inspection = filters.status === 'Execution Complete';
  const approval = filters.status === 'Under Inspection';
  // What sits under More filters: everything except the search box and the two status chips.
  const moreCount = countActive(filters, ['search', 'assignee']) - (blocked ? 1 : 0);
  const totalActive = countActive(filters);

  const copy = async () => {
    const ok = await copyText(window.location.href);
    toast({ description: ok ? 'Link copied. It opens this same view.' : 'Could not copy the link.' });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search task name, reference or description…"
          className="pl-9"
          aria-label="Search tasks"
        />
      </div>

      <FilterBar
        chips={[
          { key: 'mine', label: 'Mine', active: mine, onClick: () => set({ assignee: mine ? '' : 'me' }) },
          { key: 'overdue', label: 'Overdue', to: overdueTo },
          { key: 'blocked', label: 'Blocked', active: blocked, onClick: () => set({ status: blocked ? '' : 'Blocked' }) },
        ]}
        moreCount={moreCount}
        totalActive={totalActive}
        onClear={onClear || (() => setFilters(BLANK))}
        extra={<Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={copy}><Link2 className="h-3.5 w-3.5" aria-hidden /> Copy link</Button>}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" aria-pressed={inspection} onClick={() => set({ status: inspection ? '' : 'Execution Complete' })}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium ${inspection ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>Awaiting inspection</button>
          <button type="button" aria-pressed={approval} onClick={() => set({ status: approval ? '' : 'Under Inspection' })}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium ${approval ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>Awaiting approval</button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <EnumSelect value={filters.project_id} onChange={(v) => set({ project_id: v, phase_id: '', location_id: '' })} options={projects} placeholder="All projects" />
          <EnumSelect value={filters.phase_id} onChange={(v) => set({ phase_id: v, location_id: '' })} options={phases} placeholder="All phases" />
          <EnumSelect value={filters.location_id} onChange={(v) => set({ location_id: v })} options={locations} placeholder="All villas / locations" />
          <EnumSelect value={filters.discipline} onChange={(v) => set({ discipline: v })} options={disciplines} placeholder="All disciplines" />
          <EnumSelect value={filters.contractor_id} onChange={(v) => set({ contractor_id: v })} options={contractors} placeholder="All contractors" />
          <EnumSelect value={filters.status} onChange={(v) => set({ status: v })} options={TASK_STATUSES} placeholder="All statuses" />
        </div>
      </FilterBar>
    </div>
  );
}

export const EMPTY_TASK_FILTERS = BLANK;

export { PROJECT_ALL };
