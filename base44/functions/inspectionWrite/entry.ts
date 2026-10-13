import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canEditTasks, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { checklistInput, failedItems, inspectableProblem, overallOf } from '../../shared/checklists.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { withLog } from '../../shared/log.ts';

/**
 * Save an inspection checklist against a task or a snag. This only RECORDS what was
 * looked at: it never writes a status, never approves anything and never touches the
 * separation between who completed work and who approves it. Those stay exactly as
 * the task and snag functions enforce them.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    const subjectType = body?.subject_type === 'Snag' ? 'Snag' : body?.subject_type === 'Task' ? 'Task' : '';
    if (!subjectType) throw fail('Choose a task or a snag to inspect.');

    const subject = await getOne(subjectType === 'Task' ? svc.Task : svc.Snag, String(subjectType === 'Task' ? body?.task_id : body?.snag_id || ''));
    if (!subject) throw fail(`That ${subjectType.toLowerCase()} no longer exists.`, 404);

    const rank = await resolveRank(base44, subject.project_id, user);
    if (!canEditTasks(rank)) throw fail(rank < 0 ? 'You are not a member of this project.' : 'Your project role is read-only.', 403);

    const problem = inspectableProblem(subjectType, subject);
    if (problem) throw fail(problem);

    const items = checklistInput(body?.items);
    const memberIds = memberIdsOf(await activeMembers(base44, subject.project_id));
    const overall = overallOf(items);
    const failCount = failedItems(items).length;

    const saved = await svc.InspectionChecklist.create({
      project_id: subject.project_id, phase_id: subject.phase_id || null, location_id: subject.location_id || null,
      subject_type: subjectType,
      task_id: subjectType === 'Task' ? subject.id : null, task_ref: subjectType === 'Task' ? subject.task_ref || '' : null,
      snag_id: subjectType === 'Snag' ? subject.id : null, snag_ref: subjectType === 'Snag' ? subject.snag_ref || '' : null,
      discipline: subject.discipline || null,
      items, overall, fail_count: failCount,
      completed_by_id: user.id, completed_by_name: actorName(user), completed_date: todayIst(), member_ids: memberIds,
    });

    if (subjectType === 'Task') {
      await svc.TaskHistory.create({
        task_id: subject.id, project_id: subject.project_id, member_ids: memberIds, change_type: 'Inspection Checklist', field_changed: 'inspection',
        old_value: '', new_value: overall === 'Pass' ? `Pass (${items.length} items)` : `Fail (${failCount} of ${items.length} items)`,
        changed_by_id: user.id, changed_by_name: actorName(user), changed_at: new Date().toISOString(),
        note: 'Checklist recorded. No status was changed by it.',
      });
    }
    return Response.json({ checklist: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('inspectionWrite', handler);
