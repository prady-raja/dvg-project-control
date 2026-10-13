import { describe, expect, it } from 'vitest';
import { accessLine, canMoveVisit, confirmInput, noShowCount, requestInput, requestMessage, tasksNeedingAccess } from '../base44/shared/ownerAccess.ts';

describe('visit states', () => {
  it('moves only along legal steps', () => {
    expect(canMoveVisit('Requested', 'Confirmed')).toBe(true);
    expect(canMoveVisit('Requested', 'Done')).toBe(false);
    expect(canMoveVisit('Confirmed', 'No-show')).toBe(true);
    expect(canMoveVisit('Done', 'Cancelled')).toBe(false);
    expect(canMoveVisit('No-show', 'Confirmed')).toBe(false);
  });
});

describe('what goes into a visit', () => {
  const t = (id, extra = {}) => ({ id, location_id: 'v1', status: 'In Progress', ...extra });
  it('only open work in this villa that needs the owner', () => {
    const list = tasksNeedingAccess([
      t('1', { access_status: 'Pending' }), t('2', { blocker_category: 'Owner Access Pending' }), t('3'), t('4', { access_status: 'Pending', status: 'Closed' }),
      t('5', { access_status: 'Pending', location_id: 'v2' }), t('6', { owner_access_required: 'Yes' }),
    ], 'v1');
    expect(list.map((x) => x.id)).toEqual(['1', '2', '6']);
  });
  it('a request needs a task and sensible times', () => {
    expect(() => requestInput({ task_ids: [] })).toThrow(/at least one task/);
    expect(() => requestInput({ task_ids: ['1'], window_start: '10:00', window_end: '09:00' })).toThrow(/end after/);
    expect(() => requestInput({ task_ids: ['1'], visit_date: '2026-01-01' }, { today: '2026-02-01' })).toThrow(/past/);
    expect(requestInput({ task_ids: ['1', '1', '2'] }).task_ids).toEqual(['1', '2']);
  });
  it('confirming needs a date, a window and how it was agreed', () => {
    expect(() => confirmInput({}, {})).toThrow(/date/);
    expect(() => confirmInput({ visit_date: '2026-03-12', window_start: '10:00', window_end: '17:00' }, {})).toThrow(/how it was confirmed/);
    expect(confirmInput({ visit_date: '2026-03-12', window_start: '10:00', window_end: '17:00', confirmed_via: 'WhatsApp' }, {}, { today: '2026-03-01' }).confirmed_via).toBe('WhatsApp');
  });
});

describe('words', () => {
  it('shows the booking as a line', () => {
    expect(accessLine({ status: 'Confirmed', visit_date: '2026-03-12', window_start: '10:00', window_end: '17:00' })).toBe('Access booked Thu 10:00–17:00');
    expect(accessLine({ status: 'Requested', visit_date: '2026-03-12' })).toBe('');
  });
  it('the owner message lists works, trades and hours', () => {
    const msg = requestMessage({
      location: { villa_code: 'B-05-06', owner_name: 'Mr Rao', access_notes: 'Key with security' },
      tasks: [{ name: 'Painting', contractor_id: 'c1', estimated_manhours: 20 }, { name: 'AC install', contractor_id: 'c2', estimated_manhours: 6 }],
      contractors: [{ id: 'c1', trade: 'Painting' }, { id: 'c2', name: 'CoolAir' }],
      visit: { visit_date: '2026-03-12', window_start: '10:00', window_end: '17:00' },
    });
    expect(msg).toContain('B-05-06');
    expect(msg).toContain('• Painting');
    expect(msg).toContain('Trades: Painting, CoolAir');
    expect(msg).toContain('26 working hours');
    expect(msg).toContain('Key with security');
  });
  it('counts no-shows per villa', () => expect(noShowCount([{ location_id: 'a', status: 'No-show' }, { location_id: 'a', status: 'Done' }, { location_id: 'b', status: 'No-show' }], 'a')).toBe(1));
});

import { myWorkView } from '../base44/shared/myWork.ts';
import { buildIndex } from '../base44/shared/dashboardCore.ts';

describe('Today shows booked access', () => {
  const asOf = '2026-03-10';
  const locations = [{ id: 'v1', project_id: 'p', villa_code: 'B-05', location_type: 'Villa', assigned_engineer_user_id: 'me' }];
  const tasks = [{ id: 't1', project_id: 'p', location_id: 'v1', status: 'In Progress', assignee_user_id: 'me', baseline_finish: '2026-04-01' }];
  const ix = buildIndex({ projects: [{ id: 'p' }], locations, tasks });
  const visits = [
    { id: 'a', project_id: 'p', location_id: 'v1', status: 'Confirmed', visit_date: '2026-03-12', window_start: '10:00', window_end: '17:00', task_ids: ['t1'] },
    { id: 'b', project_id: 'p', location_id: 'v1', status: 'Requested', visit_date: '2026-03-12', task_ids: [] },
    { id: 'c', project_id: 'p', location_id: 'v1', status: 'Confirmed', visit_date: '2026-03-01', task_ids: [] },
    { id: 'd', project_id: 'p', location_id: 'v1', status: 'Confirmed', visit_date: '2026-06-01', task_ids: [] },
  ];
  const view = myWorkView({ tasks, locations, visits, ix, asOf, user: { id: 'me', full_name: 'Me' }, options: {} });
  it('only confirmed visits in the next two weeks', () => {
    expect(view.access_visits.map((v) => v.id)).toEqual(['a']);
    expect(view.access_visits[0].line).toBe('Access booked Thu 10:00–17:00');
  });
});
