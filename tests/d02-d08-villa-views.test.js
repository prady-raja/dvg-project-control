// D-02 villa matrix and D-08 pending-works statement.
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../base44/shared/dashboardCore.ts';
import { statementText, villaForecast, villaMatrixView, villaStatementView } from '../base44/shared/villaViews.ts';
import { attentionFor } from '../base44/shared/attention.ts';

const AS_OF = '2026-10-12';
const locations = [
  { id: 'v1', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-01', possession_status: 'Handed Over', possession_date: '2026-06-01', planned_completion_date: '2026-10-20', works_stage: 'Works Pending' },
  { id: 'v2', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-02', possession_status: 'Not Handed Over', works_stage: 'Completed' },
  { id: 'v3', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-10' },
  { id: 'c1', project_id: 'p', phase_id: 'a', location_type: 'Common Area', villa_code: 'Clubhouse' },
];
const t = (id, over = {}) => ({ id, task_ref: id, name: `Task ${id}`, project_id: 'p', phase_id: 'a', location_id: 'v1', discipline: 'FIN', status: 'In Progress', baseline_finish: '2026-10-25', ...over });
const tasks = [
  t('t1', { floor_id: 'f1', area_label: 'Ground Floor · Kitchen', current_forecast_finish: '2026-11-05', progress_percent: 50 }),
  t('t2', { discipline: 'ELEC', status: 'Blocked', blocker_description: 'Keys', blocker_category: 'Owner Access Pending', access_status: 'Pending' }),
  t('t3', { status: 'Closed', progress_percent: 100, actual_finish: '2026-10-01' }),
  t('t4', { location_id: 'v2', discipline: 'PLUMB', baseline_finish: '' }),
  t('t5', { location_id: 'v2', discipline: 'PLUMB', baseline_finish: '2026-12-01' }),
  t('t6', { location_id: 'v1', discipline: 'FIN', status: 'Execution Complete', selection_status: 'Pending Selection' }),
  t('demo', { is_demo: true }),
];
const ix = buildIndex({
  projects: [{ id: 'p', name: 'Imagine' }], phases: [{ id: 'a', name: 'Phase A' }], locations, tasks,
  disciplines: [{ code: 'FIN', name: 'Finishes' }, { code: 'ELEC', name: 'Electrical' }, { code: 'PLUMB', name: 'Plumbing' }],
});

describe('D-02 villa forecast', () => {
  it('is the latest recorded finish of the open work, labelled by possession', () => {
    const f = villaForecast(locations[0], tasks.filter((x) => x.location_id === 'v1' && x.status !== 'Closed' && !x.is_demo));
    expect(f.date).toBe('2026-11-05');
    expect(f.label).toBe('Pending works complete by');
    expect(f.slip_days).toBe(16); // against the planned 2026-10-20
  });

  it('says not scheduled, with the undated count, rather than inventing a date', () => {
    const f = villaForecast(locations[1], [tasks[3]]);
    expect(f).toMatchObject({ date: '', state: 'not_scheduled', undated: 1, label: 'Forecast handover' });
  });

  it('a villa with nothing open has no pending works', () => {
    expect(villaForecast(locations[2], []).state).toBe('complete');
  });
});

describe('D-02 villa matrix', () => {
  const view = villaMatrixView({ tasks, locations, ix, asOf: AS_OF, options: { projectId: 'p' } });

  it('lists villas only, handed-over villas with open works first, demo work left out', () => {
    expect(view.rows.map((r) => r.villa)).toEqual(['A-01', 'A-02', 'A-10']);
    expect(view.rows[0].open).toBe(3);
    expect(view.totals.handed_over_with_open_works).toBe(1);
  });

  it('colours each cell by what is in it and counts the badges', () => {
    const row = view.rows[0];
    expect(row.cells.ELEC).toMatchObject({ category: 'Stuck', blocked: 1, owner_access: 1 });
    expect(row.cells.FIN.category).toBe('Active');
    expect(row.cells.FIN).toMatchObject({ open: 2, closed: 1 });
    expect(view.rows[1].cells.ELEC).toBeNull();
  });

  it('shows a percentage only when every task in the cell is measured', () => {
    expect(view.rows[0].cells.FIN.percent).toBeNull(); // t6 has no progress
    expect(view.rows[0].cells.ELEC.percent).toBeNull();
  });

  it('filters by possession and contractor', () => {
    const handed = villaMatrixView({ tasks, locations, ix, asOf: AS_OF, options: { projectId: 'p', possession: 'Handed Over' } });
    expect(handed.rows.map((r) => r.villa)).toEqual(['A-01']);
    const none = villaMatrixView({ tasks, locations, ix, asOf: AS_OF, options: { projectId: 'p', contractorId: 'nobody' } });
    expect(none.rows.every((r) => r.open === 0)).toBe(true);
  });
});

describe('D-08 pending-works statement', () => {
  const floors = [{ id: 'f1', floor_name: 'Ground Floor' }];
  const snags = [
    { id: 's1', location_id: 'v1', status: 'Open', title: 'Door rubs', snag_ref: 'SN-1', photo_uris: ['u1', 'u2'], area_label: 'Hall' },
    { id: 's2', location_id: 'v1', status: 'Closed', title: 'Old' },
  ];
  const view = villaStatementView({ location: locations[0], tasks, snags, floors, ix, asOf: AS_OF });

  it('groups open work by floor and room, in plain words', () => {
    expect(view.groups.map((g) => g.floor)).toEqual(['Ground Floor', 'Whole villa or floor not stated']);
    expect(view.groups[0].items[0]).toMatchObject({ room: 'Kitchen', status: 'In progress', expected: '2026-11-05', trade: 'Finishes' });
    const stuck = view.groups[1].items.find((i) => i.what === 'Task t2');
    expect(stuck.status).toBe('On hold');
    expect(stuck.holding).toMatch(/Owner Access Pending/);
  });

  it('lists open snags with one photo each, what the owner must provide, and recent completions', () => {
    expect(view.snags).toEqual([expect.objectContaining({ title: 'Door rubs', photo: 'u1' })]);
    expect(view.needed_from_owner.map((o) => o.need).sort()).toEqual(['A selection by the owner', 'Access to the villa']);
    expect(view.completed_recently.map((c) => c.what)).toContain('Task t3');
  });

  it('states counts, and a percentage only when measured', () => {
    expect(view.totals).toMatchObject({ open_tasks: 3, open_snags: 1, waiting_on_owner: 2, percent: null });
    expect(view.totals.measured_of).toMatch(/of/);
  });

  it('reads as short WhatsApp lines with no internal fields unless asked', () => {
    const text = statementText(view);
    expect(text).toContain('Pending works — A-01');
    expect(text).toContain('Kitchen: Task t1');
    expect(text).toContain('NEEDED FROM YOU');
    expect(text).not.toContain('[t1]');
    expect(statementText(view, { includeRefs: true })).toContain('[t1]');
  });

  it('flags a villa marked Works Completed while work is still open', () => {
    const v2 = villaStatementView({ location: locations[1], tasks, snags: [], floors: [], ix, asOf: AS_OF });
    expect(v2.contradiction).toMatch(/Works Completed/);
    const attention = attentionFor({ tasks, locations, areas: [], floors: [], dependencies: [], updates: [], asOf: AS_OF, ix, options: {} });
    expect(attention.items.some((i) => i.code === 'completed_with_open_work' && i.villa === 'A-02')).toBe(true);
  });
});
