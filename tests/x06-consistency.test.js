// X-06 — one meaning for every count, on every board.
import { describe, expect, it } from 'vitest';
import { buildIndex, isBlocked, weightedProgress, metricTasks, heldLocationIds } from '../base44/shared/dashboardCore.ts';
import {
  contractorBoardView, executiveView, planningView, villaExecutionView, PLANNING_BUCKETS,
} from '../base44/shared/dashboardViews.ts';
import { blockerBoardView, meetingReportView, expectedResolutionFor, handoverBoardView, siteWideView } from '../base44/shared/dashboardBoards.ts';
import { attentionFor, readinessOf, pageOf } from '../base44/shared/attention.ts';

const AS_OF = '2026-10-12';
const locations = [
  { id: 'v1', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-01', possession_status: 'Handed Over' },
  { id: 'v2', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-02', active_status: 'On Hold' },
];
const t = (id, over = {}) => ({
  id, task_ref: id, name: `Task ${id}`, project_id: 'p', phase_id: 'a', location_id: 'v1', discipline: 'CIVIL',
  contractor_id: 'c1', status: 'In Progress', baseline_finish: '2026-10-20', ...over,
});
const tasks = [
  t('t1', { status: 'Blocked', blocker_description: 'No cement', blocked_since: '2026-10-01' }),
  t('t2', { status: 'In Progress', blocker_description: 'Waiting for tiles' }), // blocker recorded, status not Blocked
  t('t3', { status: 'In Progress', baseline_finish: '2026-10-01' }), // overdue
  t('t4', { status: 'Execution Complete', baseline_finish: '2026-10-01' }), // finish passed, but awaiting verification
  t('t5', { status: 'Approved', baseline_finish: '2026-09-20' }),
  t('t6', { status: 'Not Started', baseline_finish: '', current_forecast_finish: '' }), // unscheduled
  t('t7', { status: 'Closed', blocker_description: 'old note' }),
  t('t8', { status: 'In Progress', is_demo: true, blocker_description: 'demo blocker' }),
  t('t9', { status: 'In Progress', location_id: 'v2' }), // villa on hold
  t('t10', { status: 'Not Started', baseline_finish: AS_OF }),
  t('t11', { status: 'Not Started', baseline_finish: '2026-10-13' }),
  t('t12', { status: 'Not Started', baseline_finish: '2026-12-31' }),
];
const ix = buildIndex({ locations, contractors: [{ id: 'c1', name: 'Alpha' }], projects: [{ id: 'p', name: 'Imagine' }] });
const options = { projectId: 'p', locations, contractorId: '' };

describe('X-06 blocked means one thing', () => {
  it('status Blocked or a recorded blocker on work still to be executed', () => {
    expect(isBlocked(tasks[0])).toBe(true);
    expect(isBlocked(tasks[1])).toBe(true);
    expect(isBlocked(tasks[3])).toBe(false);
    expect(isBlocked(tasks[6])).toBe(false); // closed, leftover note
  });

  it('the headline, the villa page, the contractor board and the blocker board agree', () => {
    const exec = executiveView({ tasks, locations, phases: [], projects: [{ id: 'p' }], ix, options, asOf: AS_OF });
    const villa = villaExecutionView({ tasks, location: locations[0], ix, asOf: AS_OF, options });
    const contractors = contractorBoardView({ tasks, contractors: [{ id: 'c1', name: 'Alpha' }], ix, options, asOf: AS_OF });
    const blockers = blockerBoardView({ tasks, ix, options, asOf: AS_OF, heldIds: heldLocationIds(locations) });
    const meeting = meetingReportView({ tasks, ix, options, asOf: AS_OF });
    expect(exec.metrics.blocked_tasks).toBe(2);
    expect(villa.counts.blocked).toBe(2);
    expect(villa.blockers).toHaveLength(2);
    expect(contractors.totals.blocked).toBe(2);
    expect(blockers.rows).toHaveLength(2);
    expect(blockers.counts.blocked).toBe(2);
    expect(meeting.counts.blocked).toBe(2);
  });
});

describe('X-06 one exclusion filter', () => {
  it('demo, archived and parent rows never count, and held villas are reported apart', () => {
    const exec = executiveView({ tasks, locations, phases: [], projects: [{ id: 'p' }], ix, options, asOf: AS_OF });
    expect(exec.metrics.demo_tasks_excluded).toBe(1);
    expect(exec.metrics.held_open_tasks).toBe(1);
    const blocked = metricTasks(tasks, 'blocked', AS_OF, { locations, heldIds: heldLocationIds(locations), projectId: 'p' });
    expect(blocked.map((x) => x.id).sort()).toEqual(['t1', 't2']);
  });

  it('the contractor board now sees held villas (it used to report 0)', () => {
    const board = contractorBoardView({ tasks, contractors: [{ id: 'c1', name: 'Alpha' }], ix, options, asOf: AS_OF });
    expect(board.rows[0].on_hold_tasks).toBe(1);
  });

  it('Needs Attention leaves demo tasks out', () => {
    const view = attentionFor({ tasks, locations, areas: [], floors: [], dependencies: [], updates: [], asOf: AS_OF, ix, options });
    expect(view.items.some((item) => item.task_id === 't8')).toBe(false);
  });
});

describe('X-06 planning buckets add up to the open count', () => {
  it('every outstanding row sits in exactly one bucket', () => {
    const plan = planningView({ tasks, ix, options, asOf: AS_OF });
    const total = PLANNING_BUCKETS.reduce((sum, name) => sum + plan.counts[name], 0);
    expect(total).toBe(plan.counts.open);
    // t3 overdue, t4 + t5 awaiting verification though their dates passed, t6 unscheduled
    expect(plan.counts.overdue).toBeGreaterThanOrEqual(1);
    expect(plan.counts.verification).toBe(2);
    expect(plan.counts.unscheduled).toBe(1);
    expect(plan.held_work_excluded).toBe(1);
  });
});

describe('X-06 other fixes', () => {
  it('an Approved predecessor is done for readiness', () => {
    const successor = t('s', { status: 'Not Started' });
    const readiness = readinessOf(successor, {
      dependencies: [{ successor_task_id: 's', predecessor_task_id: 't5' }],
      tasksById: new Map(tasks.map((x) => [x.id, x])),
    });
    expect(readiness.state).toBe('Ready');
  });

  it('approved and closed work counts as 100%, and the share measured is stated', () => {
    const progress = weightedProgress([
      t('a', { status: 'Closed' }), t('b', { status: 'Approved' }), t('c', { progress_percent: 50 }),
    ]);
    expect(progress.reliable).toBe(true);
    expect(progress.percent).toBeCloseTo(83.3, 1);
    const partial = weightedProgress([t('a', { status: 'Closed' }), t('d', {})]);
    expect(partial.percent).toBeNull();
    expect(partial.measured_share).toBe(50);
  });

  it('expected resolution comes from the newest report since the task was blocked', () => {
    const index = buildIndex({
      updates: [
        { task_id: 't1', reported_at: '2026-09-20T05:00:00Z', update_date: '2026-09-20', expected_resolution_date: '2026-09-25' },
        { task_id: 't1', reported_at: '2026-10-03T05:00:00Z', update_date: '2026-10-03', expected_resolution_date: '2026-10-15' },
      ],
    });
    expect(expectedResolutionFor(tasks[0], index)).toBe('2026-10-15');
    expect(expectedResolutionFor({ ...tasks[0], blocked_since: '2026-10-10' }, index)).toBe('');
  });

  it('the meeting date is echoed in the scope', () => {
    const meeting = meetingReportView({ tasks, ix, options: { ...options, meetingDate: '2026-10-20' }, asOf: AS_OF });
    expect(meeting.meeting_date).toBe('2026-10-20');
    expect(meeting.scope.meeting_date).toBe('2026-10-20');
  });

  it('snags list Open before Closed', () => {
    const board = handoverBoardView({
      tasks, locations, ix, asOf: AS_OF, options,
      snags: [
        { id: 's1', status: 'Closed', location_id: 'v1', raised_date: '2026-10-01', closed_date: AS_OF },
        { id: 's2', status: 'Open', location_id: 'v1', raised_date: '2026-10-02' },
      ],
    });
    expect(board.snags.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('Needs Attention filters by code and pages on the server', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ code: i < 20 ? 'no_dates' : 'no_contractor' }));
    const page = pageOf(items, { code: 'no_contractor', itemLimit: 10 });
    expect(page.page.total).toBe(5);
    expect(page.items).toHaveLength(5);
    const first = pageOf(items, { code: 'no_dates', itemLimit: 10, offset: 0 });
    expect(first.page.has_more).toBe(true);
    expect(siteWideView).toBeTypeOf('function');
  });
});
