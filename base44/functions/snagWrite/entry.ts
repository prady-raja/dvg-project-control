import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canEditTasks, canManageProject, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { allocateTaskRefs, attachTaskRefs, resolveKindPrefix } from '../../shared/taskRef.ts';
import { withLog } from '../../shared/log.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import { resolveTaskScope } from '../../shared/scopeResolve.ts';
import { cleanPhotoMeta } from '../../shared/photoMeta.ts';
import { ackInput, needsAck } from '../../shared/ownerSignoff.ts';

/**
 * The guarded path for snags.
 *
 * A snag is its own record, separate from a task: raising or closing one never
 * changes a task status by itself, so the works register and the defect list can
 * never contradict each other. Site engineers and above may raise and progress
 * snags; a permanent SN- reference is issued from the same append-only ledger
 * the tasks use, so snag numbers are never reused either.
 */

const STATUSES = ['Open', 'Awaiting Reinspection', 'Closed'];
const SEVERITIES = ['Minor', 'Major', 'Critical'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FIELDS = [
  'project_id', 'phase_id', 'location_id', 'task_id', 'title', 'description', 'discipline',
  'work_package', 'contractor_id', 'status', 'severity', 'target_date', 'reinspection_date',
  'closed_date', 'handover_blocker', 'notes',
];

const MAX_PHOTOS = 10;

const text = (value, max = 2000) => {
  const cleaned = String(value === null || value === undefined ? '' : value).trim();
  return cleaned ? cleaned.slice(0, max) : null;
};

const isDate = (value) => DATE.test(String(value || ''));

async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    const action = String(body?.action || 'create');
    const id = String(body?.id || '');
    const existing = id ? await getOne(svc.Snag, id) : null;

    let projectId = String(body?.snag?.project_id || existing?.project_id || '');
    if (existing) projectId = existing.project_id;
    if (!projectId) throw fail('A project is required.');

    const rank = await resolveRank(base44, projectId, user);
    if (!canEditTasks(rank)) {
      throw fail(rank < 0 ? 'You are not a member of this project.' : 'Your project role is read-only.', 403);
    }

    const memberIds = memberIdsOf(await activeMembers(base44, projectId));

    if (action === 'create') {
      const payload = {};
      FIELDS.forEach((field) => {
        const value = body?.snag?.[field];
        payload[field] = value === '' || value === undefined ? null : value;
      });
      payload.project_id = projectId;
      payload.title = text(payload.title, 200);
      if (!payload.title) throw fail('Describe the snag in the title.');
      payload.description = text(payload.description, 2000);
      payload.status = STATUSES.includes(payload.status) ? payload.status : 'Open';
      payload.severity = SEVERITIES.includes(payload.severity) ? payload.severity : 'Minor';
      payload.target_date = isDate(payload.target_date) ? payload.target_date : null;

      const location = payload.location_id ? await getOne(svc.Location, payload.location_id) : null;
      if (location && location.project_id !== projectId) throw fail('That villa belongs to a different project.');
      if (!location) payload.location_id = null;

      const task = payload.task_id ? await getOne(svc.Task, payload.task_id) : null;
      if (task && task.project_id !== projectId) throw fail('That task belongs to a different project.');
      if (task && !payload.location_id) payload.location_id = task.location_id || null;

      // Where in the villa the defect is, checked against the villa's own floors and rooms.
      const scope = payload.location_id
        ? await resolveTaskScope(svc, {
          projectId,
          locationId: payload.location_id,
          floorId: body?.snag?.floor_id,
          areaIds: body?.snag?.area_ids,
        })
        : null;
      payload.floor_id = scope?.floor_id || null;
      payload.area_ids = scope?.area_ids || [];
      payload.area_label = scope?.area_label || null;

      const photos = (Array.isArray(body?.snag?.photo_uris) ? body.snag.photo_uris : [])
        .filter((uri) => typeof uri === 'string' && uri.trim())
        .map((uri) => uri.trim().slice(0, 500))
        .slice(0, MAX_PHOTOS);

      const prefix = await resolveKindPrefix(base44.asServiceRole, projectId, payload.phase_id || null, 'SN');
      const claim = (await allocateTaskRefs(base44.asServiceRole, projectId, payload.phase_id || null, 1, {
        prefix,
        userId: user.id,
        userName: actorName(user),
        memberIds,
      }))[0];

      const created = await svc.Snag.create({
        ...payload,
        snag_ref: claim.ref,
        raised_date: isDate(body?.snag?.raised_date) ? body.snag.raised_date : todayIst(),
        raised_by_id: user.id,
        raised_by_name: actorName(user),
        photo_uris: photos,
        ...cleanPhotoMeta(photos, body?.snag?.photo_captions, body?.snag?.photo_originals),
        member_ids: memberIds,
        closed_date: null,
        closed_by_name: null,
        is_demo: body?.snag?.is_demo === true,
      });
      await attachTaskRefs(base44.asServiceRole, [{ claim, taskId: created.id }]);
      return Response.json({ snag: created, ref: claim.ref });
    }

    if (!existing) throw fail('That snag no longer exists.', 404);

    if (action === 'delete') {
      if (!canManageProject(rank)) throw fail('Only a Project Editor or an administrator can remove a snag.', 403);
      await svc.Snag.delete(existing.id);
      return Response.json({ ok: true, deleted: existing.id });
    }

    /* --------------------------------------------------- progress and closure */
    const patch = {};
    FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body?.snag || {}, field)) {
        patch[field] = body.snag[field] === '' ? null : body.snag[field];
      }
    });
    delete patch.project_id;
    delete patch.task_id;
    if (patch.status && !STATUSES.includes(patch.status)) throw fail('Unknown snag status.');
    if (patch.severity && !SEVERITIES.includes(patch.severity)) throw fail('Unknown severity.');
    if (patch.target_date !== undefined && patch.target_date && !isDate(patch.target_date)) throw fail('Use a valid target date.');
    if (patch.reinspection_date && !isDate(patch.reinspection_date)) throw fail('Use a valid reinspection date.');

    if (patch.status === 'Closed' && existing.status !== 'Closed') {
      // In a handed-over villa the owner's acknowledgement goes with the closing (Q-08).
      if (body?.owner_ack) {
        Object.assign(patch, ackInput(body.owner_ack, { today: todayIst() }), { owner_ack_by_name: actorName(user) });
      } else {
        const location = existing.location_id ? await getOne(svc.Location, existing.location_id) : null;
        const project = await getOne(svc.Project, existing.project_id);
        if (needsAck({ location, project })) throw fail("This villa has been handed over. Record the owner's acknowledgement before closing this snag.");
      }
    }
    if (patch.status === 'Closed') {
      patch.closed_date = isDate(body?.snag?.closed_date) ? body.snag.closed_date : todayIst();
      patch.closed_by_name = actorName(user);
    } else if (patch.status && patch.status !== 'Closed') {
      patch.closed_date = null;
      patch.closed_by_name = null;
    }
    if (Array.isArray(body?.snag?.photo_uris)) {
      patch.photo_uris = body.snag.photo_uris
        .filter((uri) => typeof uri === 'string' && uri.trim())
        .map((uri) => uri.trim().slice(0, 500))
        .slice(0, MAX_PHOTOS);
      Object.assign(patch, cleanPhotoMeta(patch.photo_uris, body?.snag?.photo_captions, body?.snag?.photo_originals));
    }
    patch.member_ids = memberIds;

    const updated = await svc.Snag.update(existing.id, patch);
    return Response.json({ snag: updated, from: existing.status, to: updated.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('snagWrite', handler);
