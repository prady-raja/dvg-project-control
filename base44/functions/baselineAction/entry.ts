import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  activeMembers,
  canEditBaselines,
  memberIdsOf,
  resolveRank,
  syncProjectMemberIds,
} from '../../shared/access.ts';
import { actorName, fail, getOne, listAll } from '../../shared/records.ts';

const todayIst = () =>
  new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

const snapshotPhase = async (svc, projectId, phaseId) => {
  const [tasksRes, locationsRes] = await Promise.all([
    svc.Task.filter(
      { project_id: projectId, phase_id: phaseId, is_villa_work_parent: { $ne: true }, archived: { $ne: true } },
      { limit: 500 },
    ),
    svc.Location.filter({ project_id: projectId, phase_id: phaseId }, { limit: 500 }),
  ]);
  const locations = new Map(listAll(locationsRes).map((l) => [l.id, l]));
  return listAll(tasksRes)
    .sort((a, b) => String(a.task_ref || '').localeCompare(String(b.task_ref || '')))
    .map((task) => ({
      task_id: task.id,
      task_ref: task.task_ref || '',
      location_code: locations.get(task.location_id)?.villa_code || '',
      baseline_start: task.baseline_start || null,
      baseline_finish: task.baseline_finish || null,
    }));
};

/** Previous and new dates, so a rebaseline states exactly what moved. */
const diffSnapshots = (previous, next) => {
  const before = new Map((previous || []).map((item) => [item.task_id, item]));
  const after = new Map((next || []).map((item) => [item.task_id, item]));
  const rows = [];
  const add = (item, field, previousValue, nextValue) =>
    rows.push({
      task_ref: item.task_ref || '',
      location_code: item.location_code || '',
      field,
      previous: previousValue || '',
      next: nextValue || '',
    });

  (next || []).forEach((item) => {
    const old = before.get(item.task_id);
    if (!old) {
      add(item, 'task', '', 'added to baseline');
      return;
    }
    if ((old.baseline_start || null) !== (item.baseline_start || null)) {
      add(item, 'baseline_start', old.baseline_start, item.baseline_start);
    }
    if ((old.baseline_finish || null) !== (item.baseline_finish || null)) {
      add(item, 'baseline_finish', old.baseline_finish, item.baseline_finish);
    }
  });
  (previous || []).forEach((item) => {
    if (!after.has(item.task_id)) add(item, 'task', 'in baseline', 'removed from baseline');
  });
  return rows;
};

const nextVersionNumber = async (svc, projectId, phaseId) => {
  const res = await svc.BaselineVersion.filter({ project_id: projectId, phase_id: phaseId }, { limit: 200 });
  const versions = listAll(res);
  return versions.reduce((max, v) => Math.max(max, Number(v.version_number) || 0), 0) + 1;
};

const phaseVersions = async (svc, projectId, phaseId) => {
  const res = await svc.BaselineVersion.filter({ project_id: projectId, phase_id: phaseId }, { limit: 200 });
  return listAll(res);
};

/**
 * Baseline lifecycle. Drafts are editable by a Project Manager; an approved
 * version is frozen for good — later change happens by creating a new version
 * that records the previous and new dates, who approved it, why, and when.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const svc = base44.asServiceRole.entities;

    let version = null;
    if (body?.baseline_version_id) {
      version = await getOne(svc.BaselineVersion, String(body.baseline_version_id));
      if (!version) throw fail('Baseline version not found.', 404);
    }

    const projectId = version?.project_id || String(body?.project_id || '');
    const phaseId = version?.phase_id || String(body?.phase_id || '');
    if (!projectId) throw fail('A project is required.');
    if (!phaseId) throw fail('A phase is required.');

    const rank = await resolveRank(base44, projectId, user);
    if (!canEditBaselines(rank)) {
      throw fail('Only a Project Manager or an administrator can manage baselines.', 403);
    }

    const memberIds = memberIdsOf(await activeMembers(base44, projectId));

    if (action === 'capture_draft' || action === 'update_draft') {
      const snapshot = await snapshotPhase(svc, projectId, phaseId);
      if (action === 'update_draft' && version) {
        if (version.status !== 'Draft') {
          throw fail('An approved baseline cannot be edited. Create a new version instead.', 403);
        }
        const updated = await svc.BaselineVersion.update(version.id, {
          snapshot,
          task_count: snapshot.length,
          member_ids: memberIds,
        });
        return Response.json({ baseline: updated, versions: await phaseVersions(svc, projectId, phaseId) });
      }

      const existing = (await phaseVersions(svc, projectId, phaseId)).find((v) => v.status === 'Draft');
      if (existing) {
        const updated = await svc.BaselineVersion.update(existing.id, {
          snapshot,
          task_count: snapshot.length,
          member_ids: memberIds,
        });
        return Response.json({ baseline: updated, reused: true, versions: await phaseVersions(svc, projectId, phaseId) });
      }

      const created = await svc.BaselineVersion.create({
        project_id: projectId,
        phase_id: phaseId,
        version_number: await nextVersionNumber(svc, projectId, phaseId),
        name: String(body?.name || '').trim() || `${phaseId.length ? 'Phase baseline' : 'Baseline'}`,
        status: 'Draft',
        created_by_id: user.id,
        created_by_name: actorName(user),
        task_count: snapshot.length,
        snapshot,
        member_ids: memberIds,
        notes: String(body?.notes || ''),
      });
      return Response.json({ baseline: created, versions: await phaseVersions(svc, projectId, phaseId) });
    }

    if (action === 'submit') {
      if (!version) throw fail('Select a baseline version.');
      if (version.status !== 'Draft') throw fail('Only a draft baseline can be submitted.');
      const updated = await svc.BaselineVersion.update(version.id, { status: 'Submitted', member_ids: memberIds });
      return Response.json({ baseline: updated, versions: await phaseVersions(svc, projectId, phaseId) });
    }

    if (action === 'approve') {
      if (!version) throw fail('Select a baseline version.');
      if (version.status !== 'Draft' && version.status !== 'Submitted') {
        throw fail('Only a draft or submitted baseline can be approved.');
      }

      const approvedAt = new Date().toISOString();
      const snapshot = version.snapshot || [];

      // Superseding an approved version — never rewriting it — is the only way an
      // approved baseline is replaced, and a revision that replaces one must say why.
      const others = (await phaseVersions(svc, projectId, phaseId)).filter(
        (v) => v.status === 'Approved' && v.id !== version.id,
      );
      if (others.length && !String(version.reason || '').trim()) {
        throw fail('A baseline revision needs a reason before it can be approved.');
      }

      // The dates are frozen onto the covered tasks first, and the version it
      // replaces stays approved and active until that has fully succeeded. A failure
      // here rolls back the dates it wrote, so the committed programme is untouched.
      const restore = [];
      try {
        for (const item of snapshot) {
          if (!item.task_id) continue;
          const covered = await getOne(svc.Task, item.task_id);
          if (!covered) continue;
          restore.push({
            id: covered.id,
            baseline_start: covered.baseline_start || null,
            baseline_finish: covered.baseline_finish || null,
            baseline_approval_status: covered.baseline_approval_status || null,
            baseline_locked: covered.baseline_locked === true,
            baseline_version_id: covered.baseline_version_id || null,
          });
          await svc.Task.update(covered.id, {
            baseline_start: item.baseline_start || null,
            baseline_finish: item.baseline_finish || null,
            baseline_approval_status: 'Approved',
            baseline_locked: true,
            baseline_version_id: version.id,
          });
        }
      } catch (error) {
        for (const row of restore) {
          await svc.Task.update(row.id, {
            baseline_start: row.baseline_start,
            baseline_finish: row.baseline_finish,
            baseline_approval_status: row.baseline_approval_status,
            baseline_locked: row.baseline_locked,
            baseline_version_id: row.baseline_version_id,
          });
        }
        throw fail(
          `The revision could not be applied and was rolled back, so the previously approved baseline is still the active one. Nothing was superseded. (${error.message})`,
          500,
        );
      }

      // Only now: the version being replaced is superseded (its snapshot stays
      // exactly as approved) and this version becomes the active one.
      const superseded = [];
      try {
        for (const other of others) {
          await svc.BaselineVersion.update(other.id, { status: 'Superseded' });
          superseded.push(other.id);
        }

        const approved = await svc.BaselineVersion.update(version.id, {
          status: 'Approved',
          approved_by_id: user.id,
          approved_by_name: actorName(user),
          approved_at: approvedAt,
          approved_date: todayIst(),
          member_ids: memberIds,
        });

        const coveredIds = new Set(restore.map((row) => row.id));
        const historyRows = snapshot
          .filter((item) => item.task_id && coveredIds.has(item.task_id))
          .map((item) => ({
            task_id: item.task_id,
            project_id: projectId,
            member_ids: memberIds,
            change_type: 'Baseline Approved',
            field_changed: 'baseline',
            old_value: '',
            new_value: `v${approved.version_number || ''} ${item.baseline_start || '—'} → ${item.baseline_finish || '—'}`,
            changed_by_id: user.id,
            changed_by_name: actorName(user),
            changed_at: approvedAt,
            note: version.previous_baseline_version_id
              ? `Rebaselined from version ${version.previous_baseline_version_id}. Reason: ${version.reason || '—'}`
              : 'First approved baseline',
          }));
        if (historyRows.length) await svc.TaskHistory.bulkCreate(historyRows);

        return Response.json({ baseline: approved, versions: await phaseVersions(svc, projectId, phaseId) });
      } catch (error) {
        // Nothing may sit between two baselines: the version being replaced is put
        // back as the active one and the dates it held are restored.
        for (const otherId of superseded) {
          await svc.BaselineVersion.update(otherId, { status: 'Approved' });
        }
        for (const row of restore) {
          await svc.Task.update(row.id, {
            baseline_start: row.baseline_start,
            baseline_finish: row.baseline_finish,
            baseline_approval_status: row.baseline_approval_status,
            baseline_locked: row.baseline_locked,
            baseline_version_id: row.baseline_version_id,
          });
        }
        throw fail(
          `The revision could not be activated and was rolled back. The previously approved baseline is still the active one. (${error.message})`,
          500,
        );
      }
    }

    if (action === 'rebaseline') {
      const reason = String(body?.reason || '').trim();
      if (!reason) throw fail('A rebaseline needs a reason.');

      const all = await phaseVersions(svc, projectId, phaseId);
      const approved = all.find((v) => v.status === 'Approved');
      if (!approved) throw fail('There is no approved baseline to rebaseline from.');

      // The dates the revision proposes. They are recorded on the new version only:
      // nothing moves on the covered tasks, and the approved baseline stays the
      // active one, until this version has been approved.
      const current = await snapshotPhase(svc, projectId, phaseId);
      const readDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null);
      const proposed = new Map(
        (Array.isArray(body?.dates) ? body.dates : [])
          .map((entry) => [String(entry?.task_id || ''), entry])
          .filter(([taskId]) => taskId),
      );
      const snapshot = current.map((item) => {
        const change = proposed.get(item.task_id);
        if (!change) return item;
        return {
          ...item,
          baseline_start: Object.prototype.hasOwnProperty.call(change, 'baseline_start')
            ? readDate(change.baseline_start)
            : item.baseline_start,
          baseline_finish: Object.prototype.hasOwnProperty.call(change, 'baseline_finish')
            ? readDate(change.baseline_finish)
            : item.baseline_finish,
        };
      });
      const created = await svc.BaselineVersion.create({
        project_id: projectId,
        phase_id: phaseId,
        version_number: await nextVersionNumber(svc, projectId, phaseId),
        name: String(body?.name || '').trim() || `Phase baseline v${all.length + 1}`,
        status: 'Draft',
        created_by_id: user.id,
        created_by_name: actorName(user),
        reason,
        previous_baseline_version_id: approved.id,
        task_count: snapshot.length,
        snapshot,
        changes: diffSnapshots(approved.snapshot, snapshot),
        member_ids: memberIds,
      });
      return Response.json({ baseline: created, versions: await phaseVersions(svc, projectId, phaseId) });
    }

    if (action === 'sync_members') {
      await syncProjectMemberIds(base44, projectId);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}