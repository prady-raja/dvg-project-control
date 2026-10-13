import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SearchableSelect from '@/components/common/SearchableSelect';
import { useCatalogs } from '@/lib/CatalogContext';
import { useScope } from '@/lib/ScopeContext';
import { useQuickActions } from '@/components/layout/QuickActions';

/** The desktop top bar (N-03): which project and phase everything below is showing, and the + New menu. */
export default function TopBar() {
  const cat = useCatalogs();
  const scope = useScope();
  const quick = useQuickActions();
  if (!cat.projects.length) return null;
  const phases = scope.projectId ? cat.phasesFor(scope.projectId) : [];
  return (
    <div className="mb-5 hidden items-center gap-3 border-b border-border pb-3 lg:flex print:hidden" aria-label="Scope">
      <div className="w-64">
        <SearchableSelect
          value={scope.projectId}
          onChange={scope.setProjectId}
          options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Project"
        />
      </div>
      {phases.length > 0 && (
        <div className="w-52">
          <SearchableSelect
            value={scope.phaseId}
            onChange={scope.setPhaseId}
            options={[{ value: '', label: 'All phases' }, ...phases.map((p) => ({ value: p.id, label: p.name }))]}
            placeholder="All phases"
          />
        </div>
      )}
      <div className="flex-1" />
      {quick.canReport && (
        <Button size="sm" className="gap-1.5" onClick={quick.openMenu}><Plus className="h-4 w-4" /> New</Button>
      )}
    </div>
  );
}
