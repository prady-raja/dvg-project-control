/**
 * FRONTEND COPY of the room naming rules in base44/shared/villaAreas.ts — the
 * browser may not import from base44/, so the matching key and the scope label
 * live here too. Keep the two in step.
 */

const FILLER = /\b(the|a|an|room|area|space|of|and)\b/g;

/** Matching key for a room name. */
export const normalizeAreaName = (value) =>
  String(value === null || value === undefined ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The configured name of a floor, or '' — the register only holds what has been entered. */
export const floorLabelOf = (floor) => floor?.floor_name || floor?.floor_code || '';

/** What to show for a task's scope: floor and rooms, or the whole villa. */
export function areaLabelFor(areas = [], floor = null) {
  const floorLabel = floorLabelOf(floor);
  const names = (areas || []).map((area) => area.area_name).filter(Boolean);
  if (floorLabel && names.length) return `${floorLabel} · ${names.join(', ')}`;
  if (floorLabel) return floorLabel;
  if (names.length) return names.join(', ');
  return '';
}