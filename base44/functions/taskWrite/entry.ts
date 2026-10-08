import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  activeMembers,
  canApproveWork,
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
import { allocateTaskRefs } from '../../shared/taskRef.ts';
import { actorName, fail, getOne, pick } from '../../shared/records.ts';

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
      const projectId = String(changes.project_id || '');
      if (!projectId) throw fail('A project is required.');
      if (!String(changes.name || '').trim()) throw fail('A task name is required.');
      if (!String(changes.discipline || '').trim()) throw fail('A discipline is required.');

      let phaseId = changes.phase_id || null;
      let locationId = changes.location_id || null;

      if (locationId) {
        const location = await getOne(svc.Location, locationId);
        if (!location) throw fail('That villa or location no longer exists.');
        if (location.project_id !== projectId) throw fail('That villa belongs to a different project.');
        phaseId = location.phase_id || phaseId;
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

      const memberIds = memberIdsOf(await activeMembers(base44, projectId));
      const [taskRef] = await allocateTaskRefs(base44.asServiceRole, projectId, phaseId, 1);

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
      payload.member_ids = memberIds;

      const task = await svc.Task.create(payload);
      await writeTaskHistory(base44, {
        task,
        projectId,
        memberIds,
        user,
        extra: [
          {
            change_type: 'Task Created',
            field_changed: 'task_ref',
            old_value: '',
            new_value: taskRef,
            note: 'Task created',
          },
        ],
      });
      return Response.json({ task });
    }

    if (action === 'update') {
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
      const entries = diffFields(task, changes, TASK_FIELDS);
      // A reason must accompany THIS revision — one recorded earlier does not
      // authorise a later date change.
      const reason = String(changes.date_revision_reason || '').trim();
      const manager = canManageProject(rank);

      entries.forEach((entry) => {
        const field = entry.field_changed;
        if (field === 'archived' && !manager) {
          throw fail('Only a Project Manager or an administrator can archive or restore a task.', 403);
        }
        if ((field === 'project_id' || field === 'phase_id') && !manager) {
          throw fail('Only a Project Manager or an administrator can move a task between phases.', 403);
        }
        if (BASELINE_FIELDS.includes(field) && !manager) {
          if (task.baseline_locked === true || task.baseline_approval_status === 'Approved') {
            throw fail(
              'This task is covered by an approved baseline. Only a Project Manager or an administrator can change baseline dates.',
              403,
            );
          }
        }
      });

      const statusEntry = entries.find((e) => e.field_changed === 'status');
      if (statusEntry) {
        const next = statusEntry.new_value;
        if (next === 'Approved' || next === 'Closed') {
          if (!canApproveWork(rank)) {
            throw fail('Only a Project Manager or an administrator can approve or close work.', 403);
          }
          if (task.execution_completed_by_id && task.execution_completed_by_id === user.id) {
            throw fail('You cannot approve or close work you marked Execution Complete yourself.', 403);
          }
        }
      }

      const forecastEntry = entries.find((e) => e.field_changed === 'current_forecast_finish');
      if (forecastEntry && !reason) {
        throw fail('A forecast date change needs a date revision reason.');
      }

      const progressEntry = entries.find((e) => e.field_changed === 'progress_percent');
      if (progressEntry && progressEntry.new_value !== null) {
        const value = Number(progressEntry.new_value);
        if (value < 0 || value > 100) throw fail('Progress must be between 0 and 100.');
      }

      if (!entries.length) return Response.json({ task, changed: 0 });

      const patch = {};
      entries.forEach((entry) => {
        patch[entry.field_changed] = entry.new_value;
      });

      const derived = [];
      if (statusEntry) {
        const next = statusEntry.new_value;
        if (next === 'Execution Complete' || next === 'Under Inspection') {
          patch.execution_completed_by_id = user.id;
          patch.execution_completed_by_name = actorName(user);
          derived.push({
            change_type: 'Status Change',
            field_changed: 'execution_completed_by',
            old_value: task.execution_completed_by_name || '',
            new_value: actorName(user),
            note: 'Marked Execution Complete',
          });
        } else if (next === 'Not Started' || next === 'In Progress' || next === 'Blocked') {
          if (task.execution_completed_by_id) {
            patch.execution_completed_by_id = null;
            patch.execution_completed_by_name = null;
            derived.push({
              change_type: 'Status Change',
              field_changed: 'execution_completed_by',
              old_value: task.execution_completed_by_name || '',
              new_value: '',
              note: 'Reopened — previous Execution Complete stamp cleared',
            });
          }
        } else if (next === 'Approved' || next === 'Closed') {
          patch.approved_by_id = user.id;
          patch.approved_by_name = actorName(user);
          patch.approved_at = new Date().toISOString();
          derived.push({
            change_type: 'Approval',
            field_changed: 'approved_by',
            old_value: task.approved_by_name || '',
            new_value: actorName(user),
            note: next === 'Closed' ? 'Work closed' : 'Work approved',
          });
        }
      }
      // Progress reaching 100% never closes a task: no derived status change here.

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