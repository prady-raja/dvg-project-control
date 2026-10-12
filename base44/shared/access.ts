/**
 * Shared project-permission engine.
 *
 * Every step-up decision in the app is made here, on the server, from the
 * signed-in user's own identity — never from anything the browser sends.
 * Project roles live in ProjectMembership; the application-wide role
 * ("admin") sits above them.
 */

export const ROLE_RANK = {
  Viewer: 0,
  Supervisor: 1,
  'Site Engineer': 1,
  // The operational permission level: every site, MEP, procurement, planning and
  // management user works at this one level, whatever their designation says.
  'Project Editor': 2,
  // Legacy levels, kept so records written before Project Editor still resolve.
  'Project Manager': 2,
  'Project Admin': 3,
};

/**
 * The one list of project roles a membership may carry. Project Editor (the
 * default for every invite) leads; the legacy roles stay valid until they are
 * migrated to Project Editor or Viewer.
 */
export const MEMBERSHIP_ROLES = ['Project Editor', 'Viewer', 'Project Admin', 'Project Manager', 'Site Engineer', 'Supervisor'];

export const isMembershipRole = (role) => MEMBERSHIP_ROLES.includes(String(role || ''));

/** Application administrator — set by the app owner in App Users, never by the app itself. */
export const APP_ADMIN_RANK = 4;

export const rankForRole = (role) =>
  Object.prototype.hasOwnProperty.call(ROLE_RANK, role) ? ROLE_RANK[role] : -1;

export const isAppAdmin = (user) => user?.role === 'admin';

/* ---------------------------------------------------------------- capabilities */

/** Any active membership, including read-only Viewer. */
export const canView = (rank) => rank >= 0;
/** Create and update tasks in the assigned project. */
export const canEditTasks = (rank) => rank >= 1;
/** Manage schedules, approvals, baselines, membership and record lifecycle. */
export const canManageProject = (rank) => rank >= 2;
/** Approve or close completed work. */
export const canApproveWork = (rank) => rank >= 2;
/** Edit a draft or replace an approved baseline. */
export const canEditBaselines = (rank) => rank >= 2;
/**
 * Add or change project members. Application administrator only: a project role
 * — including the legacy Project Admin — never carries this.
 */
export const canManageMembers = (rank) => rank >= APP_ADMIN_RANK;
/** Archive or restore records. Engineers may not delete records. */
export const canManageRecordLifecycle = (rank) => rank >= 2;
/** Create or delete a project — application administrator only. */
export const canManageProjects = (rank) => rank >= APP_ADMIN_RANK;

/* ---------------------------------------------------------------- membership */

/** The caller's rank on one project, or -1 when they have no active membership. */
export async function resolveRank(base44, projectId, user) {
  if (isAppAdmin(user)) return APP_ADMIN_RANK;
  if (!projectId || !user?.id) return -1;
  const res = await base44.asServiceRole.entities.ProjectMembership.filter(
    { project_id: projectId, user_id: user.id, active: true },
    { limit: 1 },
  );
  const record = (res?.items || res || [])[0];
  return record ? rankForRole(record.role) : -1;
}

/** The caller's project role name, or '' when they have no active membership. */
export async function resolveRole(base44, projectId, user) {
  if (isAppAdmin(user)) return 'Application Admin';
  if (!projectId || !user?.id) return '';
  const res = await base44.asServiceRole.entities.ProjectMembership.filter(
    { project_id: projectId, user_id: user.id, active: true },
    { limit: 1 },
  );
  const record = (res?.items || res || [])[0];
  return record?.role || '';
}

export async function activeMembers(base44, projectId) {
  const res = await base44.asServiceRole.entities.ProjectMembership.filter(
    { project_id: projectId, active: true },
    { limit: 200 },
  );
  return (res?.items || res || []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    email: m.user_email,
  }));
}

export const memberIdsOf = (members) =>
  [...new Set((members || []).map((m) => m.user_id).filter(Boolean))];

/**
 * Membership is mirrored onto each project-scoped record as `member_ids`, which
 * is what the entity access rules read. Records are therefore readable by the
 * project's members and nobody else — enforced by the platform, not the page.
 */
const sameIds = (a, b) => {
  const left = [...new Set(a.filter(Boolean))].sort();
  const right = [...new Set(b.filter(Boolean))].sort();
  return left.length === right.length && left.every((id, i) => id === right[i]);
};

/** Every entity whose read access rule depends on the member_ids mirror. */
export const MEMBER_ID_ENTITIES = [
  'Task',
  'TaskHistory',
  'DailyUpdate',
  'BaselineVersion',
  'Location',
  'Phase',
  'WorkPackage',
  'ContractorDefault',
  'TaskDependency',
  'ProjectMembership',
  'VillaFloor',
  'VillaArea',
  'Drawing',
  'MeetingCommitment',
  'Snag',
  'ImportBatch',
  'RecordAudit',
  'RefAllocation',
  'AiProposal',
];

// Safety bound on updateMany batches per entity, far above any real project.
const MAX_SYNC_BATCHES = 200;

/**
 * `force` re-stamps every record even when Project.member_ids already matches,
 * which is how sync_all backfills records created before someone joined.
 */
export async function syncProjectMemberIds(base44, projectId, memberIds, { force = false } = {}) {
  if (!projectId) return [];
  const svc = base44.asServiceRole.entities;
  const ids = memberIds || memberIdsOf(await activeMembers(base44, projectId));

  // The common case is "nothing changed" — that must cost one read, not a sweep.
  if (!force) {
    const projectRes = await svc.Project.filter({ id: projectId }, { limit: 1 });
    const project = (projectRes?.items || projectRes || [])[0];
    if (project && sameIds(project.member_ids || [], ids)) return ids;
  }

  for (const name of MEMBER_ID_ENTITIES) {
    const target = svc[name];
    if (!target) continue;
    for (let i = 0; i < MAX_SYNC_BATCHES; i += 1) {
      const res = await target.updateMany({ project_id: projectId }, { $set: { member_ids: ids } });
      if (!res?.has_more) break;
    }
  }
  await svc.Project.update(projectId, { member_ids: ids });
  return ids;
}

/**
 * A membership may be recorded before the person has signed in, in which case
 * it has an email but no user id. The first time that person loads the app the
 * record is claimed. Only the signed-in user's own email can be claimed.
 */
export async function linkPendingMemberships(base44, user) {
  if (!user?.email) return { linked: 0, projectIds: [] };
  const svc = base44.asServiceRole.entities;
  const res = await svc.ProjectMembership.filter(
    { user_email: String(user.email).trim().toLowerCase() },
    { limit: 100 },
  );
  const records = res?.items || res || [];
  const pending = records.filter((m) => m.user_id !== user.id && m.active !== false);
  if (!pending.length) return { linked: 0, projectIds: [] };
  await svc.ProjectMembership.bulkUpdate(
    pending.map((m) => ({ id: m.id, user_id: user.id, user_name: user.full_name || m.user_name || '' })),
  );
  return { linked: pending.length, projectIds: pending.map((m) => m.project_id) };
}