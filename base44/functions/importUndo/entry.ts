import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canManageProject, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { makeDb } from '../../shared/dbCore.ts';
import { planUndo, undoSummary } from '../../shared/importUndo.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { withLog } from '../../shared/log.ts';

const CHUNK = 50;

/**
 * Preview and apply the undo of one import batch. The preview writes nothing; the
 * apply archives what the batch created and puts back what it changed — skipping
 * anything edited since — and leaves a history row on every task it touches.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'preview');
    const svc = base44.asServiceRole.entities;
    const db = makeDb({ entities: svc });

    const batch = await getOne(svc.ImportBatch, String(body?.batch_id || ''));
    if (!batch) throw fail('That import batch was not found.', 404);
    const rank = await resolveRank(base44, batch.project_id, user);
    if (!canManageProject(rank)) throw fail('Only a Project Editor or an administrator can undo an import.', 403);

    // Every task the batch touched, read to the end.
    const ids = [...new Set((batch.report || []).map((entry) => entry.task_id).filter(Boolean))];
    const tasks = [];
    for (let i = 0; i < ids.length; i += 100) {
      tasks.push(...(await db.readAll('Task', { id: { $in: ids.slice(i, i + 100) } })).items);
    }
    const plan = planUndo({ batch, tasksById: new Map(tasks.map((t) => [t.id, t])) });
    if (plan.error) throw fail(plan.error);

    if (action === 'preview') {
      return Response.json({ batch_ref: batch.batch_ref, summary: undoSummary(plan), plan });
    }
    if (action !== 'apply') throw fail('Unknown action.');

    const memberIds = memberIdsOf(await activeMembers(base44, batch.project_id));
    const now = new Date().toISOString();
    const history = [];
    const failures = [];
    const row = (taskId, field, from, to, note) => ({
      task_id: taskId, project_id: batch.project_id, member_ids: memberIds, change_type: 'Import Undo',
      field_changed: field, old_value: from === null || from === undefined ? '' : String(from),
      new_value: to === null || to === undefined ? '' : String(to),
      changed_by_id: user.id, changed_by_name: actorName(user), changed_at: now,
      note: `Undo of import ${batch.batch_ref}: ${note}`,
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));

    for (let i = 0; i < plan.archive.length; i += CHUNK) {
      const slice = plan.archive.slice(i, i + CHUNK);
      try {
        await svc.Task.bulkUpdate(slice.map((entry) => ({ id: entry.task_id, archived: true, updated_by_name: actorName(user) })));
        slice.forEach((entry) => history.push(row(entry.task_id, 'archived', 'false', 'true', 'created by the import, archived')));
      } catch (error) {
        slice.forEach((entry) => failures.push({ ...entry, reason: error.message }));
      }
    }
    for (const entry of plan.revert) {
      try {
        await svc.Task.update(entry.task_id, { ...entry.patch, updated_by_name: actorName(user) });
        const current = byId.get(entry.task_id) || {};
        entry.fields.forEach((field) => history.push(row(entry.task_id, field, current[field], entry.patch[field], 'value put back')));
      } catch (error) {
        failures.push({ ...entry, reason: error.message });
      }
    }
    for (let i = 0; i < history.length; i += 100) await svc.TaskHistory.bulkCreate(history.slice(i, i + 100));

    const report = {
      archived: plan.archive.length - failures.filter((f) => !f.patch).length,
      reverted: plan.revert.length - failures.filter((f) => f.patch).length,
      skipped: plan.skipped,
      failed: failures,
    };
    await svc.ImportBatch.update(batch.id, {
      status: failures.length ? batch.status : 'Undone',
      undone_at: now,
      undone_by_name: actorName(user),
      undo_report: report,
    });
    return Response.json({ batch_ref: batch.batch_ref, ...report, partial: failures.length > 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('importUndo', handler);
