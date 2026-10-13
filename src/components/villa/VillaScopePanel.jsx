import React, { useCallback, useEffect, useState } from 'react';
import { Copy, DoorOpen, Layers, Pencil, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { createRecord, updateRecord } from '@/lib/recordService';
import FloorDialog from '@/components/villa/FloorDialog';
import AreaDialog from '@/components/villa/AreaDialog';
import CopyScopeDialog from '@/components/villa/CopyScopeDialog';
import { useCatalogs } from '@/lib/CatalogContext';
import { forgetVillaScope } from '@/components/villa/VillaScopePicker';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The room register of one villa: the floors and the rooms inside them. This is
 * what a work list, a site message and a drawing are matched against, so a floor
 * or room that is not here is reported rather than guessed at.
 */
export default function VillaScopePanel({ location, canManage }) {
  const [floors, setFloors] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [floorDialog, setFloorDialog] = useState(null);
  const [areaDialog, setAreaDialog] = useState(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const cat = useCatalogs();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!location?.id) return;
    setLoading(true);
    const [floorRes, areaRes] = await Promise.all([
      base44.entities.VillaFloor.filter({ location_id: location.id }, { sort: 'level_order', limit: 100 }),
      base44.entities.VillaArea.filter({ location_id: location.id }, { sort: 'sort_order', limit: 300 }),
    ]);
    setFloors(items(floorRes));
    setAreas(items(areaRes));
    setLoading(false);
  }, [location?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveFloor = async (values) => {
    setSaving(true);
    setError('');
    try {
      if (floorDialog?.id) await updateRecord('VillaFloor', floorDialog.id, values);
      else await createRecord('VillaFloor', {
        project_id: location.project_id,
        phase_id: location.phase_id || null,
        location_id: location.id,
        ...values,
      });
      setFloorDialog(null);
      forgetVillaScope(location.id);
      await load();
    } catch (e) {
      setError(e?.message || 'The floor could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveArea = async (values) => {
    setSaving(true);
    setError('');
    try {
      if (areaDialog?.id) await updateRecord('VillaArea', areaDialog.id, values);
      else await createRecord('VillaArea', {
        project_id: location.project_id,
        phase_id: location.phase_id || null,
        location_id: location.id,
        source: 'Manual',
        ...values,
      });
      setAreaDialog(null);
      forgetVillaScope(location.id);
      await load();
    } catch (e) {
      setError(e?.message || 'The room could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const unassigned = areas.filter((area) => !area.floor_id);

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Layers className="h-4 w-4" /> Floors and rooms
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {floors.length} floor{floors.length === 1 ? '' : 's'} · {areas.length} room{areas.length === 1 ? '' : 's'} registered for this villa.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCopyOpen(true)} disabled={!floors.length && !areas.length}>
              <Copy className="h-3.5 w-3.5" /> Copy to…
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFloorDialog({})}>
              <Plus className="h-3.5 w-3.5" /> Floor
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAreaDialog({})}>
              <Plus className="h-3.5 w-3.5" /> Room
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      {!floors.length && !areas.length ? (
        <div className="mt-3 rounded-lg border border-border">
          <EmptyState
            icon={DoorOpen}
            title="No floors or rooms registered yet"
            description="Add them as the drawings are reviewed. Until then, work is tracked at villa level."
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {floors.map((floor) => {
            const rooms = areas.filter((area) => area.floor_id === floor.id);
            return (
              <div key={floor.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {floor.floor_name}
                    {!!floor.floor_code && <span className="ml-2 font-mono text-xs text-muted-foreground">{floor.floor_code}</span>}
                  </p>
                  {canManage && (
                    <button type="button" onClick={() => setFloorDialog(floor)} className="text-muted-foreground transition-colors hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {rooms.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {rooms.map((area) => (
                      <li key={area.id}>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => canManage && setAreaDialog(area)}
                          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:hover:border-border disabled:hover:text-muted-foreground"
                        >
                          {area.area_name}
                          {!!area.area_code && <span className="ml-1.5 font-mono">{area.area_code}</span>}
                          {!!(area.aliases || []).length && <span className="ml-1.5 opacity-70">+{area.aliases.length} alias</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No rooms registered on this floor yet.</p>
                )}
              </div>
            );
          })}

          {!!unassigned.length && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Not yet assigned to a floor</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {unassigned.map((area) => (
                  <li key={area.id}>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => canManage && setAreaDialog(area)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:hover:border-border disabled:hover:text-muted-foreground"
                    >
                      {area.area_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <CopyScopeDialog open={copyOpen} onOpenChange={setCopyOpen} location={location} locations={cat.locations} />
      <FloorDialog
        open={!!floorDialog}
        onOpenChange={(open) => !open && setFloorDialog(null)}
        initial={floorDialog || {}}
        onSubmit={saveFloor}
        submitting={saving}
      />
      <AreaDialog
        open={!!areaDialog}
        onOpenChange={(open) => !open && setAreaDialog(null)}
        initial={areaDialog || {}}
        floors={floors}
        onSubmit={saveArea}
        submitting={saving}
      />
    </div>
  );
}