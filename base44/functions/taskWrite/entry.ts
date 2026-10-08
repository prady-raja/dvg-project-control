import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  activeMembers,
  canEditTasks,
  canManageProject,
  memberIdsOf,
  resolveRank,
} from '../../shared/access.ts';
import {
  BASELINE_FIELDS,
  diffFields,
  normalizeValue,
  TASK_FIELDS,
  writeTaskHistory,
} from '../../shared/history.ts';
import { allocateTaskRefs, attachTaskRefs, resolveRefCollisions } from '../../shared/taskRef.ts';
import { deriveTaskEffects, guardTaskChanges } from '../../shared/taskWriteRules.ts';
import { actorName, fail, getOne, listAll, pick } from '../../shared/records.ts';
import { describeScope } from '../../shared/villaAreas.ts';

/**
 * A task's floor and rooms are checked against the villa's own register before
 * they are stored, and the readable scope and the scope type are derived here, so
 * no screen and no message can state a scope the records do not support.
 */
async function resolveTaskScope(svc, { projectId, locationId, floorId, areaIds, scopeType }) {
  const ids = [...new Set((Array.isArray(areaIds) ? areaIds : []).filter(Boolean))];
  if (!ids.length && !floorId && !scopeType) return null;

  const areas = ids.length ? listAll(await svc.VillaArea.filter({ id: { $in: ids } }, { limit: 200 })) : [];
  if (areas.length !== ids.length) throw fail('One of the rooms chosen no longer exists.');
  const wrong = areas.find((area) => area.project_id !== projectId || (locationId && area.location_id !== locationId));
  if (wrong) throw fail(`The room “${wrong.area_name}” belongs to a different villa.`);

  const floor = floorId ? await getOne(svc.VillaFloor, floorId) : null;
  if (floorId && !floor) throw fail('That floor no longer exists.');
  if (floor && locationId && floor.location_id !== locationId) throw fail('That floor belongs to a different villa.');

  return describeScope({
    scope_type: scopeType,
    area_ids: ids,
    floor_id: floor?.id || '',
    location_id: locationId || '',
    areas,
    floors: floor ? [floor] : [],
  });
}

/**
 * The only path that creates or changes a task. Permissions are decided here
 * from the authenticated session, the audit trail is written from the trusted
 * before/after values, and approved baselines and approval separation are
 * enforced regardless of what the browser sends.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const changes = body?.changes && typeof body.changes === 'object' ? body.changes : {};
    const svc = base44.asServiceRole.entities;

    if (action === 'create') {
      if (Object.prototype.hasOwnProperty.call(changes, 'task_ref')) {
        throw fail('A task reference is issued by the system and cannot be set by hand.');
      }
      const projectId = String(changes.project_id || '');
      if (!projectId) throw fail('A project is required.');
      if (!String(changes.name || '').trim()) throw fail('A task name is required.');
      if (!String(changes.discipline || '').trim()) throw fail('A discipline is required.');

      let phaseId = changes.phase_id || null;
      let locationId = changes.location_id || null;
      let locationType = '';

      if (locationId) {
        const location = await getOne(svc.Location, locationId);
        if (!location) throw fail('That villa or location no longer exists.');
        if (location.project_id !== projectId) throw fail('That villa belongs to a different project.');
        phaseId = location.phase_id || phaseId;
        locationType = location.location_type || '';
      }
      if (phaseId) {
        const phase = await getOne(svc.Phase, phaseId);
        if (!phase) throw fail('That phase no longer exists.');
        if (phase.project_id !== projectId) throw fail('That phase belongs to a different project.');
      }

      const rank = await resolveRank(base44, projectId, user);
      if (!canEditTasks(rank)) {
        throw fail('You do not have permission to create tasks on this project.', 403);
      }

      const scope = await resolveTaskScope(svc, {
        projectId,
        locationId,
        floorId: changes.floor_id,
        areaIds: changes.area_ids,
        scopeType: changes.scope_type,
      });

      const memberIds = memberIdsOf(await activeMembers(base44, projectId));
      const [claim] = await allocateTaskRefs(base44.asServiceRole, projectId, phaseId, 1, {
        memberIds,
        userId: user.id,
        userName: actorName(user),
      });
      const taskRef = claim.ref;

      const payload = pick(changes, TASK_FIELDS);
      payload.project_id = projectId;
      payload.phase_id = phaseId;
      payload.location_id = locationId;
      payload.status = payload.status || 'Not Started';
      payload.task_ref = taskRef;
      payload.created_by_name = actorName(user);
      payload.updated_by_name = actorName(user);
      payload.is_demo = false;
      payload.archived = false;
      payload.is_villa_work_parent = false;
      // The scope is written from the register, not from what the caller claimed.
      const villaWork = !!locationId && locationType === 'Villa';
      payload.scope_type = scope?.scope_type || (villaWork ? 'Entire Villa' : 'Site-wide');
      payload.floor_id = scope?.floor_id || null;
      payload.area_ids = scope?.area_ids || [];
      payload.area_label = scope?.area_label || null;
      payload.member_ids = memberIds;

      const task = await svc.Task.create(payload);
      await attachTaskRefs(base44.asServiceRole, [{ claim, taskId: task.id }]);

      // Two simultaneous writers cannot share a number: a task that lost a
      // shared reference is re-issued the next free one before it is seen.
      const corrections = await resolveRefCollisions(base44.asServiceRole, projectId, [task]);

      const extra = [
        {
          change_type: 'Task Created',
          field_changed: 'task_ref',
          old_value: '',
          new_value: taskRef,
          note: 'Task created',
        },
      ];
      corrections.forEach((fix) => {
        extra.push({
          change_type: 'Reference Correction',
          field_changed: 'task_ref',
          old_value: fix.from,
          new_value: fix.to,
          note: 'Simultaneous claim — re-issued the next free reference',
        });
      });

      await writeTaskHistory(base44, { task, projectId, memberIds, user, extra });
      return Response.json({ task });
    }

    if (action === 'update') {
      if (Object.prototype.hasOwnProperty.call(changes, 'task_ref')) {
        throw fail('A task reference is issued by the system and cannot be changed.');
      }
      const id = String(body?.id || '');
      const task = await getOne(svc.Task, id);
      if (!task) throw fail('Task not found.', 404);

      const rank = await resolveRank(base44, task.project_id, user);
      if (!canEditTasks(rank)) {
        throw fail(
          rank < 0
            ? 'You are not a member of this project.'
            : 'Your project role is read-only.',
          403,
        );
      }

      const memberIds = memberIdsOf(await activeMembers(base44, task.project_id));

      // Where the work is goes through the same register check as a new task, and
      // the stored scope fields are re-derived rather than trusted.
      if (['location_id', 'floor_id', 'area_ids', 'scope_type'].some((field) => Object.prototype.hasOwnProperty.call(changes, field))) {
        const movingVilla = Object.prototype.hasOwnProperty.call(changes, 'location_id');
        const locationId = movingVilla ? changes.location_id : task.location_id;
        let locationType = '';
        if (locationId) {
          if (!movingVilla) {
            locationType = (await getOne(svc.Location, locationId))?.location_type || 'Villa';
          } else {
            const location = await getOne(svc.Location, locationId);
            if (!location) throw fail('That villa or location no longer exists.');
            if (location.project_id !== task.project_id) throw fail('That villa belongs to a different project.');
            locationType = location.location_type || '';
          }
        }
        const keepAreas = Object.prototype.hasOwnProperty.call(changes, 'area_ids');
        const scope = await resolveTaskScope(svc, {
          projectId: task.project_id,
          locationId,
          floorId: Object.prototype.hasOwnProperty.call(changes, 'floor_id')
            ? changes.floor_id
            : movingVilla ? '' : task.floor_id,
          areaIds: keepAreas ? changes.area_ids : movingVilla ? [] : task.area_ids,
          scopeType: changes.scope_type || (movingVilla ? '' : task.scope_type),
        });
        changes.floor_id = scope?.floor_id || null;
        changes.area_ids = scope?.area_ids || [];
        changes.area_label = scope?.area_label || null;
        changes.scope_type = scope?.scope_type || (locationId && locationType === 'Villa' ? 'Entire Villa' : 'Site-wide');
      }

      const entries = diffFields(task, changes, TASK_FIELDS);
      // A reason must accompany THIS revision — one recorded earlier does not
      // authorise a later date change.
      const reason = String(changes.date_revision_reason || '').trim();

      // Permission, the baseline lock, the approval separation and the reason
      // rule are decided once, for every write path into a task.
      guardTaskChanges({ task, entries, rank, user, reason });

      if (!entries.length) return Response.json({ task, changed: 0 });

      const patch = {};
      entries.forEach((entry) => {
        patch[entry.field_changed] = entry.new_value;
      });

      // Server-owned stamps, and the separation of duties, travel with the change.
      const effects = deriveTaskEffects({ task, entries, user });
      Object.assign(patch, effects.patch);
      const derived = effects.derived;

      const forecastEntry = entries.find((e) => e.field_changed === 'current_forecast_finish');

      patch.updated_by_name = actorName(user);
      patch.member_ids = memberIds;
      const updated = await svc.Task.update(id, patch);

      await writeTaskHistory(base44, {
        task,
        projectId: task.project_id,
        memberIds,
        user,
        note: forecastEntry ? `Forecast revision — ${reason}` : '',
        entries: entries.map((entry) =>
          entry.field_changed === 'current_forecast_finish' ? { ...entry, note: `Reason: ${reason}` } : entry,
        ),
        extra: derived,
      });

      return Response.json({ task: updated, changed: entries.length });
    }

    if (action === 'archive' || action === 'restore') {
      const id = String(body?.id || '');
      const task = await getOne(svc.Task, id);
      if (!task) throw fail('Task not found.', 404);

      const rank = await resolveRank(base44, task.project_id, user);
      if (!canManageProject(rank)) {
        throw fail('Only a Project Manager or an administrator can archive or restore a task.', 403);
      }

      const archived = action === 'archive';
      const memberIds = memberIdsOf(await activeMembers(base44, task.project_id));
      const updated = await svc.Task.update(id, { archived, updated_by_name: actorName(user) });
      await writeTaskHistory(base44, {
        task,
        projectId: task.project_id,
        memberIds,
        user,
        extra: [
          {
            change_type: 'Record Lifecycle',
            field_changed: 'archived',
            old_value: normalizeValue('archived', task.archived) ? 'true' : 'false',
            new_value: archived ? 'true' : 'false',
            note: archived ? 'Task archived' : 'Task restored',
          },
        ],
      });
      return Response.json({ task: updated });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}