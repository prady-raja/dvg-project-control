import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  activeMembers,
  canEditTasks,
  canManageProject,
  memberIdsOf,
  resolveRank,
} from '../../shared/access.ts';
import { allocateTaskRefs, attachTaskRefs, resolveRefCollisions } from '../../shared/taskRef.ts';
import { actorName, fail, getOne, listAll } from '../../shared/records.ts';

const WORK_FIELDS = [
  'description', 'priority', 'work_package', 'contractor_id', 'responsible_engineer',
  'baseline_start', 'baseline_finish', 'current_forecast_finish',
  'planned_quantity', 'measurement_unit', 'remarks',
];

const clean = (value) => (value === '' || value === undefined ? null : value);

const historyRow = (task, projectId, memberIds, user, label) => ({
  task_id: task.id,
  project_id: projectId,
  member_ids: memberIds,
  change_type: 'Task Created',
  field_changed: 'task_ref',
  old_value: '',
  new_value: task.task_ref || '',
  changed_by_id: user.id,
  changed_by_name: actorName(user),
  changed_at: new Date().toISOString(),
  note: label,
});

/**
 * One Villa Work activity across several villas: a single parent assignment
 * plus one independently editable child task per villa. On-hold villas are
 * excluded unless a Project Manager explicitly includes them, and a retry with
 * the same key returns the work already created instead of duplicating it.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;

    const projectId = String(body?.project_id || '');
    const phaseId = String(body?.phase_id || '');
    const scope = String(body?.scope || 'all');
    const includeOnHold = body?.include_on_hold === true;
    const work = body?.work && typeof body.work === 'object' ? body.work : {};
    const idempotencyKey = String(body?.idempotency_key || '').trim();
    const requestedIds = Array.isArray(body?.location_ids) ? body.location_ids.map(String) : [];

    if (!projectId) throw fail('A project is required.');
    if (!String(work.name || '').trim()) throw fail('A work name is required.');
    if (!String(work.discipline || '').trim()) throw fail('A discipline is required.');

    const rank = await resolveRank(base44, projectId, user);
    if (!canEditTasks(rank)) {
      throw fail('You do not have permission to create work on this project.', 403);
    }
    const manager = canManageProject(rank);
    if (includeOnHold && !manager) {
      throw fail('Only a Project Manager or an administrator can include on-hold villas.', 403);
    }

    // Retry safety: the same key never creates a second set of work.
    if (idempotencyKey) {
      const existingRes = await svc.Task.filter(
        { villa_work_key: idempotencyKey, is_villa_work_parent: true },
        { limit: 1 },
      );
      const existing = listAll(existingRes)[0];
      if (existing) {
        const childrenRes = await svc.Task.filter({ parent_task_id: existing.id }, { limit: 500 });
        return Response.json({
          parent: existing,
          children: listAll(childrenRes),
          reused: true,
          skipped_on_hold: [],
        });
      }
    }

    const phaseVillas = listAll(
      await svc.Location.filter(
        { project_id: projectId, phase_id: phaseId, location_type: 'Villa' },
        { sort: 'sort_order', limit: 500 },
      ),
    );

    let targets = [];
    if (scope === 'one') {
      // An explicitly chosen single villa is used as chosen, whatever its state.
      const wanted = requestedIds[0] ? phaseVillas.find((l) => l.id === requestedIds[0]) : null;
      if (!wanted) throw fail('That villa is not part of the selected phase.');
      targets = [wanted];
    } else {
      targets =
        scope === 'selected'
          ? phaseVillas.filter((l) => requestedIds.includes(l.id))
          : phaseVillas;
    }

    const skippedOnHold = [];
    if (scope !== 'one') {
      const keep = [];
      targets.forEach((location) => {
        const onHold = location.active_status === 'On Hold';
        if (onHold && !(manager && includeOnHold)) {
          skippedOnHold.push(location.villa_code);
        } else {
          keep.push(location);
        }
      });
      targets = keep;
    }

    if (!targets.length) throw fail('No villas match that selection.');

    const memberIds = memberIdsOf(await activeMembers(base44, projectId));
    // One block of permanent references: the assignment and every villa under it.
    const claims = await allocateTaskRefs(base44.asServiceRole, projectId, phaseId, targets.length + 1, {
      memberIds,
      userId: user.id,
      userName: actorName(user),
    });

    const parent = await svc.Task.create({
      task_ref: claims[0].ref,
      project_id: projectId,
      phase_id: phaseId || null,
      location_id: null,
      discipline: String(work.discipline).trim(),
      name: String(work.name).trim(),
      status: 'Not Started',
      is_villa_work_parent: true,
      villa_work_key: idempotencyKey || null,
      child_villa_count: targets.length,
      created_by_name: actorName(user),
      updated_by_name: actorName(user),
      is_demo: false,
      archived: false,
      member_ids: memberIds,
      ...Object.fromEntries(WORK_FIELDS.map((field) => [field, clean(work[field])])),
    });

    const childKeys = targets.map((location) => `${parent.id}:${location.id}`);
    const alreadyRes = await svc.Task.filter({ villa_work_key: { $in: childKeys } }, { limit: 500 });
    const already = new Set(listAll(alreadyRes).map((t) => t.villa_work_key));

    const rows = targets
      .map((location, index) => ({ location, ref: claims[index + 1].ref }))
      .filter(({ location }) => !already.has(`${parent.id}:${location.id}`))
      .map(({ location, ref }) => ({
        task_ref: ref,
        project_id: projectId,
        phase_id: phaseId || location.phase_id || null,
        location_id: location.id,
        discipline: String(work.discipline).trim(),
        name: String(work.name).trim(),
        status: 'Not Started',
        parent_task_id: parent.id,
        is_villa_work_parent: false,
        villa_work_key: `${parent.id}:${location.id}`,
        created_by_name: actorName(user),
        updated_by_name: actorName(user),
        is_demo: false,
        archived: false,
        member_ids: memberIds,
        ...Object.fromEntries(WORK_FIELDS.map((field) => [field, clean(work[field])])),
      }));

    const children = rows.length ? listAll(await svc.Task.bulkCreate(rows)) : [];

    const childByRef = new Map(children.map((child) => [child.task_ref, child]));
    const claimByRef = new Map(claims.map((claim) => [claim.ref, claim]));
    await attachTaskRefs(base44.asServiceRole, [
      { claim: claims[0], taskId: parent.id },
      ...rows.map((row) => ({
        claim: claimByRef.get(row.task_ref) || null,
        taskId: childByRef.get(row.task_ref)?.id,
      })),
    ]);

    // A simultaneous claim is corrected here, so no two villas can share one.
    const corrections = await resolveRefCollisions(base44.asServiceRole, projectId, [parent, ...children]);

    const history = [historyRow(parent, projectId, memberIds, user, 'Villa Work assignment created')];
    (children.length ? children : rows).forEach((child) => {
      if (child.id) history.push(historyRow(child, projectId, memberIds, user, 'Child villa task created'));
    });
    corrections.forEach((fix) => {
      history.push({
        task_id: fix.taskId,
        project_id: projectId,
        member_ids: memberIds,
        change_type: 'Reference Correction',
        field_changed: 'task_ref',
        old_value: fix.from,
        new_value: fix.to,
        changed_by_id: user.id,
        changed_by_name: actorName(user),
        changed_at: new Date().toISOString(),
        note: 'Simultaneous claim — re-issued the next free reference',
      });
    });
    if (history.length) await svc.TaskHistory.bulkCreate(history);

    const childrenRes = await svc.Task.filter({ parent_task_id: parent.id }, { sort: 'task_ref', limit: 500 });
    return Response.json({
      parent,
      children: listAll(childrenRes),
      reused: false,
      skipped_on_hold: skippedOnHold,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}