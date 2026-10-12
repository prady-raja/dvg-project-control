/**
 * A floor and rooms are checked against the villa's own register before they are
 * stored, and the readable scope and its type are derived here, so no screen and
 * no message can state a scope the records do not support. Used by tasks and snags.
 */
import { describeScope } from './villaAreas.ts';
import { fail, getOne, listAll } from './records.ts';

export async function resolveTaskScope(svc, { projectId, locationId, floorId, areaIds, scopeType }) {
  const ids = [...new Set((Array.isArray(areaIds) ? areaIds : []).filter(Boolean))];
  if (!ids.length && !floorId && !scopeType) return null;

  const areas = ids.length ? listAll(await svc.VillaArea.filter({ id: { $in: ids } }, { limit: 200 })) : [];
  if (areas.length !== ids.length) throw fail('One of the rooms chosen no longer exists.');
  const wrong = areas.find((area) => area.project_id !== projectId || (locationId && area.location_id !== locationId));
  if (wrong) throw fail(`The room “${wrong.area_name}” belongs to a different villa.`);

  const floor = floorId ? await getOne(svc.VillaFloor, floorId) : null;
  if (floorId && !floor) throw fail('That floor no longer exists.');
  if (floor && locationId && floor.location_id !== locationId) throw fail('That floor belongs to a different villa.');

  return describeScope({
    scope_type: scopeType,
    area_ids: ids,
    floor_id: floor?.id || '',
    location_id: locationId || '',
    areas,
    floors: floor ? [floor] : [],
  });
}

