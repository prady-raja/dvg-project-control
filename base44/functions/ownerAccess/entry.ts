import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canEditTasks, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import { diffFields, writeTaskHistory } from '../../shared/history.ts';
import { deriveTaskEffects, guardTaskChanges } from '../../shared/taskWriteRules.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { canMoveVisit, confirmInput, requestInput, requestMessage, tasksNeedingAccess } from '../../shared/ownerAccess.ts';
import { withLog } from '../../shared/log.ts';

/**
 * Owner access visits (P-09): request, confirm, mark done, no-show or cancel. Setting
 * access on the linked tasks goes through the same shared task rules as every other
 * write, and a confirmed date lands on their Owner Access Pending blocker records.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const svc = base44.asServiceRole.entities;
    const today = todayIst();
    const now = new Date().toISOString();

    let visit = null;
    let location = null;
    if (action === 'request') {
      location = await getOne(svc.Location, String(body?.location_id || ''));
    } else {
      visit = await getOne(svc.OwnerAccessVisit, String(body?.visit_id || ''));
      if (!visit) throw fail('That visit no longer exists.', 404);
      location = await getOne(svc.Location, visit.location_id);
    }
    if (!location) throw fail('That villa no longer exists.', 404);
    const projectId = location.project_id;

    const rank = await resolveRank(base44, projectId, user);
    if (!canEditTasks(rank)) throw fail(rank < 0 ? 'You are not a member of this project.' : 'Your project role is read-only.', 403);
    const memberIds = memberIdsOf(await activeMembers(base44, projectId));

    /** Set access_status on tasks through the shared rules; tasks already there are left alone. */
    const setAccess = async (taskIds, next, note) => {
      let changed = 0;
      for (const id of taskIds) {
        const task = await getOne(svc.Task, id);
        if (!task || task.project_id !== projectId || task.access_status === next) continue;
        const entries = diffFields(task, { access_status: next });
        guardTaskChanges({ task, entries, rank, user });
        const effects = deriveTaskEffects({ task, entries, user });
        await svc.Task.update(task.id, { access_status: next, updated_by_name: actorName(user), member_ids: memberIds, ...effects.patch });
        await writeTaskHistory(base44, { task, projectId, memberIds, user, entries, note });
        changed += 1;
      }
      return changed;
    };

    if (action === 'request') {
      const input = requestInput(body, { today });
      const tasks = [];
      for (const id of input.task_ids) {
        const task = await getOne(svc.Task, id);
        if (!task || task.location_id !== location.id) throw fail('Every task in a visit must belong to this villa.');
        tasks.push(task);
      }
      const eligible = new Set(tasksNeedingAccess(tasks, location.id).map((t) => t.id));
      const skipped = tasks.filter((t) => !eligible.has(t.id));
      if (skipped.length) throw fail(`${skipped[0].task_ref || 'A task'} does not need the owner's access, or is already finished.`);
      const contractors = (await svc.Contractor.filter({}, { limit: 300 }));
      const list = contractors?.items || contractors || [];
      const created = await svc.OwnerAccessVisit.create({
        ...input, project_id: projectId, phase_id: location.phase_id || null, location_id: location.id, status: 'Requested',
        contractor_ids: [...new Set(tasks.map((t) => t.contractor_id).filter(Boolean))],
        requested_by_name: actorName(user), requested_at: now, member_ids: memberIds,
      });
      return Response.json({ visit: created, message: requestMessage({ location, tasks, contractors: list, visit: created }) });
    }

    if (action === 'confirm') {
      if (!canMoveVisit(visit.status, 'Confirmed')) throw fail(`A ${visit.status.toLowerCase()} visit cannot be confirmed.`);
      const input = confirmInput(body, visit, { today });
      const saved = await svc.OwnerAccessVisit.update(visit.id, { ...input, status: 'Confirmed', confirmed_at: now });
      await setAccess(visit.task_ids || [], 'Confirmed', `Owner access confirmed for ${input.visit_date}`);
      // The date the owner agreed to goes on the blocker records waiting for it.
      let dated = 0;
      for (const id of visit.task_ids || []) {
        const found = await svc.TaskConstraint.filter({ task_id: id, status: 'Open', category: 'Owner Access Pending' }, { limit: 5 });
        for (const c of (found?.items || found || [])) { await svc.TaskConstraint.update(c.id, { due_date: input.visit_date }); dated += 1; }
      }
      return Response.json({ visit: saved, blockers_dated: dated });
    }

    if (action === 'done') {
      if (!canMoveVisit(visit.status, 'Done')) throw fail(`A ${visit.status.toLowerCase()} visit cannot be marked done.`);
      const saved = await svc.OwnerAccessVisit.update(visit.id, { status: 'Done' });
      // The caller offers a Log update for each linked task.
      return Response.json({ visit: saved, task_ids: visit.task_ids || [] });
    }

    if (action === 'no_show' || action === 'cancel') {
      const to = action === 'no_show' ? 'No-show' : 'Cancelled';
      if (!canMoveVisit(visit.status, to)) throw fail(`A ${visit.status.toLowerCase()} visit cannot be marked ${to.toLowerCase()}.`);
      const saved = await svc.OwnerAccessVisit.update(visit.id, { status: to, notes: String(body?.notes || visit.notes || '').slice(0, 1000) });
      // The works go back to waiting for the owner.
      const back = visit.status === 'Confirmed'
        ? await setAccess(visit.task_ids || [], 'Pending', to === 'No-show' ? 'Owner access visit did not happen' : 'Owner access visit cancelled')
        : 0;
      return Response.json({ visit: saved, returned_to_pending: back });
    }

    throw fail('Unknown action.', 400);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('ownerAccess', handler);
