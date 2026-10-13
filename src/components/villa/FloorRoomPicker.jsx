import React from 'react';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Where inside a villa the work is: a floor, then the rooms. One task can cover
 * several rooms and stays one task. Presentational — the caller supplies the
 * villa's registered floors and rooms (see VillaScopePicker for a loading wrapper).
 */
export default function FloorRoomPicker({ floors = [], areas = [], floorId = '', areaIds = [], onChange, villaLabel = 'this villa' }) {
  const shownAreas = floorId ? areas.filter((a) => a.floor_id === floorId || !a.floor_id) : areas;
  const set = (patch) => onChange({ floor_id: floorId, area_ids: areaIds, ...patch });

  return (
    <>
      <Field label="Floor" hint="Registered floors of this villa only.">
        <EnumSelect
          value={floorId}
          onChange={(value) => set({ floor_id: value, area_ids: [] })}
          options={[{ value: '', label: 'Whole villa' }, ...floors.map((f) => ({ value: f.id, label: f.floor_name }))]}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Rooms/areas" hint="Tick every room this one task covers — several rooms stay one task.">
          {shownAreas.length ? (
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
              {shownAreas.map((area) => (
                <label key={area.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={areaIds.includes(area.id)}
                    onCheckedChange={(value) =>
                      set({ area_ids: value === true ? [...areaIds, area.id] : areaIds.filter((id) => id !== area.id) })
                    }
                  />
                  <span className="min-w-0 truncate">{area.area_name}</span>
                  {!!area.floor_id && (
                    <span className="text-[11px] text-muted-foreground">{floors.find((f) => f.id === area.floor_id)?.floor_name || ''}</span>
                  )}
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              No rooms are registered for {villaLabel} yet — add them on the villa page, or leave the work at villa level.
            </p>
          )}
        </Field>
      </div>
    </>
  );
}
