import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  activeMembers,
  canManageProject,
  isAppAdmin,
  memberIdsOf,
  rankForRole,
  resolveRank,
  syncProjectMemberIds,
} from '../../shared/access.ts';
import { actorName, fail, getOne, listAll } from '../../shared/records.ts';

/** Only these fields are ever accepted from the browser — nothing else is written. */
const FIELDS = {
  Project: ['name', 'code', 'location', 'status', 'enabled_disciplines', 'planned_villa_count', 'notes'],
  Phase: ['project_id', 'name', 'code', 'planned_villa_count', 'status', 'sort_order', 'notes'],
  Location: [
    'project_id', 'phase_id', 'villa_code', 'location_type', 'plot_numbers',
    'possession_status', 'possession_date', 'works_stage', 'active_status',
    'planned_completion_date', 'assigned_engineer', 'sort_order', 'notes',
  ],
  WorkPackage: ['project_id', 'discipline', 'package_name', 'sort_order', 'active', 'notes'],
  ContractorDefault: ['project_id', 'phase_id', 'discipline', 'contractor_id', 'active', 'notes'],
  Contractor: ['name', 'classification', 'trade', 'contact_person', 'phone', 'email', 'active', 'notes'],
  Discipline: ['name', 'code', 'sort_order', 'active', 'notes'],
  ProjectMembership: ['user_email', 'user_name', 'project_id', 'role', 'active', 'notes'],
  MeetingCommitment: [
    'project_id', 'phase_id', 'contractor_id', 'task_id', 'meeting_date', 'commitment',
    'responsible_person', 'promised_date', 'status', 'fulfilled_date', 'remarks',
  ],
  AiSettings: [
    'enabled', 'allowed_roles', 'model', 'daily_request_limit', 'context_item_limit',
    'instructions', 'notes',
  ],
};

const MEMBERSHIP_ROLES = ['Project Admin', 'Project Manager', 'Site Engineer', 'Supervisor', 'Viewer'];

const PROJECT_SCOPED = ['Phase', 'Location', 'WorkPackage', 'ContractorDefault', 'ProjectMembership', 'MeetingCommitment'];

const clientFor = (svc, name) =>
  ({
    Project: svc.Project,
    Phase: svc.Phase,
    Location: svc.Location,
    WorkPackage: svc.WorkPackage,
    ContractorDefault: svc.ContractorDefault,
    Contractor: svc.Contractor,
    Discipline: svc.Discipline,
    ProjectMembership: svc.ProjectMembership,
    MeetingCommitment: svc.MeetingCommitment,
    AiSettings: svc.AiSettings,
  })[name] || null;

/**
 * The single guarded path for configuration records: projects, phases, villas,
 * work packages, contractor defaults, company lists and project membership.
 * The role required is decided here, on the server, from ProjectMembership.
 *
 * Note: because the app cannot read the user directory, a member is recorded by
 * email and matched to their account the first time they sign in.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const entityName = String(body?.entity || '');
    const action = String(body?.action || 'create');
    const data = body?.data && typeof body.data === 'object' ? body.data : {};
    const id = String(body?.id || '');
    const svc = base44.asServiceRole.entities;

    const target = clientFor(svc, entityName);
    const allowed = FIELDS[entityName];
    if (!target || !allowed) throw fail('Unsupported record type.');

    const payload = {};
    allowed.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        payload[field] = data[field] === '' || data[field] === undefined ? null : data[field];
      }
    });

    const existing = id ? await getOne(target, id) : null;
    if (action !== 'create' && !existing) throw fail('Record not found.', 404);

    const appAdmin = isAppAdmin(user);
    let projectId = entityName === 'Project' ? existing?.id || '' : payload.project_id || existing?.project_id || '';

    /* ------------------------------------------------------------ permissions */
    if (entityName === 'Contractor' || entityName === 'Discipline' || entityName === 'AiSettings') {
      if (!appAdmin) {
        throw fail(
          entityName === 'AiSettings'
            ? 'Only an application administrator can change the AI controls.'
            : 'Only an application administrator can change company-wide lists.',
          403,
        );
      }
    } else if (entityName === 'Project') {
      if (action === 'create' || action === 'delete') {
        if (!appAdmin) throw fail('Only an application administrator can create or remove a project.', 403);
      } else {
        const rank = await resolveRank(base44, existing.id, user);
        if (!canManageProject(rank)) {
          throw fail('You do not have permission to change this project.', 403);
        }
      }
    } else {
      if (!projectId) throw fail('A project is required.');
      const rank = await resolveRank(base44, projectId, user);
      if (!canManageProject(rank)) {
        throw fail('Only a Project Manager or an administrator can change this record.', 403);
      }
      if (entityName === 'ProjectMembership' && action !== 'delete') {
        const nextRole = String(payload.role || existing?.role || 'Site Engineer');
        if (!MEMBERSHIP_ROLES.includes(nextRole)) throw fail('Unknown project role.');
        if (!appAdmin && rankForRole(nextRole) > rank) {
          throw fail('You cannot grant a role above your own on this project.', 403);
        }
      }
    }

    /* ------------------------------------------------------------------ delete */
    if (action === 'delete') {
      if (entityName !== 'ProjectMembership' && entityName !== 'Project') {
        throw fail('Records are archived rather than deleted — switch them off instead.');
      }
      await target.delete(id);
      if (entityName === 'ProjectMembership') await syncProjectMemberIds(base44, projectId);
      return Response.json({ ok: true, deleted: id });
    }

    const isProjectScoped = PROJECT_SCOPED.includes(entityName);
    if (isProjectScoped && projectId) {
      payload.member_ids = memberIdsOf(await activeMembers(base44, projectId));
    }

    /* ------------------------------------------------------------------ create */
    if (action === 'create') {
      if (entityName === 'Project') payload.member_ids = [];
      if (entityName === 'ProjectMembership') {
        const email = String(payload.user_email || '').trim().toLowerCase();
        if (!email) throw fail('An email address is required.');
        if (!MEMBERSHIP_ROLES.includes(String(payload.role || ''))) throw fail('A project role is required.');
        const existingRes = await target.filter({ project_id: projectId, user_email: email }, { limit: 5 });
        if (listAll(existingRes).some((m) => m.active !== false)) {
          throw fail('That person is already a member of this project.');
        }
        payload.user_email = email;
        payload.user_name = String(payload.user_name || '').trim();
        payload.active = payload.active === null ? true : payload.active !== false;
        // user_id is claimed by the person themselves the first time they sign in.
        payload.user_id = '';
      }
      if (entityName === 'MeetingCommitment') {
        if (!String(payload.commitment || '').trim()) throw fail('Record what was committed.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.meeting_date || ''))) {
          payload.meeting_date = new Date().toISOString().slice(0, 10);
        }
        const task = payload.task_id ? await getOne(svc.Task, payload.task_id) : null;
        if (task && task.project_id !== projectId) throw fail('That task belongs to a different project.');
        payload.task_id = task ? task.id : null;
        payload.task_ref = task ? task.task_ref || '' : '';
        if (task && !payload.phase_id) payload.phase_id = task.phase_id || null;
        payload.status = ['Open', 'Fulfilled', 'Missed', 'Cancelled'].includes(payload.status) ? payload.status : 'Open';
        payload.recorded_by_id = user.id;
        payload.recorded_by_name = actorName(user);
      }
      if (entityName === 'AiSettings') payload.updated_by_name = actorName(user);
      if (entityName === 'Project') payload.code = String(payload.code || '').trim().toUpperCase();

      const created = await target.create(payload);
      if (entityName === 'ProjectMembership') await syncProjectMemberIds(base44, projectId);
      return Response.json({ record: created });
    }

    /* ------------------------------------------------------------------ update */
    const updated = await target.update(id, payload);
    if (entityName === 'ProjectMembership') {
      await syncProjectMemberIds(base44, projectId || updated.project_id);
    }
    return Response.json({ record: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}