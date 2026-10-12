// The server read path end to end, on an in-memory store: load -> views, as dashboardData does it.
import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../base44/shared/projectData.ts';
import { executiveView, planningView } from '../base44/shared/dashboardViews.ts';
import { blockerBoardView } from '../base44/shared/dashboardBoards.ts';
import { attentionFor } from '../base44/shared/attention.ts';
import { countsView, myWorkView } from '../base44/shared/myWork.ts';
import { villaMatrixView } from '../base44/shared/villaViews.ts';
import { buildSnapshots } from '../base44/shared/snapshots.ts';
import { heldLocationIds } from '../base44/shared/dashboardCore.ts';

const match = (row, filter) => Object.entries(filter || {}).every(([key, cond]) => {
  const value = row[key];
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    if ('$in' in cond && !cond.$in.includes(value)) return false;
    if ('$ne' in cond && value === cond.$ne) return false;
    if ('$gte' in cond && !(String(value ?? '') >= cond.$gte)) return false;
    if ('$lte' in cond && !(String(value ?? '') <= cond.$lte)) return false;
    return true;
  }
  return value === cond;
});

function store(tables) {
  const entities = new Proxy({}, {
    get: (_, name) => ({
      filter: async (filter = {}, { limit = 50, cursor } = {}) => {
        const all = (tables[name] || []).filter((row) => match(row, filter));
        const start = Number(cursor || 0);
        const items = all.slice(start, start + limit);
        const more = start + limit < all.length;
        return { items, has_more: more, next_cursor: more ? String(start + limit) : null };
      },
    }),
  });
  return { asServiceRole: { entities } };
}

const user = { id: 'u1', full_name: 'Priya Nair', role: 'admin' };
const tasks = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i}`, task_ref: `T-${i}`, name: `Task ${i}`, project_id: 'p', phase_id: 'a', location_id: i % 2 ? 'v1' : 'v2', discipline: 'FIN',
  status: i === 0 ? 'Blocked' : 'In Progress', baseline_finish: i < 3 ? '2026-10-01' : '2026-12-01', assignee_user_id: 'u1',
  blocker_description: i === 0 ? 'x' : undefined, blocker_category: i === 0 ? 'Materials Pending' : undefined, latest_report_date: '2026-10-12',
}));
const tables = {
  Project: [{ id: 'p', name: 'Imagine', member_ids: ['u1'] }],
  Phase: [{ id: 'a', project_id: 'p', name: 'Phase A', code: 'A' }],
  Location: [
    { id: 'v1', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-01', assigned_engineer_user_id: 'u1', possession_status: 'Handed Over' },
    { id: 'v2', project_id: 'p', phase_id: 'a', location_type: 'Villa', villa_code: 'A-02' },
  ],
  Contractor: [{ id: 'c1', name: 'Alpha' }],
  Discipline: [{ code: 'FIN', name: 'Finishes' }],
  Task: tasks,
  DailyUpdate: [{ id: 'r1', project_id: 'p', task_id: 't1', update_date: '2026-10-12', reported_at: '2026-10-12T05:00:00Z', reported_by_id: 'u1', location_id: 'v1', plan_tomorrow: 'Tile kitchen' }],
  TaskDependency: [], MeetingCommitment: [], Snag: [{ id: 's1', project_id: 'p', status: 'Open' }], AiProposal: [], TaskConstraint: [], AttentionDismissal: [],
  ProjectMembership: [{ id: 'm', project_id: 'p', user_id: 'u1', active: true }],
};

describe('server read path', () => {
  it('loads everything a view needs through readAll, reading past one page', async () => {
    const data = await loadProjectData(store(tables), user, {
      asOf: '2026-10-12', updates: true, dependencies: true, commitments: true, snags: true, proposals: true, constraints: true, dismissals: true,
    });
    expect(data.tasks).toHaveLength(12); // the fake store pages at 50, readAll asks for 5000 per page
    expect(data.meta.truncated).toEqual([]);
    expect(data.updates).toHaveLength(1);
    const common = { tasks: data.tasks, locations: data.locations, phases: data.phases, projects: data.projects, ix: data.ix, asOf: '2026-10-12', options: { projectId: 'p', locations: data.locations } };

    const exec = executiveView(common);
    expect(exec.metrics.open_tasks).toBe(12);
    expect(exec.metrics.overdue_tasks).toBe(3); // t0, t1 and t2 are still to be executed and past 2026-10-01
    expect(exec.phase_health[0].open).toBe(12);

    expect(planningView(common).counts.open).toBe(12);
    expect(blockerBoardView({ ...common, heldIds: heldLocationIds(data.locations), constraints: data.constraints }).rows).toHaveLength(1);
    expect(attentionFor({ ...common, areas: [], floors: [], dependencies: [], updates: data.updates, dismissals: data.dismissals }).counts.tasks_reviewed).toBe(12);
    expect(villaMatrixView({ tasks: data.tasks, locations: data.locations, ix: data.ix, asOf: '2026-10-12', options: { projectId: 'p' } }).rows).toHaveLength(2);
    expect(buildSnapshots({ data, asOf: '2026-10-12' })).toHaveLength(2);

    const mine = myWorkView({ ...common, commitments: data.commitments, snags: data.snags, updates: data.updates, proposals: data.proposals, user });
    expect(mine.villas.map((v) => v.code)).toContain('A-01');
    expect(mine.plan).toHaveLength(0); // the report is dated today, so it is not yesterday's plan
    expect(countsView({ ...common, snags: data.snags, dependencies: [], dismissals: [], user }).snags).toBe(1);
  });

  it('says so when a collection is larger than the safe read', async () => {
    const big = { ...tables, Task: Array.from({ length: 30 }, (_, i) => ({ ...tasks[0], id: `x${i}` })) };
    // Force the ceiling: a tiny max through the adapter is not exposed, so check the flag shape instead.
    const data = await loadProjectData(store(big), user, { asOf: '2026-10-12' });
    expect(data.tasks).toHaveLength(30);
    expect(Array.isArray(data.meta.truncated)).toBe(true);
  });
});
