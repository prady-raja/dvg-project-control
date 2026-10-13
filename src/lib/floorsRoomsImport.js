import { normalizeAreaName } from '@/lib/shared/villaAreas';
import { invokeFn } from '@/lib/invokeFn';
import { readWorkbookSheets } from '@/lib/xlsxImport';

/**
 * Floors & rooms import: register the plan-approved floors and rooms of a
 * workbook. This module reads three sheets, plans what would be created, and
 * writes only through the server's saveRecord function (marked as a register
 * import, which the server restricts to an application administrator).
 *
 * Planning is pure: the same workbook and the same register always give the same
 * plan, and nothing is written until the plan is confirmed.
 */

export const FLOORS_SHEET = 'Floors_To_Register';
export const ROOMS_SHEET = 'Rooms_To_Register';
export const DECISION_SHEET = 'Rooms_Need_Decision';
export const BATCH_SIZE = 25;
export const MAX_ALIASES = 20;

/** Mirrors the AREA_TYPES enum of VillaArea; anything else is saved as Room. */
export const AREA_TYPES = ['Room', 'Bathroom', 'Kitchen', 'Living', 'Balcony', 'Terrace', 'Exterior', 'Utility', 'Staircase', 'Common', 'Other'];

const headerKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** A floor matches on case, spaces and punctuation only. */
export const floorKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const clean = (value) => String(value ?? '').trim();

const FLOOR_COLUMNS = {
  villa: ['villa'], name: ['floor name'], code: ['floor code'], level: ['level order'], register: ['register in app'],
};
const ROOM_COLUMNS = {
  villa: ['villa'], floor: ['floor'], name: ['room name app', 'room name'], type: ['area type'],
  aliases: ['aliases accepted names', 'aliases'], source: ['name s as written in works', 'names as written in works', 'name as written in works'],
  register: ['register in app'], planId: ['plan room id'],
};

/** Column positions by heading; exact heading first, then a heading that starts with it. */
function columnsOf(headerCells, spec) {
  const keys = headerCells.map(headerKey);
  const found = {};
  Object.entries(spec).forEach(([field, options]) => {
    let index = -1;
    options.some((option) => {
      index = keys.indexOf(option);
      if (index === -1) index = keys.findIndex((key) => key.startsWith(`${option} `));
      return index !== -1;
    });
    found[field] = index;
  });
  return found;
}

const missingColumns = (found, required, labels) => required.filter((field) => found[field] === -1).map((field) => labels[field]);

/**
 * The three sheets as plain rows. A missing register sheet is an error; a missing
 * Rooms_Need_Decision sheet only means there is nothing to report.
 */
export function parseSheets(sheets) {
  const problems = [];
  const read = (sheetName, spec, required, labels) => {
    const rows = sheets[sheetName];
    if (!rows) {
      problems.push(`The workbook has no “${sheetName}” sheet.`);
      return [];
    }
    if (!rows.length) return [];
    const found = columnsOf(rows[0].cells, spec);
    const missing = missingColumns(found, required, labels);
    if (missing.length) {
      problems.push(`“${sheetName}” is missing the column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);
      return [];
    }
    return rows.slice(1).map((row) => {
      const get = (field) => (found[field] === -1 ? '' : clean(row.cells[found[field]]));
      return { excel_row: row.excel_row, get };
    });
  };

  const floorRows = read(FLOORS_SHEET, FLOOR_COLUMNS, ['villa', 'name', 'register'], {
    villa: 'Villa', name: 'Floor name', register: 'Register in app',
  }).map((r) => ({
    excel_row: r.excel_row, villa: r.get('villa'), name: r.get('name'), code: r.get('code'), level: r.get('level'), register: r.get('register'),
  }));

  const roomRows = read(ROOMS_SHEET, ROOM_COLUMNS, ['villa', 'floor', 'name', 'register'], {
    villa: 'Villa', floor: 'Floor', name: 'Room name (app)', register: 'Register in app',
  }).map((r) => ({
    excel_row: r.excel_row, villa: r.get('villa'), floor: r.get('floor'), name: r.get('name'), type: r.get('type'),
    aliases: r.get('aliases'), source: r.get('source'), register: r.get('register'), planId: r.get('planId'),
  }));

  // Read-only: only its row count is ever used, and nothing in it is registered.
  const needDecision = sheets[DECISION_SHEET] ? Math.max(0, sheets[DECISION_SHEET].length - 1) : 0;

  return { floorRows, roomRows, needDecision, decisionSheetFound: !!sheets[DECISION_SHEET], problems };
}

export async function readFloorsRoomsWorkbook(file) {
  const { sheets, names } = await readWorkbookSheets(file, [FLOORS_SHEET, ROOMS_SHEET, DECISION_SHEET]);
  const parsed = parseSheets(sheets);
  return { ...parsed, sheetNames: names };
}

const yesNo = (value) => {
  const key = headerKey(value);
  if (key === 'yes') return 'yes';
  if (key === 'no') return 'no';
  return '';
};

/** "Aliases" cell split on ; — trimmed, de-duplicated, at most 20. */
export function splitAliases(cell) {
  const seen = new Set();
  const out = [];
  String(cell ?? '').split(';').map(clean).filter(Boolean).forEach((alias) => {
    const key = alias.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(alias);
  });
  return { aliases: out.slice(0, MAX_ALIASES), trimmed: out.length > MAX_ALIASES };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** DD-MMM-YY from a YYYY-MM-DD date. */
export const dayLabel = (iso) => {
  const [y, m, d] = String(iso).split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${String(y).slice(2)}`;
};

export const roomNotes = (planId, adminName, iso) =>
  `Registered from plan room ID ${planId || 'n/a'}, confirmed by ${adminName || 'administrator'} on ${dayLabel(iso)}`;

/**
 * What the workbook would do.
 *
 *   villas:  [{ id, villa_code, phase_id }]  of the chosen project
 *   floors:  existing VillaFloor records of the project
 *   areas:   existing VillaArea records of the project
 */
export function planRegistration({ parsed, villas, floors, areas, adminName = '', today }) {
  const villaByCode = new Map();
  villas.forEach((villa) => villaByCode.set(clean(villa.villa_code), villa));

  const items = []; // every sheet row with its outcome
  const villaTotals = new Map();
  const bump = (code, field) => {
    const row = villaTotals.get(code) || { villa: code, floors_create: 0, floors_exist: 0, rooms_create: 0, rooms_exist: 0, skipped_no: 0, errors: 0 };
    row[field] += 1;
    villaTotals.set(code, row);
  };
  const push = (item) => {
    items.push(item);
    const code = item.villa || '(no villa)';
    if (item.outcome === 'create') bump(code, item.kind === 'floor' ? 'floors_create' : 'rooms_create');
    else if (item.outcome === 'exists') bump(code, item.kind === 'floor' ? 'floors_exist' : 'rooms_exist');
    else if (item.outcome === 'no') bump(code, 'skipped_no');
    else bump(code, 'errors');
  };

  // Existing register, by villa. Archived records still hold their name, so they count.
  const existingFloor = new Map(); // `${villaId}|${key}` -> floor
  floors.forEach((floor) => {
    const key = `${floor.location_id}|${floorKey(floor.floor_name)}`;
    const held = existingFloor.get(key);
    if (!held || (held.active === false && floor.active !== false)) existingFloor.set(key, floor);
  });
  const existingRoom = new Set(
    areas.map((area) => `${area.location_id}|${area.normalized_name || normalizeAreaName(area.area_name)}`),
  );

  /* ------------------------------------------------------------- floors */
  const plannedFloors = new Map(); // `${villaId}|${key}` -> planned floor item
  parsed.floorRows.forEach((row) => {
    const base = { kind: 'floor', sheet: FLOORS_SHEET, excel_row: row.excel_row, villa: row.villa, name: row.name };
    if (!row.villa && !row.name && !row.register) return;
    const flag = yesNo(row.register);
    if (flag === 'no') return push({ ...base, outcome: 'no', reason: 'Marked No' });
    if (!flag) return push({ ...base, outcome: 'error', reason: 'Register in app must be Yes or No' });
    const villa = villaByCode.get(row.villa);
    if (!villa) return push({ ...base, outcome: 'error', reason: `Villa '${row.villa}' is not in this project` });
    if (!row.name) return push({ ...base, outcome: 'error', reason: 'Floor name is blank' });
    const level = row.level === '' ? null : Number(row.level);
    if (level !== null && !Number.isFinite(level)) return push({ ...base, outcome: 'error', reason: `Level order '${row.level}' is not a number` });

    const key = `${villa.id}|${floorKey(row.name)}`;
    if (existingFloor.has(key)) {
      return push({ ...base, outcome: 'exists', reason: 'Already registered', villa_id: villa.id, floor_id: existingFloor.get(key).id });
    }
    if (plannedFloors.has(key)) {
      return push({ ...base, outcome: 'error', reason: `Repeats the floor on row ${plannedFloors.get(key).excel_row}` });
    }
    const item = {
      ...base, outcome: 'create', villa_id: villa.id, key,
      data: {
        project_id: villa.project_id, phase_id: villa.phase_id || null, location_id: villa.id,
        floor_name: row.name, floor_code: row.code || null, level_order: level,
      },
    };
    plannedFloors.set(key, item);
    push(item);
  });

  // Every floor a room may name: planned ones and those already registered.
  const floorFor = (villaId, name) => {
    const key = `${villaId}|${floorKey(name)}`;
    if (plannedFloors.has(key)) return { planned: plannedFloors.get(key) };
    if (existingFloor.has(key)) return { existing: existingFloor.get(key) };
    return null;
  };

  /* -------------------------------------------------------------- rooms */
  const plannedRooms = new Map();
  parsed.roomRows.forEach((row) => {
    const base = { kind: 'room', sheet: ROOMS_SHEET, excel_row: row.excel_row, villa: row.villa, name: row.name, floor: row.floor };
    if (!row.villa && !row.name && !row.register) return;
    const flag = yesNo(row.register);
    if (flag === 'no') return push({ ...base, outcome: 'no', reason: 'Marked No' });
    if (!flag) return push({ ...base, outcome: 'error', reason: 'Register in app must be Yes or No' });
    const villa = villaByCode.get(row.villa);
    if (!villa) return push({ ...base, outcome: 'error', reason: `Villa '${row.villa}' is not in this project` });
    if (!row.name) return push({ ...base, outcome: 'error', reason: 'Room name is blank' });
    const normalized = normalizeAreaName(row.name);
    if (!normalized) return push({ ...base, outcome: 'error', reason: 'Room name has no usable letters or numbers' });

    const roomKey = `${villa.id}|${normalized}`;
    if (existingRoom.has(roomKey)) return push({ ...base, outcome: 'exists', reason: 'Already registered', villa_id: villa.id });
    if (plannedRooms.has(roomKey)) {
      return push({ ...base, outcome: 'error', reason: `Same name as the room on row ${plannedRooms.get(roomKey).excel_row}` });
    }

    let floorRef = null;
    if (row.floor) {
      floorRef = floorFor(villa.id, row.floor);
      if (!floorRef) {
        return push({ ...base, outcome: 'error', reason: `Floor '${row.floor}' is not in ${FLOORS_SHEET} and not registered on ${row.villa}` });
      }
    }

    const { aliases, trimmed } = splitAliases(row.aliases);
    const typeMatch = AREA_TYPES.find((type) => type.toLowerCase() === row.type.toLowerCase());
    const item = {
      ...base, outcome: 'create', villa_id: villa.id,
      warnings: [
        ...(trimmed ? [`Aliases cut to the first ${MAX_ALIASES}`] : []),
        ...(row.type && !typeMatch ? [`Area type '${row.type}' is not a known type; saved as Room`] : []),
      ],
      floor_ref: floorRef,
      data: {
        project_id: villa.project_id, phase_id: villa.phase_id || null, location_id: villa.id,
        area_name: row.name, aliases, source_name: row.source || null, area_type: typeMatch || 'Room',
        source: 'Drawing review', notes: roomNotes(row.planId, adminName, today),
      },
    };
    plannedRooms.set(roomKey, item);
    push(item);
  });

  const count = (kind, outcome) => items.filter((i) => i.kind === kind && i.outcome === outcome).length;
  const totals = {
    floors_create: count('floor', 'create'), floors_exist: count('floor', 'exists'),
    rooms_create: count('room', 'create'), rooms_exist: count('room', 'exists'),
    skipped_no: items.filter((i) => i.outcome === 'no').length,
    errors: items.filter((i) => i.outcome === 'error').length,
    need_decision: parsed.needDecision,
  };
  return {
    totals, items,
    villas: [...villaTotals.values()].sort((a, b) => a.villa.localeCompare(b.villa, undefined, { numeric: true })),
    warnings: items.filter((i) => i.warnings?.length),
  };
}

const sameCounts = (a, b) => ['floors_create', 'rooms_create'].every((k) => a.totals[k] === b.totals[k]);
/** True when a fresh plan promises what the previewed one promised. */
export const plansAgree = sameCounts;

/**
 * Create the planned floors, then the planned rooms, 25 at a time, through
 * saveRecord. A refused record is skipped with its reason and the run carries on.
 * `create(entity, data)` defaults to the server call and is replaceable in tests.
 */
export async function executePlan(plan, { create = serverCreate, onProgress = () => {} } = {}) {
  const floorsToMake = plan.items.filter((i) => i.kind === 'floor' && i.outcome === 'create');
  const roomsToMake = plan.items.filter((i) => i.kind === 'room' && i.outcome === 'create');
  const total = floorsToMake.length + roomsToMake.length;
  const results = [];
  const floorIds = new Map();
  let done = 0;

  const run = async (list, entity, dataOf, afterOk) => {
    for (let start = 0; start < list.length; start += BATCH_SIZE) {
      const batch = list.slice(start, start + BATCH_SIZE);
      // eslint-disable-next-line no-await-in-loop
      const settled = await Promise.all(batch.map(async (item) => {
        const data = dataOf(item);
        if (data.error) return { item, ok: false, reason: data.error };
        try {
          const res = await create(entity, data);
          return { item, ok: true, id: res?.record?.id || '' };
        } catch (error) {
          return { item, ok: false, reason: error?.message || 'Refused' };
        }
      }));
      settled.forEach((r) => {
        if (r.ok) afterOk(r);
        results.push({ item: r.item, outcome: r.ok ? 'created' : 'failed', reason: r.ok ? '' : r.reason });
      });
      done += batch.length;
      onProgress({ done, total });
    }
  };

  await run(floorsToMake, 'VillaFloor', (item) => item.data, (r) => floorIds.set(r.item.key, r.id));
  await run(roomsToMake, 'VillaArea', (item) => {
    const ref = item.floor_ref;
    if (!ref) return item.data;
    if (ref.existing) return { ...item.data, floor_id: ref.existing.id };
    const id = floorIds.get(ref.planned.key);
    if (!id) return { error: `Floor '${item.floor}' could not be created, so this room was not created` };
    return { ...item.data, floor_id: id };
  }, () => {});

  const created = (kind) => results.filter((r) => r.item.kind === kind && r.outcome === 'created').length;
  return {
    results,
    created_floors: created('floor'),
    created_rooms: created('room'),
    failed: results.filter((r) => r.outcome === 'failed').length,
  };
}

/** The one write path: the server's saveRecord, marked as a register import. */
function serverCreate(entity, data) {
  return invokeFn('saveRecord', { entity, action: 'create', data, register_import: true }, 'The record was refused.');
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const OUTCOME_LABEL = {
  created: 'Created', failed: 'Failed', exists: 'Skipped – already registered', no: 'Skipped – marked No', error: 'Error – not created',
};

/** Every sheet row with what happened to it, as CSV text. */
export function resultCsv(plan, run) {
  const ran = new Map((run?.results || []).map((r) => [r.item, r]));
  const header = ['Sheet', 'Excel row', 'Villa', 'Type', 'Floor', 'Name', 'Result', 'Reason'];
  const lines = plan.items.map((item) => {
    const r = ran.get(item);
    const outcome = r ? r.outcome : item.outcome === 'create' ? 'not run' : item.outcome;
    const reason = r ? r.reason : item.reason || '';
    return [item.sheet, item.excel_row, item.villa, item.kind, item.kind === 'room' ? item.floor : '', item.name, OUTCOME_LABEL[outcome] || outcome, reason];
  });
  return [header, ...lines].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
