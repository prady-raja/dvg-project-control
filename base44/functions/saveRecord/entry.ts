import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  activeMembers,
  canManageProject,
  isAppAdmin,
  isMembershipRole,
  MEMBERSHIP_ROLES,
  memberIdsOf,
  rankForRole,
  resolveRank,
  syncProjectMemberIds,
} from '../../shared/access.ts';
import { actorName, fail, getOne, listAll } from '../../shared/records.ts';
import { writeRecordAudit } from '../../shared/recordAudit.ts';
import { AREA_TYPES, normalizeAreaName } from '../../shared/villaAreas.ts';

const DRAWING_TYPES = [
  'Floor Plan', 'Furniture Layout', 'Electrical Layout', 'Plumbing Layout',
  'Elevation', 'Section', 'Site Plan', 'Detail', 'Other',
];
const DEPENDENCY_TYPES = ['Finish to Start', 'Start to Start', 'Finish to Finish', 'Start to Finish'];
const DELETABLE = ['ProjectMembership', 'Project', 'TaskDependency'];

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
    'enabled', 'allowed_roles', 'model', 'provider', 'provider_api', 'base_url', 'daily_request_limit', 'context_item_limit',
    'instructions', 'notes',
  ],
  VillaFloor: ['project_id', 'phase_id', 'location_id', 'floor_code', 'floor_name', 'level_order', 'active', 'notes'],
  VillaArea: [
    'project_id', 'phase_id', 'location_id', 'floor_id', 'area_code', 'area_name', 'aliases', 'source_name',
    'area_type', 'sort_order', 'active', 'source', 'notes', 'is_demo',
  ],
  Drawing: [
    'project_id', 'phase_id', 'location_id', 'floor_id', 'title', 'drawing_type', 'revision',
    'revision_date', 'uploaded_date', 'file_uri', 'file_name', 'status', 'supersedes_id', 'notes', 'is_demo',
  ],
  TaskDependency: [
    'project_id', 'predecessor_task_id', 'successor_task_id', 'dependency_type', 'lag_days', 'active', 'notes',
  ],
};

const PROJECT_SCOPED = [
  'Phase', 'Location', 'WorkPackage', 'ContractorDefault', 'ProjectMembership', 'MeetingCommitment',
  'VillaFloor', 'VillaArea', 'Drawing', 'TaskDependency',
];

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
    VillaFloor: svc.VillaFloor,
    VillaArea: svc.VillaArea,
    Drawing: svc.Drawing,
    TaskDependency: svc.TaskDependency,
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
    if (entityName === 'Contractor' || entityName === 'Discipline' || entityName === 'AiSettings' || entityName === 'ProjectMembership') {
      if (!appAdmin) {
        throw fail(
          entityName === 'AiSettings'
            ? 'Only an application administrator can change the AI controls.'
            : entityName === 'ProjectMembership'
              ? 'Only an application administrator can change project membership.'
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
        throw fail('Only a Project Editor or an administrator can change this record.', 403);
      }
    }

    /* ------------------------------------------------------------------ delete */
    if (action === 'delete') {
      if (!DELETABLE.includes(entityName)) {
        throw fail(
          entityName === 'TaskDependency'
            ? 'That link was not found.'
            : 'Records are archived rather than deleted — switch them off instead.',
        );
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
      // A drawing revision supersedes the previous one after it is created, so
      // the older row is never edited before the new one exists.
      let priorDrawing = null;
      if (entityName === 'Project') payload.member_ids = [];
      if (entityName === 'ProjectMembership') {
        const email = String(payload.user_email || '').trim().toLowerCase();
        if (!email) throw fail('An email address is required.');
        if (!isMembershipRole(payload.role)) throw fail(`Choose a project role: ${MEMBERSHIP_ROLES.join(', ')}.`);
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

      /* ---------------------------------------- floors and rooms of a villa */
      if (entityName === 'VillaFloor' || entityName === 'VillaArea') {
        const location = await getOne(svc.Location, payload.location_id || '');
        if (!location) throw fail('Choose the villa or location this belongs to.');
        if (location.project_id !== projectId) throw fail('That villa belongs to a different project.');
        if (!payload.phase_id) payload.phase_id = location.phase_id || null;
        payload.active = payload.active !== false;

        if (entityName === 'VillaFloor') {
          payload.floor_name = String(payload.floor_name || '').trim();
          if (!payload.floor_name) throw fail('Name the floor, for example Ground Floor.');
          payload.level_order = payload.level_order === null || payload.level_order === undefined
            ? null
            : Number(payload.level_order);
        } else {
          payload.area_name = String(payload.area_name || '').trim();
          if (!payload.area_name) throw fail('Name the room or area, for example Master Bedroom.');
          // The matching key is derived on the server, never typed into a screen.
          payload.normalized_name = normalizeAreaName(payload.area_name);
          payload.aliases = (Array.isArray(payload.aliases) ? payload.aliases : [])
            .map((alias) => String(alias || '').trim())
            .filter(Boolean)
            .slice(0, 20);
          if (payload.floor_id) {
            const floor = await getOne(svc.VillaFloor, payload.floor_id);
            if (!floor || floor.location_id !== location.id) throw fail('That floor belongs to a different villa.');
          }
          payload.area_type = AREA_TYPES.includes(payload.area_type) ? payload.area_type : 'Room';
          payload.source = payload.source === 'Drawing review' ? 'Drawing review' : 'Manual';

          // Two rooms of one villa that answer to the same name are the exact
          // ambiguity that must be resolved by a person, not by a guess.
          const siblings = listAll(await target.filter({ location_id: location.id }, { limit: 300 }));
          const clash = siblings.find(
            (row) => (row.normalized_name || normalizeAreaName(row.area_name)) === payload.normalized_name,
          );
          if (clash) {
            throw fail(`${location.villa_code} already has an area called ${clash.area_name}. Use that one, or give this room a distinct name or an alias.`);
          }
        }
      }

      /* ------------------------------------------------- drawing register */
      if (entityName === 'Drawing') {
        const location = payload.location_id ? await getOne(svc.Location, payload.location_id) : null;
        if (location && location.project_id !== projectId) throw fail('That villa belongs to a different project.');
        if (!String(payload.file_uri || '').trim()) throw fail('Upload the drawing file first.');
        payload.title = String(payload.title || '').trim();
        if (!payload.title) throw fail('Give the drawing a title.');
        if (!payload.phase_id && location) payload.phase_id = location.phase_id || null;
        if (payload.floor_id) {
          const floor = await getOne(svc.VillaFloor, payload.floor_id);
          if (!floor || (location && floor.location_id !== location.id)) throw fail('That floor belongs to a different villa.');
        }
        payload.drawing_type = DRAWING_TYPES.includes(payload.drawing_type) ? payload.drawing_type : 'Floor Plan';
        payload.uploaded_date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.uploaded_date || ''))
          ? payload.uploaded_date
          : new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
        payload.status = 'Current';
        payload.uploaded_by_id = user.id;
        payload.uploaded_by_name = actorName(user);

        if (location) {
          const current = listAll(
            await svc.Drawing.filter(
              { location_id: location.id, title: payload.title, status: 'Current' },
              { limit: 5 },
            ),
          );
          priorDrawing = current[0] || null;
          if (priorDrawing) payload.supersedes_id = priorDrawing.id;
        }
      }

      /* ------------------------------------------------- dependencies */
      if (entityName === 'TaskDependency') {
        const predecessor = await getOne(svc.Task, payload.predecessor_task_id || '');
        const successor = await getOne(svc.Task, payload.successor_task_id || '');
        if (!predecessor || !successor) throw fail('Both the task that blocks and the task that is blocked are required.');
        if (predecessor.project_id !== projectId || successor.project_id !== projectId) {
          throw fail('Both tasks must be on this project.');
        }
        if (predecessor.id === successor.id) throw fail('A task cannot depend on itself.');
        payload.dependency_type = DEPENDENCY_TYPES.includes(payload.dependency_type) ? payload.dependency_type : 'Finish to Start';
        payload.lag_days = Number.isFinite(Number(payload.lag_days)) ? Number(payload.lag_days) : 0;
        payload.active = payload.active !== false;

        const duplicate = listAll(
          await svc.TaskDependency.filter(
            { predecessor_task_id: predecessor.id, successor_task_id: successor.id, active: true },
            { limit: 5 },
          ),
        );
        if (duplicate.length) {
          throw fail(`${predecessor.task_ref} is already recorded as blocking ${successor.task_ref}.`);
        }
      }

      const created = await target.create(payload);
      // A villa or location is audited like a task: who changed it, what it said
      // before, what it says now, and when — written from the stored record.
      if (entityName === 'Location') {
        await writeRecordAudit(base44, {
          entity: 'Location',
          before: null,
          after: created,
          projectId,
          memberIds: created.member_ids || payload.member_ids,
          user,
          note: 'Villa or location added',
        });
      }
      if (entityName === 'Drawing' && priorDrawing) {
        await svc.Drawing.update(priorDrawing.id, { status: 'Superseded', superseded_by_id: created.id });
      }
      if (entityName === 'ProjectMembership') await syncProjectMemberIds(base44, projectId);
      return Response.json({ record: created, superseded: priorDrawing ? priorDrawing.revision || priorDrawing.title : '' });
    }

    /* ------------------------------------------------------------------ update */
    // Renaming a room re-derives its matching key, so the register and the
    // matcher can never disagree.
    if (entityName === 'VillaArea' && Object.prototype.hasOwnProperty.call(payload, 'area_name')) {
      const name = String(payload.area_name || '').trim();
      if (!name) throw fail('A room or area needs a name.');
      payload.area_name = name;
      payload.normalized_name = normalizeAreaName(name);
    }
    if (entityName === 'VillaArea' && Array.isArray(payload.aliases)) {
      payload.aliases = payload.aliases.map((alias) => String(alias || '').trim()).filter(Boolean).slice(0, 20);
    }
    if (entityName === 'Drawing' && payload.status && !['Current', 'Superseded'].includes(payload.status)) {
      throw fail('A drawing is either current or superseded.');
    }

    if (entityName === 'ProjectMembership' && Object.prototype.hasOwnProperty.call(payload, 'role')
      && !isMembershipRole(payload.role)) {
      throw fail(`Choose a project role: ${MEMBERSHIP_ROLES.join(', ')}.`);
    }

    const updated = await target.update(id, payload);
    if (entityName === 'Location') {
      await writeRecordAudit(base44, {
        entity: 'Location',
        before: existing,
        changes: payload,
        after: updated,
        projectId: updated.project_id || projectId,
        memberIds: updated.member_ids,
        user,
        note: 'Villa or location changed',
      });
    }
    if (entityName === 'ProjectMembership') {
      await syncProjectMemberIds(base44, projectId || updated.project_id);
    }
    return Response.json({ record: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}