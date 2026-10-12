import React, { useEffect, useState } from 'react';
import { data } from '@/api/data';
import FloorRoomPicker from '@/components/villa/FloorRoomPicker';

const cache = new Map();

/** Loads a villa's floors and rooms, then shows the floor/room picker. Renders nothing without a villa. */
export default function VillaScopePicker({ locationId, villaLabel, floorId, areaIds, onChange }) {
  const [scope, setScope] = useState(() => cache.get(locationId) || { floors: [], areas: [] });

  useEffect(() => {
    if (!locationId) return undefined;
    if (cache.has(locationId)) {
      setScope(cache.get(locationId));
      return undefined;
    }
    let alive = true;
    Promise.all([
      data.list('VillaFloor', { location_id: locationId, active: { $ne: false } }, { sort: 'level_order', limit: 100 }),
      data.list('VillaArea', { location_id: locationId, active: { $ne: false } }, { sort: 'sort_order', limit: 300 }),
    ])
      .then(([floors, areas]) => {
        const next = { floors, areas };
        cache.set(locationId, next);
        if (alive) setScope(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [locationId]);

  if (!locationId) return null;
  return (
    <FloorRoomPicker
      floors={scope.floors}
      areas={scope.areas}
      floorId={floorId || ''}
      areaIds={areaIds || []}
      onChange={onChange}
      villaLabel={villaLabel}
    />
  );
}

/** Forget a villa's cached register after floors or rooms change. */
export const forgetVillaScope = (locationId) => (locationId ? cache.delete(locationId) : cache.clear());
