/**
 * Copy the floors and rooms of one villa to others of the same type (L-01).
 * Pure: it only decides what to create, so it can be tested and reused when the
 * data moves. Rooms that already exist on the target (same normalised name) are
 * skipped, and a room keeps its floor by matching the floor code or name.
 */
import { normalizeAreaName } from './villaAreas.ts';

const floorKey = (floor) => String(floor?.floor_code || floor?.floor_name || '').trim().toLowerCase();

export function planScopeCopy({ sourceFloors = [], sourceAreas = [], targetFloors = [], targetAreas = [] }) {
  const targetFloorByKey = new Map(targetFloors.map((f) => [floorKey(f), f]));
  const floorsToCreate = [];
  const floorKeyOfSource = new Map(sourceFloors.map((f) => [f.id, floorKey(f)]));

  sourceFloors.forEach((floor) => {
    const key = floorKey(floor);
    if (!key || targetFloorByKey.has(key)) return;
    floorsToCreate.push({
      key,
      floor_code: floor.floor_code || null,
      floor_name: floor.floor_name,
      level_order: floor.level_order ?? null,
      notes: floor.notes || null,
    });
  });

  const existingNames = new Set(targetAreas.map((a) => a.normalized_name || normalizeAreaName(a.area_name)));
  const areasToCreate = [];
  const skippedAreas = [];
  sourceAreas.forEach((area) => {
    const name = area.normalized_name || normalizeAreaName(area.area_name);
    if (!name) return;
    if (existingNames.has(name)) {
      skippedAreas.push(area.area_name);
      return;
    }
    existingNames.add(name);
    areasToCreate.push({
      floorKey: floorKeyOfSource.get(area.floor_id) || '',
      area_code: area.area_code || null,
      area_name: area.area_name,
      aliases: area.aliases || [],
      area_type: area.area_type || 'Room',
      sort_order: area.sort_order ?? null,
      notes: area.notes || null,
    });
  });
  return { floorsToCreate, areasToCreate, skippedAreas };
}
