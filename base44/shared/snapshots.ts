/**
 * Daily snapshots of the headline numbers (D-01). Until a scheduler exists, the
 * first dashboard read after 23:30 IST writes the day's snapshot for every
 * project and phase the reader can see (upsert on scope + date, so it is safe to
 * run twice). On Supabase the same function runs from Supabase Cron.
 */
import { executiveView } from './dashboardViews.ts';
import { shiftDay } from './dashboardCore.ts';

export const SNAPSHOT_AFTER = '23:30';

/** Minutes past midnight IST for a timestamp. */
export const istMinutes = (now = Date.now()) => {
  const d = new Date(now + 330 * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

export const isSnapshotTime = (now = Date.now()) => {
  const [h, m] = SNAPSHOT_AFTER.split(':').map(Number);
  return istMinutes(now) >= h * 60 + m;
};

/** The numbers a snapshot keeps, taken from an executive view. */
export const snapshotMetricsOf = (view) => ({
  open: view.metrics.open_tasks,
  overdue: view.metrics.overdue_tasks,
  at_risk: view.metrics.at_risk_tasks,
  blocked: view.metrics.blocked_tasks,
  awaiting_verification: view.metrics.awaiting_verification,
  handed_over_open_works: view.metrics.handed_over_open_works,
});

/**
 * One snapshot row per project and per phase of that project, for `asOf`. Pure:
 * the caller supplies the loaded data and writes the rows.
 */
export function buildSnapshots({ data, asOf, memberIdsByProject = {} }) {
  const rows = [];
  const base = { tasks: data.tasks, locations: data.locations, phases: data.phases, projects: data.projects, ix: data.ix, asOf };
  data.projects.forEach((project) => {
    const projectView = executiveView({ ...base, options: { projectId: project.id, locations: data.locations } });
    const member_ids = memberIdsByProject[project.id] || project.member_ids || [];
    rows.push({ scope_type: 'project', scope_id: project.id, project_id: project.id, snapshot_date: asOf, metrics: snapshotMetricsOf(projectView), member_ids });
    data.phases.filter((phase) => phase.project_id === project.id).forEach((phase) => {
      const view = executiveView({ ...base, options: { projectId: project.id, phaseId: phase.id, locations: data.locations } });
      rows.push({ scope_type: 'phase', scope_id: phase.id, project_id: project.id, snapshot_date: asOf, metrics: snapshotMetricsOf(view), member_ids });
    });
  });
  return rows;
}

const METRIC_KEYS = ['overdue', 'at_risk', 'blocked', 'awaiting_verification', 'open', 'handed_over_open_works'];

/**
 * Change since about a week ago, from the snapshot nearest to asOf - 7 within a
 * day either side. Null until such a snapshot exists — nothing is estimated.
 */
export function changeSinceLastWeek({ snapshots, current, asOf }) {
  const target = shiftDay(asOf, -7);
  const candidates = (snapshots || [])
    .filter((s) => s.snapshot_date >= shiftDay(asOf, -8) && s.snapshot_date <= shiftDay(asOf, -6))
    .sort((a, b) => Math.abs(Date.parse(a.snapshot_date) - Date.parse(target)) - Math.abs(Date.parse(b.snapshot_date) - Date.parse(target)));
  const base = candidates[0];
  if (!base) return null;
  const deltas = {};
  METRIC_KEYS.forEach((key) => {
    if (typeof base.metrics?.[key] === 'number' && typeof current?.[key] === 'number') deltas[key] = current[key] - base.metrics[key];
  });
  return { since: base.snapshot_date, deltas };
}
