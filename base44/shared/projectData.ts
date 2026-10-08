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

const MAX_TASKS = 2000;
const PAGE = 500;
const TASK_PAGES = Math.ceil(MAX_TASKS / PAGE);
const MAX_UPDATES = 600;
const MAX_ROWS = 1000;

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
    svc.Project.filter({ id: inScope }, { limit: 200 }),
    svc.Phase.filter({ project_id: inScope }, { limit: 400 }),
    svc.Location.filter({ project_id: inScope }, { limit: MAX_ROWS }),
    svc.Contractor.filter({}, { limit: 300 }),
    svc.Discipline.filter({}, { limit: 200 }),
  ]);

  const tasks = [];
  let cursor;
  for (let page = 0; page < TASK_PAGES; page += 1) {
    const res = await svc.Task.filter(
      { project_id: inScope, archived: { $ne: true } },
      { limit: PAGE, cursor },
    );
    tasks.push(...listAll(res));
    cursor = res?.next_cursor;
    if (!res?.has_more || !cursor) break;
  }

  const [updatesRes, dependenciesRes, commitmentsRes, snagsRes] = await Promise.all([
    load.updates
      ? svc.DailyUpdate.filter({ project_id: inScope }, { sort: '-reported_at', limit: MAX_UPDATES })
      : Promise.resolve([]),
    load.dependencies
      ? svc.TaskDependency.filter({ project_id: inScope }, { limit: MAX_ROWS })
      : Promise.resolve([]),
    load.commitments
      ? svc.MeetingCommitment.filter({ project_id: inScope }, { sort: '-meeting_date', limit: 500 })
      : Promise.resolve([]),
    load.snags
      ? svc.Snag.filter({ project_id: inScope }, { sort: '-raised_date', limit: 500 })
      : Promise.resolve([]),
  ]);

  const updates = listAll(updatesRes);
  const dependencies = listAll(dependenciesRes);
  const commitments = listAll(commitmentsRes);
  const snags = listAll(snagsRes);

  const ix = buildIndex({
    projects: listAll(projectsRes),
    phases: listAll(phasesRes),
    locations: listAll(locationsRes),
    contractors: listAll(contractorsRes),
    disciplines: listAll(disciplinesRes),
    updates,
  });

  return {
    asOf,
    projects: listAll(projectsRes),
    phases: listAll(phasesRes),
    locations: listAll(locationsRes),
    contractors: listAll(contractorsRes),
    disciplines: listAll(disciplinesRes),
    tasks,
    updates,
    dependencies,
    commitments,
    snags,
    ix,
    reportWindow: { from: shiftDay(asOf, -7), to: asOf },
  };
}

/** Small, shared payload header so every screen states its own data date. */
export const viewHeader = (asOf, scope) => ({
  as_of: asOf,
  generated_at: new Date().toISOString(),
  scope,
});