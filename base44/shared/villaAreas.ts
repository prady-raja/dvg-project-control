/**
 * The villa room register: floors, rooms and the scope of a task.
 *
 * Room names are normalised for matching (case, punctuation and filler words
 * removed) and aliases are recorded deliberately. An unknown name is reported
 * for a decision — never silently matched to a similarly named room — and when
 * two rooms of one villa share a name the answer is "which one", not a guess.
 */

export const SCOPE_TYPES = [
  'Specific Room/Area',
  'Multiple Rooms/Areas',
  'Entire Floor',
  'Entire Villa',
  'Site-wide',
];

export const AREA_TYPES = [
  'Room', 'Bathroom', 'Kitchen', 'Living', 'Balcony', 'Terrace', 'Exterior', 'Utility', 'Staircase', 'Common', 'Other',
];

/**
 * Names that are known to mean the same place. This list is only ever used to
 * offer a match for confirmation, and it is deliberately short: an alias that
 * has not been configured is reported, not assumed.
 */
export const ALIAS_GROUPS = [
  ['master bedroom', 'main bedroom'],
  ['sunken living', 'sunken lounge'],
  ['servant quarters', 'staff quarters', 'servants quarters'],
  ['exterior', 'external', 'external area'],
  ['terrace', 'roof terrace'],
  ['toilet', 'wc', 'water closet'],
  ['utility', 'utility area', 'wash area', 'service area'],
  ['balcony', 'balconies'],
  ['staircase', 'staircase area', 'stairs'],
  ['living', 'living room', 'living and dining'],
  ['parking', 'car park', 'car parking'],
];

const FILLER = /\b(the|a|an|room|area|space|of|and)\b/g;

/** Matching key for a room name. */
export const normalizeAreaName = (value) =>
  String(value === null || value === undefined ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Every key a room answers to: its name, its normalised name, its aliases and known alias groups. */
export function areaKeys(area) {
  const keys = new Set();
  const add = (value) => {
    const key = normalizeAreaName(value);
    if (key) keys.add(key);
    return key;
  };
  add(area?.normalized_name);
  add(area?.area_name);
  add(area?.source_name);
  (area?.aliases || []).forEach((alias) => add(alias));
  const base = normalizeAreaName(area?.area_name || area?.normalized_name);
  ALIAS_GROUPS.forEach((group) => {
    if (group.some((name) => normalizeAreaName(name) === base)) {
      group.forEach((name) => keys.add(normalizeAreaName(name)));
    }
  });
  return [...keys];
}

/** The configured name of a floor, or '' — the register only holds what has been entered. */
export const floorLabelOf = (floor) => floor?.floor_name || floor?.floor_code || '';

export const areasOfFloor = (areas, floorId) => (areas || []).filter((area) => area.floor_id === floorId);

/** What to show for a task's scope: floor and rooms, or the whole villa. */
export function areaLabelFor(areas = [], floor = null) {
  const floorLabel = floorLabelOf(floor);
  const names = (areas || []).map((area) => area.area_name).filter(Boolean);
  if (floorLabel && names.length) return `${floorLabel} · ${names.join(', ')}`;
  if (floorLabel) return floorLabel;
  if (names.length) return names.join(', ');
  return '';
}

/**
 * The scope implied by the records: several rooms, one room, a whole floor, the
 * whole villa, or site-wide work. Derived from ids, never from the wording.
 */
export function scopeTypeFor({ area_ids = [], floor_id = '', location_id = '', floor_area_count = 0 } = {}) {
  if (!location_id) return 'Site-wide';
  if (area_ids.length > 1) return 'Multiple Rooms/Areas';
  if (area_ids.length === 1) return 'Specific Room/Area';
  if (floor_id) return 'Entire Floor';
  return 'Entire Villa';
}

/** Server-side truth for a task's scope fields. */
export function describeScope({ scope_type, area_ids, floor_id, location_id, areas = [], floors = [] }) {
  const ids = [...new Set((area_ids || []).filter(Boolean))];
  const chosen = areas.filter((area) => ids.includes(area.id));
  const floor = floors.find((item) => item.id === floor_id) || null;
  const resolvedType = SCOPE_TYPES.includes(scope_type) && (scope_type !== 'Site-wide' || !location_id)
    ? scope_type
    : scopeTypeFor({ area_ids: ids, floor_id: floor_id || '', location_id: location_id || '' });
  return {
    area_ids: ids,
    floor_id: floor?.id || (resolvedType === 'Entire Villa' || resolvedType === 'Site-wide' ? '' : floor_id || ''),
    area_label: resolvedType === 'Entire Villa' || resolvedType === 'Site-wide' ? '' : areaLabelFor(chosen, floor),
    scope_type: resolvedType,
    areas: chosen,
    floor,
  };
}

/** A one-line scope for a screen or a proposal review row. */
export function scopeSummary({ scope_type, area_label, floor, areas, villa }) {
  const label = area_label || areaLabelFor(areas || [], floor);
  if (scope_type === 'Site-wide') return 'Site-wide';
  if (label) return `${scope_type} — ${label}`;
  return `${scope_type} — ${villa || 'villa'}`;
}

/**
 * Match the words of a message against the rooms of one villa.
 *
 * Returns what matched, what is ambiguous (two rooms with the same name) and
 * what could not be placed. Nothing is assigned unless it matched: an
 * unregistered room name stays unassigned and is reported instead.
 */
export function matchAreas({ text, areas = [], floors = [] }) {
  const hay = normalizeAreaName(text);
  const found = [];
  const byKey = new Map();

  areas.forEach((area) => {
    byKey.set(area.id, areaKeys(area).filter((key) => key.length >= 3));
  });

  areas.forEach((area) => {
    const keys = byKey.get(area.id) || [];
    const hit = keys.find((key) => hay.includes(key));
    if (hit) found.push({ area, via: hit });
  });

  const floorHits = floors.filter((floor) => {
    const keys = [normalizeAreaName(floor.floor_name), normalizeAreaName(floor.floor_code)].filter((key) => key.length >= 3);
    return keys.some((key) => hay.includes(key));
  });

  // A phrase nobody has registered: offer it rather than pick a room.
  const unresolved = [];
  if (!found.length) {
    ALIAS_GROUPS.forEach((group) => {
      group.forEach((name) => {
        const key = normalizeAreaName(name);
        if (key.length >= 4 && hay.includes(key)) unresolved.push(name);
      });
    });
  }

  const matchedAreas = found.map((item) => item.area);
  const duplicateNames = matchedAreas.length > 1
    ? matchedAreas.filter((area, index) =>
        matchedAreas.some((other, position) => position !== index && normalizeAreaName(other.area_name) === normalizeAreaName(area.area_name)))
    : [];

  return {
    floor: floorHits.length === 1 ? floorHits[0] : null,
    floors: floorHits,
    areas: matchedAreas,
    unresolved: [...new Set(unresolved)],
    ambiguous: duplicateNames.length ? { name: duplicateNames[0].area_name, options: duplicateNames } : null,
    floorAmbiguous: floorHits.length > 1 ? floorHits : null,
  };
}

/** Room names the words mention that are not in the register — reported, never guessed. */
export const unregisteredNames = (match) => (match?.unresolved || []);