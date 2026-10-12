// D-01 — history starts being kept now.
import { describe, expect, it } from 'vitest';
import { buildSnapshots, changeSinceLastWeek, isSnapshotTime, snapshotMetricsOf } from '../base44/shared/snapshots.ts';
import { buildIndex, ragOf, actorFor } from '../base44/shared/dashboardCore.ts';
import { executiveView } from '../base44/shared/dashboardViews.ts';

const AS_OF = '2026-10-12';
const locations = [
  { id: 'v1', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-01', possession_status: 'Handed Over' },
  { id: 'v2', project_id: 'p', phase_id: 'b', location_type: 'Villa', villa_code: 'B-01' },
];
const phases = [{ id: 'a', project_id: 'p', name: 'Phase A', code: 'A' }, { id: 'b', project_id: 'p', name: 'Phase B', code: 'B' }];
const projects = [{ id: 'p', name: 'Imagine', member_ids: ['u1'] }];
const t = (id, over = {}) => ({ id, project_id: 'p', phase_id: 'a', location_id: 'v1', discipline: 'CIVIL', status: 'In Progress', baseline_finish: '2026-12-01', ...over });
const tasks = [
  t('t1', { baseline_finish: '2026-10-01' }), // overdue, handed-over villa
  t('t2', { access_status: 'Pending' }), // waiting on the owner
  t('t3', { phase_id: 'b', location_id: 'v2', status: 'Blocked', blocker_description: 'x', blocker_category: 'Materials Pending' }),
  t('t4', { status: 'Execution Complete' }),
];
const ix = buildIndex({ projects, phases, locations, tasks });

describe('D-01 snapshots', () => {
  it('writes one row per project and per phase', () => {
    const rows = buildSnapshots({ data: { tasks, locations, phases, projects, ix }, asOf: AS_OF });
    expect(rows.map((r) => `${r.scope_type}:${r.scope_id}`)).toEqual(['project:p', 'phase:a', 'phase:b']);
    expect(rows[0]).toMatchObject({ snapshot_date: AS_OF, project_id: 'p', member_ids: ['u1'] });
    expect(rows[0].metrics).toMatchObject({ open: 4, overdue: 1, blocked: 1, awaiting_verification: 1 });
    expect(rows[2].metrics.blocked).toBe(1);
  });

  it('only runs after 23:30 IST', () => {
    expect(isSnapshotTime(Date.UTC(2026, 9, 12, 18, 0))).toBe(true); // 23:30 IST exactly
    expect(isSnapshotTime(Date.UTC(2026, 9, 12, 17, 59))).toBe(false);
  });

  it('shows no change until a snapshot about a week old exists', () => {
    const current = { overdue: 5, blocked: 2, open: 40 };
    expect(changeSinceLastWeek({ snapshots: [], current, asOf: AS_OF })).toBeNull();
    expect(changeSinceLastWeek({ snapshots: [{ snapshot_date: '2026-10-09', metrics: { overdue: 1 } }], current, asOf: AS_OF })).toBeNull();
    const change = changeSinceLastWeek({
      snapshots: [{ snapshot_date: '2026-10-05', metrics: { overdue: 8, blocked: 2, open: 30 } }, { snapshot_date: '2026-10-04', metrics: { overdue: 99 } }],
      current,
      asOf: AS_OF,
    });
    expect(change).toEqual({ since: '2026-10-05', deltas: { overdue: -3, blocked: 0, open: 10 } });
  });
});

describe('D-01 headline numbers', () => {
  const view = executiveView({ tasks, locations, phases, projects, ix, options: { projectId: 'p', locations }, asOf: AS_OF });

  it('counts the handed-over villas with open works and what waits on the owner', () => {
    expect(view.metrics.handed_over_open_works).toBe(1);
    expect(view.metrics.handed_over_open_tasks).toBe(3);
    expect(view.metrics.handed_over_waiting_on_owner).toBe(1);
  });

  it('gives each phase a red, amber or green line', () => {
    const a = view.phase_health.find((p) => p.code === 'A');
    const b = view.phase_health.find((p) => p.code === 'B');
    expect(a.rag).toBe('red'); // 1 overdue of 3 open is above 15%
    expect(b.rag).toBe('red'); // the only open task is blocked
    expect(ragOf({ open: 10, overdue: 0, blocked: 0, at_risk: 0 })).toBe('green');
    expect(ragOf({ open: 20, overdue: 1, blocked: 0, at_risk: 0 })).toBe('amber');
    expect(ragOf({ open: 0 })).toBe('green');
  });

  it('says who must act', () => {
    expect(actorFor({ status: 'Execution Complete' })).toBe('DVG');
    expect(actorFor({ status: 'Blocked', blocker_category: 'Owner Access Pending' })).toBe('Villa owner');
    expect(actorFor({ status: 'In Progress', decisions: ['Client selection pending'] })).toBe('Villa owner');
    expect(actorFor({ status: 'In Progress', decisions: [] })).toBe('Contractor');
  });

  it('keeps the snapshot numbers aligned with the headline', () => {
    expect(snapshotMetricsOf(view).overdue).toBe(view.metrics.overdue_tasks);
  });
});
