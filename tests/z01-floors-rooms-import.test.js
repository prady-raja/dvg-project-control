// Floors & rooms import: planning, execution and server enforcement.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PAUSE_MS, RATE_LIMIT_RETRIES, RATE_LIMIT_WAIT_MS, executePlan, parseSheets, planRegistration, resultCsv, roomNotes, splitAliases,
} from '@/lib/floorsRoomsImport';
import { normalizeAreaName as serverNormalize } from '../base44/shared/villaAreas.ts';
import { normalizeAreaName as clientNormalize } from '@/lib/shared/villaAreas';

const sheet = (header, rows) => [header, ...rows].map((cells, i) => ({ excel_row: i + 1, cells, filled: true }));
const FH = ['Villa', 'Floor name', 'Floor code', 'Level order', 'Register in app (Yes/No)'];
const RH = ['Villa', 'Floor', 'Room name (app)', 'Area type', 'Aliases (accepted names)', 'Name(s) as written in Works', 'Works rows using it', 'Register in app (Yes/No)', 'Plan room ID'];
const villas = [{ id: 'v1', project_id: 'p', phase_id: 'ph', villa_code: 'T-01' }, { id: 'v2', project_id: 'p', phase_id: 'ph', villa_code: 'T-02' }];

const make = (floorRows, roomRows, decision = 3) => parseSheets({
  Floors_To_Register: sheet(FH, floorRows), Rooms_To_Register: sheet(RH, roomRows),
  Rooms_Need_Decision: sheet(['a'], Array.from({ length: decision }, () => ['x'])),
});
const plan = (parsed, floors = [], areas = []) => planRegistration({ parsed, villas, floors, areas, adminName: 'Ada', today: '2026-10-13' });

const parsed = make(
  [['T-01', 'Ground Floor', 'GF', 0, 'Yes'], ['T-01', 'First Floor', 'F1', 1, 'No'], ['T-09', 'Ground Floor', 'GF', 0, 'Yes']],
  [
    ['T-01', 'Ground Floor', 'Bar Area', 'Living', 'Bar; Pub; Bar', 'Bar', 2, 'Yes', 'P-1'],
    ['T-01', '', 'Store', 'Weird', '', 'Store', 1, 'Yes', 'P-2'],
    ['T-01', 'Second Floor', 'Gym', 'Room', '', 'Gym', 1, 'Yes', 'P-3'],
    ['T-01', 'Ground Floor', 'Skipped', 'Room', '', '', 0, 'No', 'P-4'],
    ['T-77', 'Ground Floor', 'Ghost', 'Room', '', '', 0, 'Yes', 'P-5'],
    ['T-02', '', 'Bar Area', 'Living', '', '', 0, 'Yes', 'P-6'],
  ],
);

describe('preview plan', () => {
  const p = plan(parsed);
  it('counts what it would create, skip and refuse', () => {
    expect(p.totals).toMatchObject({ floors_create: 1, rooms_create: 3, skipped_no: 2, errors: 3, need_decision: 3 });
  });
  it('unknown villa is an error, never created; unlisted floor is an error; blank floor registers with none', () => {
    const by = (name) => p.items.find((i) => i.name === name && i.kind === 'room');
    expect(by('Ghost').outcome).toBe('error');
    expect(by('Gym').reason).toMatch(/not in Floors_To_Register/);
    expect(by('Store').outcome).toBe('create');
    expect(by('Store').floor_ref).toBeNull();
    expect(p.items.find((i) => i.villa === 'T-09').outcome).toBe('error');
  });
  it('same room in two villas is not a duplicate', () => {
    expect(p.items.filter((i) => i.name === 'Bar Area' && i.outcome === 'create')).toHaveLength(2);
  });
  it('builds room fields: aliases split, type fallback, source, notes', () => {
    const bar = p.items.find((i) => i.name === 'Bar Area' && i.villa === 'T-01').data;
    expect(bar).toMatchObject({ aliases: ['Bar', 'Pub'], source_name: 'Bar', area_type: 'Living', source: 'Drawing review' });
    expect(bar.notes).toBe('Registered from plan room ID P-1, confirmed by Ada on 13-Oct-26');
    expect(p.items.find((i) => i.name === 'Store').data.area_type).toBe('Room');
  });
  it('preview alone writes nothing', async () => {
    const calls = [];
    plan(parsed); // planning is pure
    expect(calls).toHaveLength(0);
  });
});

describe('existing records are skipped (safe to run twice)', () => {
  const floors = [{ id: 'f9', location_id: 'v1', floor_name: ' ground  FLOOR.' }];
  const areas = [{ id: 'a1', location_id: 'v1', area_name: 'The Bar Area', normalized_name: serverNormalize('Bar Area') }];
  const p = plan(parsed, floors, areas);
  it('matches floors ignoring case, spaces, punctuation and rooms by normalised name', () => {
    expect(p.totals).toMatchObject({ floors_exist: 1, floors_create: 0, rooms_exist: 1, rooms_create: 2 });
  });
  it('a room on an existing floor takes its id', async () => {
    const saved = [];
    const run = await executePlan(plan(parsed, floors, areas), { create: async (e, d) => { saved.push([e, d]); return { record: { id: 'n' } }; } });
    expect(saved.find(([, d]) => d.area_name === 'Bar Area' && d.location_id === 'v2')).toBeTruthy();
    expect(run.created_rooms).toBe(2);
  });
});

describe('execution', () => {
  it('creates floors first, passes the new floor id to rooms, carries on after a refusal', async () => {
    const order = [];
    let n = 0;
    const create = async (entity, data) => {
      order.push(entity);
      if (data.area_name === 'Store') throw new Error('refused');
      return { record: { id: `id${++n}` } };
    };
    const p = plan(parsed);
    const run = await executePlan(p, { create });
    expect(order.indexOf('VillaArea')).toBeGreaterThan(order.lastIndexOf('VillaFloor'));
    expect(run).toMatchObject({ created_floors: 1, created_rooms: 2, failed: 1 });
    expect(resultCsv(p, run)).toMatch(/Failed,refused/);
  });
  it('writes one record at a time with a pause and reports progress', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ['T-01', '', `Room ${i} X${i}`, 'Room', '', '', 0, 'Yes', `P${i}`]);
    const progress = []; const sleeps = []; let active = 0; let overlap = false;
    const create = async () => { active += 1; if (active > 1) overlap = true; await Promise.resolve(); active -= 1; return { record: { id: 'x' } }; };
    const run = await executePlan(plan(make([], rows)), { create, sleep: async (ms) => { sleeps.push(ms); }, onProgress: (x) => progress.push(x.done) });
    expect(overlap).toBe(false);
    expect(progress).toEqual([1, 2, 3, 4, 5]);
    expect(sleeps).toEqual(Array(5).fill(PAUSE_MS));
    expect(run).toMatchObject({ created_rooms: 5, stopped: false, remaining: 0 });
  });
  it('waits 10 s and retries a rate-limited record, then carries on', async () => {
    const rows = [['T-01', '', 'Alpha One', 'Room', '', '', 0, 'Yes', 'P1'], ['T-01', '', 'Beta Two', 'Room', '', '', 0, 'Yes', 'P2']];
    let hits = 0; const sleeps = [];
    const create = async (e, d) => { if (d.area_name === 'Alpha One' && hits++ < 2) throw new Error('429 rate limit exceeded'); return { record: { id: 'x' } }; };
    const run = await executePlan(plan(make([], rows)), { create, sleep: async (ms) => { sleeps.push(ms); } });
    expect(sleeps.filter((ms) => ms === RATE_LIMIT_WAIT_MS)).toHaveLength(2);
    expect(run).toMatchObject({ created_rooms: 2, failed: 0, stopped: false });
  });
  it('stops after the retries, keeps what was saved, and reports what remains', async () => {
    const rows = ['A One', 'B Two', 'C Three', 'D Four'].map((n, i) => ['T-01', '', n, 'Room', '', '', 0, 'Yes', `P${i}`]);
    let calls = 0;
    const create = async (e, d) => { calls += 1; if (d.area_name === 'C Three') throw new Error('Too many requests'); return { record: { id: 'x' } }; };
    const p = plan(make([], rows));
    const run = await executePlan(p, { create, sleep: async () => {} });
    expect(run).toMatchObject({ created_rooms: 2, failed: 0, stopped: true, remaining: 2 });
    expect(calls).toBe(2 + 1 + RATE_LIMIT_RETRIES); // C Three tried once plus each retry; D Four never tried
    expect(resultCsv(p, run)).toMatch(/Four,not run/);
  });
  it('a refusal that is not a rate limit is skipped, not retried', async () => {
    const rows = [['T-01', '', 'Alpha One', 'Room', '', '', 0, 'Yes', 'P1']];
    let calls = 0;
    const run = await executePlan(plan(make([], rows)), { create: async () => { calls += 1; throw new Error('already has an area'); }, sleep: async () => {} });
    expect(calls).toBe(1);
    expect(run).toMatchObject({ failed: 1, stopped: false });
  });
  it('a room whose floor failed is failed, not created without a floor', async () => {
    const run = await executePlan(plan(parsed), { create: async (e) => { if (e === 'VillaFloor') throw new Error('no'); return { record: { id: 'r' } }; } });
    expect(run.results.find((r) => r.item.name === 'Bar Area' && r.item.villa === 'T-01').outcome).toBe('failed');
  });
});

describe('helpers and rules', () => {
  it('caps aliases at 20', () => expect(splitAliases(Array.from({ length: 25 }, (_, i) => `a${i}`).join(';')).aliases).toHaveLength(20));
  it('notes use DD-MMM-YY', () => expect(roomNotes('X', 'Ada', '2026-01-05')).toMatch(/on 05-Jan-26$/));
  it('a room with no real plan ID is not described as registered from one', () => {
    ['', 'Work list wording (no plan match)'].forEach((id) => {
      expect(roomNotes(id, 'Ada', '2026-01-05')).toBe('Registered as written in Works, no plan match (location to be confirmed), confirmed by Ada on 05-Jan-26');
    });
  });
  it('uses the same name key as the server', () => ['Master  Bedroom!', 'The Bar Area'].forEach((v) => expect(clientNormalize(v)).toBe(serverNormalize(v))));
  it('a missing register sheet is reported', () => expect(parseSheets({ Floors_To_Register: null, Rooms_To_Register: null, Rooms_Need_Decision: null }).problems).toHaveLength(2));
});

describe('server enforcement', () => {
  const src = readFileSync(new URL('../base44/functions/saveRecord/entry.ts', import.meta.url), 'utf8');
  it('a marked register import is administrator-only and create-only', () => {
    expect(src).toMatch(/register_import === true/);
    expect(src).toMatch(/if \(!appAdmin\) throw fail\('Only an application administrator can run the floors and rooms import\.', 403\)/);
  });
  it('the screen writes only through saveRecord', () => {
    const lib = readFileSync(new URL('../src/lib/floorsRoomsImport.js', import.meta.url), 'utf8');
    expect(lib).toMatch(/invokeFn\('saveRecord'/);
    expect(lib).not.toMatch(/entities\./);
  });
});
