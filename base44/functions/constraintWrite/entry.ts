import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canEditTasks, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { constraintInput } from '../../shared/constraints.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import { diffFields, writeTaskHistory } from '../../shared/history.ts';
import { blockedStateFor, deriveTaskEffects, guardTaskChanges } from '../../shared/taskWriteRules.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { withLog } from '../../shared/log.ts';

/**
 * Raise, change, chase and clear a blocker (F-02). The constraint row and the
 * task's blocker summary are written together, through the same shared rules as
 * every other path into a task, so the task, the Blocker board and the history
 * can never disagree.
 */
const CLEAR_TO = ['In Progress', 'Not Started'];

async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const svc = base44.asServiceRole.entities;

    let constraint = null;
    let task = null;
    if (action === 'raise') {
      task = await getOne(svc.Task, String(body?.task_id || ''));
    } else {
      constraint = await getOne(svc.TaskConstraint, String(body?.constraint_id || ''));
      if (!constraint) throw fail('That blocker no longer exists.', 404);
      task = await getOne(svc.Task, constraint.task_id);
    }
    if (!task) throw fail('That task no longer exists.', 404);
    if (task.is_villa_work_parent === true || task.archived === true) throw fail('A blocker cannot be raised on this record.');

    const rank = await resolveRank(base44, task.project_id, user);
    if (!canEditTasks(rank)) throw fail(rank < 0 ? 'You are not a member of this project.' : 'Your project role is read-only.', 403);

    const members = await activeMembers(base44, task.project_id);
    const memberIds = memberIdsOf(members);
    const today = todayIst();
    const now = new Date().toISOString();

    /** Apply task changes through the shared rules, then write the history. */
    const writeTask = async (changes, note) => {
      Object.assign(changes, blockedStateFor({ task, next: changes }).patch);
      const entries = diffFields(task, changes);
      guardTaskChanges({ task, entries, rank, user });
      const effects = deriveTaskEffects({ task, entries, user });
      if (!entries.length) return task;
      const patch = { updated_by_name: actorName(user), member_ids: memberIds, ...effects.patch };
      entries.forEach((e) => { patch[e.field_changed] = e.new_value; });
      const updated = await svc.Task.update(task.id, patch);
      await writeTaskHistory(base44, { task, projectId: task.project_id, memberIds, user, note, entries, extra: effects.derived });
      return updated;
    };

    if (action === 'raise') {
      if (!['Not Started', 'In Progress', 'Blocked'].includes(task.status)) {
        throw fail('Only work that is still to be executed can be blocked.');
      }
      const input = constraintInput(body, { today });
      // A member chosen as the owner is checked; the typed name is kept as the display.
      if (input.owner_type === 'DVG' && input.owner_id) {
        const person = members.find((m) => m.user_id === input.owner_id);
        if (!person) throw fail('The person chosen must be a member of this project.');
        input.owner_name = input.owner_name || person.name || person.email;
      }
      if (input.owner_type === 'Contractor' && input.owner_id) {
        const contractor = await getOne(svc.Contractor, input.owner_id);
        if (!contractor) throw fail('That contractor no longer exists.');
        input.owner_name = input.owner_name || contractor.name;
      }
      const existing = (await svc.TaskConstraint.filter({ task_id: task.id, status: 'Open' }, { limit: 1 }));
      const open = (existing?.items || existing || [])[0];
      const base = {
        ...input,
        project_id: task.project_id, phase_id: task.phase_id || null, location_id: task.location_id || null,
        task_id: task.id, task_ref: task.task_ref || '', status: 'Open', member_ids: memberIds,
      };
      const saved = open
        ? await svc.TaskConstraint.update(open.id, base)
        : await svc.TaskConstraint.create({ ...base, raised_by_name: actorName(user), raised_at: now, chase_count: 0 });
      const updatedTask = await writeTask({
        status: 'Blocked',
        blocker_category: input.category,
        blocker_description: input.description,
        blocker_responsible_party: input.owner_name || input.owner_type,
      }, `Blocked — ${input.category}${input.owner_name ? `, owner ${input.owner_name}` : ''}${input.due_date ? `, to clear by ${input.due_date}` : ''}`);
      return Response.json({ constraint: saved, task: updatedTask });
    }

    if (constraint.status !== 'Open') throw fail('That blocker has already been cleared.');

    if (action === 'update') {
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(body, 'due_date')) {
        const due = String(body.due_date || '');
        if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw fail('The date must be a real date.');
        patch.due_date = due || null;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'owner_type') || Object.prototype.hasOwnProperty.call(body, 'owner_name')) {
        const merged = constraintInput({ ...constraint, ...body }, {});
        patch.owner_type = merged.owner_type;
        patch.owner_id = merged.owner_id;
        patch.owner_name = merged.owner_name;
      }
      const saved = await svc.TaskConstraint.update(constraint.id, patch);
      if (patch.owner_name || patch.owner_type) {
        await writeTask({ blocker_responsible_party: patch.owner_name || patch.owner_type }, 'Blocker owner changed');
      }
      return Response.json({ constraint: saved });
    }

    if (action === 'chase') {
      const saved = await svc.TaskConstraint.update(constraint.id, {
        last_chased_at: now, chase_count: (Number(constraint.chase_count) || 0) + 1,
      });
      await svc.TaskHistory.create({
        task_id: task.id, project_id: task.project_id, member_ids: memberIds, change_type: 'Blocker Chased',
        field_changed: 'blocker', old_value: '', new_value: constraint.owner_name || constraint.owner_type || '',
        changed_by_id: user.id, changed_by_name: actorName(user), changed_at: now,
        note: `Chased ${constraint.owner_name || constraint.owner_type || 'the owner'} about ${constraint.category}`,
      });
      return Response.json({ constraint: saved });
    }

    if (action === 'clear') {
      const next = CLEAR_TO.includes(body?.next_status) ? body.next_status : '';
      if (!next) throw fail('Choose the status the work moves to: In Progress or Not Started.');
      const updatedTask = await writeTask({ status: next }, `Unblocked — moved to ${next}`);
      const saved = await svc.TaskConstraint.update(constraint.id, {
        status: 'Cleared', cleared_at: now, cleared_by_name: actorName(user), clear_note: String(body?.note || '').slice(0, 500) || null,
      });
      return Response.json({ constraint: saved, task: updatedTask });
    }

    throw fail('Unknown action.');
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('constraintWrite', handler);
