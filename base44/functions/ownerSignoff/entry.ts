import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canEditTasks, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { ackInput } from '../../shared/ownerSignoff.ts';
import { withLog } from '../../shared/log.ts';

/**
 * Record the owner's sign-off on several items of one villa at once (Q-08) — for
 * example from the printed pending-works statement during an owner visit. It records
 * the acknowledgement; it does not close anything.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    const location = await getOne(svc.Location, String(body?.location_id || ''));
    if (!location) throw fail('That villa no longer exists.', 404);
    const rank = await resolveRank(base44, location.project_id, user);
    if (!canEditTasks(rank)) throw fail(rank < 0 ? 'You are not a member of this project.' : 'Your project role is read-only.', 403);

    const ack = { ...ackInput(body?.ack, { today: todayIst() }), owner_ack_by_name: actorName(user) };
    const taskIds = [...new Set((Array.isArray(body?.task_ids) ? body.task_ids : []).map(String))].slice(0, 100);
    const snagIds = [...new Set((Array.isArray(body?.snag_ids) ? body.snag_ids : []).map(String))].slice(0, 100);
    if (!taskIds.length && !snagIds.length) throw fail('Choose at least one item to record the sign-off for.');

    const memberIds = memberIdsOf(await activeMembers(base44, location.project_id));
    const when = new Date().toISOString();
    let signed = 0;
    const skipped = [];

    for (const id of taskIds) {
      const task = await getOne(svc.Task, id);
      if (!task || task.location_id !== location.id) { skipped.push(id); continue; }
      await svc.Task.update(task.id, { ...ack, updated_by_name: actorName(user) });
      await svc.TaskHistory.create({
        task_id: task.id, project_id: task.project_id, member_ids: memberIds, change_type: 'Owner Sign-off', field_changed: 'owner_ack',
        old_value: '', new_value: `${ack.owner_ack_name} · ${ack.owner_ack_date} · ${ack.owner_ack_method}`,
        changed_by_id: user.id, changed_by_name: actorName(user), changed_at: when, note: 'Owner sign-off recorded from the pending-works statement',
      });
      signed += 1;
    }
    for (const id of snagIds) {
      const snag = await getOne(svc.Snag, id);
      if (!snag || snag.location_id !== location.id) { skipped.push(id); continue; }
      await svc.Snag.update(snag.id, ack);
      signed += 1;
    }
    return Response.json({ signed, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('ownerSignoff', handler);
