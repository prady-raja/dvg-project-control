import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canManageProject, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { assigneeFor } from '../../shared/assignees.ts';
import { BULK_FIELDS, MAX_BULK, bulkChanges, dismissalFor } from '../../shared/attentionActions.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import { diffFields, writeTaskHistory } from '../../shared/history.ts';
import { deriveTaskEffects, guardTaskChanges } from '../../shared/taskWriteRules.ts';
import { makeDb } from '../../shared/dbCore.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { withLog } from '../../shared/log.ts';

/**
 * Acting on Needs Attention (D-03): dismiss an item with a reason, bring one back,
 * and set the same contractor, assignee or dates on many tasks. Every task change
 * goes through the shared write rules, so a frozen baseline or a forecast reason
 * is enforced exactly as in the editor, and each task gets its own history row.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const svc = base44.asServiceRole.entities;
    const db = makeDb({ entities: svc });
    const projectId = String(body?.project_id || '');
    if (!projectId) throw fail('A project is required.');
    const rank = await resolveRank(base44, projectId, user);
    if (!canManageProject(rank)) throw fail('Only a Project Editor or an administrator can act on Needs Attention.', 403);
    const members = await activeMembers(base44, projectId);
    const memberIds = memberIdsOf(members);
    const today = todayIst();

    if (action === 'dismiss') {
      const items = (Array.isArray(body?.items) ? body.items : []).slice(0, MAX_BULK);
      if (!items.length) throw fail('Choose what to dismiss.');
      const rows = items.map((item) => ({
        ...dismissalFor({ item, projectId, reason: body?.reason, snoozeDays: body?.snooze_days, today }),
        dismissed_by_name: actorName(user), dismissed_at: new Date().toISOString(), member_ids: memberIds,
      }));
      await svc.AttentionDismissal.bulkCreate(rows);
      return Response.json({ dismissed: rows.length });
    }

    if (action === 'restore') {
      const found = await db.readAll('AttentionDismissal', { project_id: projectId, item_key: { $in: (body?.item_keys || []).slice(0, MAX_BULK) }, active: true });
      for (const row of found.items) await svc.AttentionDismissal.update(row.id, { active: false });
      return Response.json({ restored: found.items.length });
    }

    if (action === 'bulk_fix') {
      const ids = [...new Set((Array.isArray(body?.task_ids) ? body.task_ids : []).map(String))];
      if (!ids.length) throw fail('Choose at least one task.');
      if (ids.length > MAX_BULK) throw fail(`Change at most ${MAX_BULK} tasks at a time.`);
      const input = bulkChanges(body?.changes);
      if (input.contractor_id && !(await getOne(svc.Contractor, input.contractor_id))) throw fail('That contractor no longer exists.');

      const results = [];
      for (const id of ids) {
        try {
          const task = await getOne(svc.Task, id);
          if (!task || task.project_id !== projectId) throw fail('Not a task on this project.');
          const changes = { ...input };
          if (changes.assignee_user_id) Object.assign(changes, assigneeFor({ requested: changes.assignee_user_id, members }));
          const entries = diffFields(task, changes);
          if (!entries.length) { results.push({ task_id: id, ref: task.task_ref, ok: true, changed: 0 }); continue; }
          // A forecast date set from here carries a stated reason and the catch-all category.
          const forecast = entries.some((e) => e.field_changed === 'current_forecast_finish');
          const reason = forecast ? String(body?.reason || 'Set during the Needs Attention review').slice(0, 300) : '';
          if (forecast) {
            changes.date_revision_reason = reason;
            entries.push(...diffFields(task, { date_revision_reason: reason, date_revision_category: 'Other' }));
          }
          guardTaskChanges({ task, entries, rank, user, reason, category: 'Other' });
          const effects = deriveTaskEffects({ task, entries, user });
          const patch = { ...effects.patch, updated_by_name: actorName(user), member_ids: memberIds };
          entries.forEach((e) => { patch[e.field_changed] = e.new_value; });
          await svc.Task.update(id, patch);
          await writeTaskHistory(base44, { task, projectId, memberIds, user, note: 'Set during the Needs Attention review', entries, extra: effects.derived });
          results.push({ task_id: id, ref: task.task_ref, ok: true, changed: entries.length });
        } catch (error) {
          results.push({ task_id: id, ok: false, error: error.message });
        }
      }
      return Response.json({
        results,
        changed: results.filter((r) => r.ok && r.changed).length,
        unchanged: results.filter((r) => r.ok && !r.changed).length,
        failed: results.filter((r) => !r.ok).length,
        fields: BULK_FIELDS.filter((f) => input[f]),
      });
    }

    throw fail('Unknown action.');
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('attentionAction', handler);
