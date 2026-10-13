import DataState from '@/components/common/DataState';
import TruncationBanner from '@/components/common/TruncationBanner';
import { errorMessageOf } from '@/lib/clientErrors';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCatalogs } from '@/lib/CatalogContext';
import { items } from '@/lib/dataHelpers';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import EnumSelect from '@/components/common/EnumSelect';
import VillaHealthList from '@/components/locations/VillaHealthList';
import LocationTable from '@/components/locations/LocationTable';
import LocationDialog from '@/components/locations/LocationDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ACTIVE_STATUSES, LOCATION_TYPES, POSSESSION_STATUSES } from '@/lib/constants';

export default function Locations() {
  const cat = useCatalogs();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    project_id: searchParams.get('project') || '',
    phase_id: searchParams.get('phase') || '',
    location_type: '',
    possession_status: '',
    active_status: '',
  });
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState('health');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      const query = {};
      if (filters.project_id) query.project_id = filters.project_id;
      if (filters.phase_id) query.phase_id = filters.phase_id;
      if (filters.location_type) query.location_type = filters.location_type;
      if (filters.possession_status) query.possession_status = filters.possession_status;
      if (filters.active_status) query.active_status = filters.active_status;
      try {
        const res = await base44.entities.Location.filter(query, { sort: 'villa_code', limit: 500 });
        if (!cancelled) setLocations(items(res));
      } catch (e) {
        if (!cancelled) setLoadError(errorMessageOf(e, 'The villa list could not be loaded.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters, cat.locations.length, reloadKey]);

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <>
      <PageHeader
        eyebrow={cat.projects.map((p) => p.name).join(' · ') || 'Villas & locations'}
        title="Villas & Locations"
        description="Physical villas, common areas and infrastructure. Plot references are kept separate from the villa ID."
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New location
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 rounded-xl border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-5 sm:p-4">
        <EnumSelect
          value={filters.project_id}
          onChange={(v) => set({ project_id: v, phase_id: '' })}
          options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="All projects"
        />
        <EnumSelect
          value={filters.phase_id}
          onChange={(v) => set({ phase_id: v })}
          options={(filters.project_id ? cat.phasesFor(filters.project_id) : cat.phases).map((p) => ({
            value: p.id,
            label: p.name,
          }))}
          placeholder="All phases"
        />
        <EnumSelect
          value={filters.location_type}
          onChange={(v) => set({ location_type: v })}
          options={LOCATION_TYPES}
          placeholder="All types"
        />
        <EnumSelect
          value={filters.possession_status}
          onChange={(v) => set({ possession_status: v })}
          options={POSSESSION_STATUSES}
          placeholder="Any possession"
        />
        <EnumSelect
          value={filters.active_status}
          onChange={(v) => set({ active_status: v })}
          options={ACTIVE_STATUSES}
          placeholder="Active or on hold"
        />
      </div>

      <div className="mb-3 flex gap-2" role="tablist" aria-label="View">
        {[['health', 'Health'], ['register', 'Register']].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)}
            className={`min-h-9 rounded-full border px-4 text-sm font-medium ${mode === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{label}</button>
        ))}
      </div>

      {mode === 'health' ? (
        <VillaHealthList projectId={filters.project_id} phaseId={filters.phase_id} filters={filters} />
      ) : loadError ? (
        <DataState error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : locations.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={MapPin}
            title="No villas or locations match"
            description="Adjust the filters above, or add a new villa or common-work location."
            action={<Button onClick={() => { setEditing(null); setDialogOpen(true); }}>New location</Button>}
          />
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{locations.length} records</p>
          {locations.length >= 500 && <TruncationBanner shown={locations.length} noun="locations" className="mb-3" />}
          <LocationTable locations={locations} cat={cat} />
        </>
      )}

      <LocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        location={editing}
        defaultProjectId={filters.project_id}
        defaultPhaseId={filters.phase_id}
        cat={cat}
      />
    </>
  );
}