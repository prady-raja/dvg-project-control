// N-02 — Today: the work that is mine; N-01 — the menu badge counts.
import { describe, expect, it } from 'vitest';
import { buildIndex } from '../base44/shared/dashboardCore.ts';
import { countsView, isMine, myWorkView, previousWorkingDay } from '../base44/shared/myWork.ts';
import { projectSettings } from '../base44/shared/calendar.ts';

const AS_OF = '2026-10-13'; // Tuesday
const me = { id: 'u1', full_name: 'Priya Nair' };
const locations = [
  { id: 'v1', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-01', assigned_engineer_user_id: 'u1' },
  { id: 'v2', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-02', assigned_engineer: 'Someone Else' },
  { id: 'v3', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-03', active_status: 'On Hold' },
];
const t = (id, over = {}) => ({ id, task_ref: id, name: id, project_id: 'p', phase_id: 'a', location_id: 'v1', discipline: 'CIVIL', status: 'In Progress', baseline_finish: '2026-12-31', latest_report_date: '2026-10-13', assignee_user_id: 'u1', ...over });
const tasks = [
  t('overdue', { baseline_finish: '2026-10-05' }),
  t('blocked', { status: 'Blocked', blocker_description: 'x', blocked_since: '2026-10-08' }),
  t('soon', { baseline_finish: '2026-10-16' }),
  t('stale', { latest_report_date: '2026-09-20' }),
  t('fine'),
  t('others', { assignee_user_id: 'u2', baseline_finish: '2026-10-01' }),
  t('typed', { assignee_user_id: '', responsible_engineer: 'priya nair', baseline_finish: '2026-10-01' }),
  t('held', { location_id: 'v3', baseline_finish: '2026-10-01' }),
  t('demo', { is_demo: true, baseline_finish: '2026-10-01' }),
];
const updates = [
  { id: 'r1', update_date: '2026-10-13', location_id: 'v2', reported_by_id: 'u2', task_id: 'others' },
  { id: 'r0', update_date: '2026-10-12', location_id: 'v1', task_id: 'overdue', task_ref: 'overdue', villa_code: 'A-01', plan_tomorrow: 'Start tiling', reported_by_name: 'Priya' },
  { id: 'r00', update_date: '2026-10-12', location_id: 'v2', task_id: 'others', plan_tomorrow: 'Not mine' },
];
const ix = buildIndex({ projects: [{ id: 'p', name: 'Imagine' }], phases: [{ id: 'a', name: 'A' }], locations, tasks, updates });
const base = { tasks, locations, ix, asOf: AS_OF, user: me, updates, options: { projectId: 'p' } };

describe('N-02 my work', () => {
  it('mine means assigned to me, or my full name typed before accounts existed', () => {
    expect(isMine(tasks[0], { id: 'u1', name: 'x' })).toBe(true);
    expect(isMine(tasks[5], { id: 'u1', name: 'x' })).toBe(false);
    expect(isMine(tasks[6], { id: 'u1', name: 'Priya Nair' })).toBe(true);
    expect(isMine(tasks[6], { id: 'u1', name: 'Priya' })).toBe(false);
  });

  it('lists what needs me, worst first, with the reason', () => {
    const view = myWorkView(base);
    const ids = view.tasks.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['overdue', 'typed', 'blocked', 'soon', 'stale']));
    expect(ids).not.toContain('fine');
    expect(ids).not.toContain('others');
    expect(ids).not.toContain('held');
    expect(ids).not.toContain('demo');
    expect(view.tasks[0].reasons[0].code).toBe('overdue');
    expect(view.counts.overdue).toBe(2);
  });

  it('marks each of my villas reported or not reported today', () => {
    const view = myWorkView(base);
    expect(view.villas.map((v) => v.code)).toEqual(['A-01']);
    expect(view.villas[0].reported_today).toBe(false);
    const withReport = myWorkView({ ...base, updates: [...updates, { id: 'x', update_date: AS_OF, location_id: 'v1', reported_by_id: 'u1' }] });
    expect(withReport.villas[0]).toMatchObject({ reported_today: true, reported_by_me: true });
  });

  it("shows yesterday's plan_tomorrow as today's plan, for my work only", () => {
    const view = myWorkView(base);
    expect(view.plan_day).toBe('2026-10-12');
    expect(view.plan.map((p) => p.plan)).toEqual(['Start tiling']);
  });

  it('skips Sunday when finding the previous working day', () => {
    expect(previousWorkingDay('2026-10-12', projectSettings(null))).toBe('2026-10-10'); // Monday -> Saturday
  });

  it('commitments are due or missed, worked out on read', () => {
    const commitments = [
      { id: 'c1', status: 'Open', promised_date: '2026-10-10', commitment: 'Deliver tiles', responsible_user_id: 'u1', project_id: 'p' },
      { id: 'c2', status: 'Open', promised_date: '2026-10-15', commitment: 'Fix door', responsible_person: 'Priya Nair', project_id: 'p' },
      { id: 'c3', status: 'Open', promised_date: '2026-11-30', commitment: 'Far off', responsible_user_id: 'u1', project_id: 'p' },
      { id: 'c4', status: 'Fulfilled', promised_date: '2026-10-10', responsible_user_id: 'u1', project_id: 'p' },
    ];
    const view = myWorkView({ ...base, commitments });
    expect(view.commitments.map((c) => [c.id, c.missed])).toEqual([['c1', true], ['c2', false]]);
  });

  it('coordinators can switch to all villas and see report coverage', () => {
    const view = myWorkView({ ...base, options: { projectId: 'p', allVillas: true } });
    expect(view.mode).toBe('all');
    expect(view.coverage).toMatchObject({ villas: 2, reported: 1, not_reported: ['A-01'] });
    expect(view.headline.overdue).toBeGreaterThanOrEqual(3);
  });
});

describe('N-01 badge counts', () => {
  it('come from the same filters as every board', () => {
    const counts = countsView({ ...base, snags: [{ status: 'Open', project_id: 'p' }, { status: 'Closed', project_id: 'p' }, { status: 'Awaiting Reinspection', project_id: 'p' }] });
    expect(counts.snags).toBe(2);
    expect(counts.blockers).toBe(1); // held and demo work is excluded
    expect(counts.today).toBe(3); // my overdue (2) + blocked (1)
  });
});
