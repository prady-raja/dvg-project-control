/**
 * The one place project records are loaded for a signed-in user.
 *
 * Both the dashboard function and the AI function read through this module, so
 * the permission boundary is written once: the accessible project list comes
 * from the user's own membership (or an application administrator's blanket
 * access), and every query is filtered by that list before it leaves the
 * server. No screen and no model can widen the scope.
 */

import { APP_ADMIN_RANK, isAppAdmin, resolveRank } from './access.ts';
import { listAll } from './records.ts';
import { buildIndex, shiftDay, todayIst } from './dashboardCore.ts';
import { makeDb } from './dbCore.ts';

/** Daily reports are read for this many days back; staleness and blocker dates never need older ones. */
export const UPDATE_WINDOW_DAYS = 60;
/** A safety ceiling per collection, far above any real project; hitting it is reported, never hidden. */
const MAX_ROWS = 20000;

/** Project ids the signed-in user may see at all. */
export async function accessibleProjectIds(base44, user) {
  const svc = base44.asServiceRole.entities;
  if (isAppAdmin(user)) {
    const res = await svc.Project.filter({}, { limit: 200, fields: ['id'] });
    return listAll(res).map((p) => p.id);
  }
  const res = await svc.ProjectMembership.filter(
    { user_id: user.id, active: true },
    { limit: 200, fields: ['project_id'] },
  );
  return [...new Set(listAll(res).map((m) => m.project_id).filter(Boolean))];
}

/** The caller's rank in a scope, plus the project ids they may read. */
export async function scopeFor(base44, user, projectId) {
  const projectIds = await accessibleProjectIds(base44, user);
  if (projectId && !projectIds.includes(projectId)) {
    return { projectIds, projectId: '', allowed: false, rank: -1 };
  }
  const rank = projectId
    ? await resolveRank(base44, projectId, user)
    : isAppAdmin(user)
      ? APP_ADMIN_RANK
      : 0;
  return { projectIds, projectId, allowed: true, rank };
}

/**
 * Load everything a view needs, already bounded to the permitted projects.
 * `load` decides which of the heavier collections are fetched, so a simple
 * dashboard does not pay for dependencies, snags or site reports.
 */
export async function loadProjectData(base44, user, options = {}) {
  const svc = base44.asServiceRole.entities;
  const db = makeDb({ entities: svc });
  const projectIds = options.projectIds && options.projectIds.length
    ? options.projectIds
    : await accessibleProjectIds(base44, user);
  const scopeIds = options.projectId ? [options.projectId] : projectIds;
  const inScope = { $in: scopeIds };
  const load = {
    updates: options.updates === true,
    dependencies: options.dependencies === true,
    commitments: options.commitments === true,
    snags: options.snags === true,
  };
  const asOf = options.asOf || todayIst();

  const [projectsRes, phasesRes, locationsRes, contractorsRes, disciplinesRes] = await Promise.all([
    db.readAll('Project', { id: inScope }),
    db.readAll('Phase', { project_id: inScope }),
    db.readAll('Location', { project_id: inScope }),
    db.readAll('Contractor', {}),
    db.readAll('Discipline', {}),
  ]);

  const updatesFrom = shiftDay(asOf, -UPDATE_WINDOW_DAYS);
  const empty = { items: [], truncated: false };
  const [tasksRes, updatesRes, dependenciesRes, commitmentsRes, snagsRes] = await Promise.all([
    db.readAll('Task', { project_id: inScope, archived: { $ne: true } }, { max: MAX_ROWS }),
    load.updates
      ? db.readAll('DailyUpdate', { project_id: inScope, reported_at: { $gte: `${updatesFrom}T00:00:00Z` } }, { sort: '-reported_at', max: MAX_ROWS })
      : empty,
    load.dependencies ? db.readAll('TaskDependency', { project_id: inScope }, { max: MAX_ROWS }) : empty,
    load.commitments ? db.readAll('MeetingCommitment', { project_id: inScope }, { sort: '-meeting_date', max: MAX_ROWS }) : empty,
    load.snags ? db.readAll('Snag', { project_id: inScope }, { sort: '-raised_date', max: MAX_ROWS }) : empty,
  ]);

  const tasks = tasksRes.items;
  const updates = updatesRes.items;
  const dependencies = dependenciesRes.items;
  const commitments = commitmentsRes.items;
  const snags = snagsRes.items;
  const truncated = [
    ['tasks', tasksRes], ['daily reports', updatesRes], ['dependencies', dependenciesRes],
    ['commitments', commitmentsRes], ['snags', snagsRes],
  ].filter(([, res]) => res.truncated).map(([name]) => name);

  const ix = buildIndex({
    projects: projectsRes.items,
    phases: phasesRes.items,
    locations: locationsRes.items,
    contractors: contractorsRes.items,
    disciplines: disciplinesRes.items,
    updates,
  });

  return {
    asOf,
    projects: projectsRes.items,
    phases: phasesRes.items,
    locations: locationsRes.items,
    contractors: contractorsRes.items,
    disciplines: disciplinesRes.items,
    tasks,
    updates,
    dependencies,
    commitments,
    snags,
    ix,
    reportWindow: { from: shiftDay(asOf, -7), to: asOf },
    meta: { truncated, updates_from: load.updates ? updatesFrom : '', counts: { tasks: tasks.length, snags: snags.length, commitments: commitments.length } },
  };
}

/** Small, shared payload header so every screen states its own data date. */
export const viewHeader = (asOf, scope) => ({
  as_of: asOf,
  generated_at: new Date().toISOString(),
  scope,
});