import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canEditTasks, canManageProject, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { projectSettings } from '../../shared/calendar.ts';
import { shiftDay, todayIst } from '../../shared/dashboardCore.ts';
import { diffFields, writeTaskHistory } from '../../shared/history.ts';
import { guardTaskChanges, deriveTaskEffects } from '../../shared/taskWriteRules.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { canChangeDiary, diaryInput } from '../../shared/siteDiary.ts';
import { withLog } from '../../shared/log.ts';

/**
 * The site diary (F-03). One row per project per IST day: any engineer adds to it,
 * an administrator or project manager closes the day. A delivery row may mark its
 * task Delivered — through the same shared task rules as every other write.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'save');
    const svc = base44.asServiceRole.entities;
    const projectId = String(body?.project_id || '');
    const project = await getOne(svc.Project, projectId);
    if (!project) throw fail('Choose a project first.', 400);

    const rank = await resolveRank(base44, projectId, user);
    if (!canEditTasks(rank)) throw fail(rank < 0 ? 'You are not a member of this project.' : 'Your project role is read-only.', 403);

    const date = String(body?.diary_date || '');
    const found = await svc.SiteDiary.filter({ project_id: projectId, diary_date: date }, { limit: 1 });
    const existing = (found?.items || found || [])[0] || null;

    if (action === 'close' || action === 'reopen') {
      if (!canManageProject(rank)) throw fail('Only an administrator or project manager can close a day.', 403);
      if (!existing) throw fail('There is no diary for that day yet.', 404);
      const patch = action === 'close'
        ? { closed: true, closed_by_name: actorName(user), closed_at: new Date().toISOString() }
        : { closed: false, closed_by_name: null, closed_at: null };
      return Response.json({ diary: await svc.SiteDiary.update(existing.id, patch) });
    }

    const guard = canChangeDiary(existing, { isAdmin: canManageProject(rank) });
    if (!guard.ok) throw fail(guard.reason, 403);

    const input = diaryInput(body, {
      today: todayIst(), backdateLimitDays: projectSettings(project).backdate_limit_days, shift: shiftDay,
    });
    const members = await activeMembers(base44, projectId);
    const memberIds = memberIdsOf(members);

    // Deliveries that mark a task Delivered: checked before anything is written.
    const delivered = [];
    for (const row of input.deliveries) {
      if (!row.mark_delivered || !row.task_id) continue;
      const task = await getOne(svc.Task, row.task_id);
      if (!task || task.project_id !== projectId) throw fail(`The task for ${row.material} is not in this project.`);
      if (task.procurement_status === 'Delivered' || task.procurement_status === 'Installed') continue;
      const entries = diffFields(task, { procurement_status: 'Delivered' });
      guardTaskChanges({ task, entries, rank, user });
      delivered.push({ task, entries });
    }

    const row = {
      ...input,
      deliveries: input.deliveries.map(({ mark_delivered, ...rest }) => ({ ...rest, delivered_marked: mark_delivered === true || undefined })),
      project_id: projectId, member_ids: memberIds, updated_by_name: actorName(user),
    };
    const saved = existing ? await svc.SiteDiary.update(existing.id, row) : await svc.SiteDiary.create(row);

    for (const { task, entries } of delivered) {
      const effects = deriveTaskEffects({ task, entries, user });
      await svc.Task.update(task.id, { procurement_status: 'Delivered', updated_by_name: actorName(user), ...effects.patch });
      await writeTaskHistory(base44, { task, projectId, memberIds, user, entries, note: `Delivery recorded in the site diary for ${input.diary_date}` });
    }

    return Response.json({ diary: saved, delivered: delivered.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('siteDiary', handler);
