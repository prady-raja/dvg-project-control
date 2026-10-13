import { describe, expect, it } from 'vitest';
import { coverageView, lastWorkingDays } from '../base44/shared/coverage.ts';
import { projectSettings } from '../base44/shared/calendar.ts';

const settings = projectSettings({ working_days: [1, 2, 3, 4, 5, 6], holidays: ['2026-03-10'] });
const asOf = '2026-03-12'; // a Thursday
const villas = [
  { id: 'v1', location_type: 'Villa', villa_code: 'B-02', assigned_engineer_user_id: 'u1', assigned_engineer: 'Asha' },
  { id: 'v2', location_type: 'Villa', villa_code: 'B-10' },
  { id: 'v3', location_type: 'Villa', villa_code: 'B-03', active_status: 'On Hold' },
];

describe('lastWorkingDays', () => {
  it('skips Sundays and holidays', () => {
    const d = lastWorkingDays(asOf, settings, 5);
    expect(d).toEqual(['2026-03-07', '2026-03-09', '2026-03-11', '2026-03-12', '2026-03-06'].sort());
    expect(d).not.toContain('2026-03-08');
    expect(d).not.toContain('2026-03-10');
  });
});

describe('coverageView', () => {
  const updates = [
    { location_id: 'v1', update_date: '2026-03-12', status: 'In Progress', reported_by_id: 'u1' },
    { location_id: 'v1', update_date: '2026-03-11', status: 'Blocked', reported_by_id: 'u1' },
    { location_id: 'v1', update_date: '2026-03-09', voided: true },
  ];
  const view = coverageView({ locations: villas, updates, tasks: [], members: [{ user_id: 'u1', name: 'Asha' }], settings, asOf, days: 4 });
  it('holds on-hold villas out and sorts villa codes naturally', () => expect(view.rows.map((r) => r.villa)).toEqual(['B-02', 'B-10']));
  it('marks reported, blocked and none', () => {
    const v1 = view.rows[0].cells.map((c) => c.state);
    expect(v1).toEqual(['none', 'none', 'blocked', 'reported']);
  });
  it('a voided report does not count', () => expect(view.rows[0].cells.find((c) => c.day === '2026-03-09').state).toBe('none'));
  it('counts villas not reported today and never reported', () => {
    expect(view.totals.unreported_today).toBe(1);
    expect(view.totals.never_reported).toBe(1);
  });
  it('the team table counts reports today per engineer', () => expect(view.team.find((t) => t.user_id === 'u1').reports_today).toBe(1));
});
