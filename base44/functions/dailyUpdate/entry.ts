import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canEditTasks, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { diffFields, writeTaskHistory } from '../../shared/history.ts';
import { blockedStateFor, deriveTaskEffects, guardTaskChanges } from '../../shared/taskWriteRules.ts';
import { actorName, fail, getOne } from '../../shared/records.ts';
import { BLOCKER_CATEGORIES, TASK_STATUSES } from '../../shared/enums.ts';
import {
  BACKDATE_LIMIT_DAYS,
  isOlderThanLatest,
  MAX_REPORT_PHOTOS,
  reportDateProblem,
  reportTargetProblem,
} from '../../shared/dailyReportRules.ts';
import { withLog } from '../../shared/log.ts';
import { todayIst } from '../../shared/dashboardCore.ts';

/**
 * The only path that records site work.
 *
 * One report per save and any number per task per day: nothing is overwritten,
 * so a villa's day-by-day record accumulates. A report dated before the newest
 * report already applied is kept as history and does not move the task. The task fields move from the same
 * validated report and the change trail is written server-side, so the report,
 * the task and the history can never disagree, and nothing depends on what the
 * browser claims about the user or about the previous values.
 */

const STATUSES = TASK_STATUSES;

/** Task fields a daily report is allowed to move. Baselines are deliberately absent. */
const REPORT_FIELDS = [
  'status', 'progress_percent', 'latest_update', 'remarks', 'actual_manpower',
  'blocker_category', 'blocker_description', 'blocker_responsible_party', 'blocked_since',
  'current_forecast_finish', 'date_revision_reason',
];

const MAX_MANPOWER_ROWS = 12;
const MAX_TEXT = 2000;

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const text = (value, max = MAX_TEXT) => {
  const cleaned = String(value === null || value === undefined ? '' : value).trim();
  return cleaned ? cleaned.slice(0, max) : null;
};

async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;

    const task = await getOne(svc.Task, String(body?.task_id || ''));
    if (!task) throw fail('That task no longer exists.', 404);
    const targetProblem = reportTargetProblem(task);
    if (targetProblem) throw fail(targetProblem);

    const rank = await resolveRank(base44, task.project_id, user);
    if (!canEditTasks(rank)) {
      throw fail(
        rank < 0 ? 'You are not a member of this project.' : 'Your project role is read-only.',
        403,
      );
    }

    /* ------------------------------------------------------------- the report */
    const updateDate = isDate(body?.update_date) ? String(body.update_date) : todayIst();
    const project = await getOne(svc.Project, task.project_id);
    const dateProblem = reportDateProblem(updateDate, todayIst(), project?.backdate_limit_days ?? BACKDATE_LIMIT_DAYS);
    if (dateProblem) throw fail(dateProblem);
    let status = STATUSES.includes(body?.status) ? body.status : task.status || 'Not Started';

    const progressGiven = Object.prototype.hasOwnProperty.call(body || {}, 'progress_percent');
    let progressPercent = null;
    if (body?.progress_percent !== '' && body?.progress_percent !== null && body?.progress_percent !== undefined) {
      const value = Number(body.progress_percent);
      if (Number.isNaN(value) || value < 0 || value > 100) throw fail('Progress must be between 0 and 100.');
      progressPercent = Math.round(value * 10) / 10;
    }

    const workDone = text(body?.work_done);
    const planTomorrow = text(body?.plan_tomorrow, 1000);

    const manpowerItems = (Array.isArray(body?.manpower_items) ? body.manpower_items.slice(0, MAX_MANPOWER_ROWS) : [])
      .map((row) => ({
        discipline: text(row?.discipline, 60) || '',
        count: Math.max(0, Math.round(Number(row?.count) || 0)),
      }))
      .filter((row) => row.discipline && row.count > 0);
    const manpowerTotal = manpowerItems.length
      ? manpowerItems.reduce((sum, row) => sum + row.count, 0)
      : null;

    const blockerReported = body?.blocker_reported === true;
    const blockerCleared = body?.blocker_cleared === true;
    const blockerCategory = text(body?.blocker_category, 120);
    const blockerDescription = text(body?.blocker_description, 1000);
    const blockerResponsible = text(body?.blocker_responsible_party, 200);
    const expectedResolution = isDate(body?.expected_resolution_date)
      ? String(body.expected_resolution_date)
      : null;

    if (blockerReported) {
      if (!BLOCKER_CATEGORIES.includes(blockerCategory)) throw fail('Choose a blocker category.');
      if (!blockerDescription) throw fail('Describe the blocker.');
      // A reported blocker means the work is blocked.
      status = 'Blocked';
    }
    if (blockerCleared && !blockerReported && status === 'Blocked') {
      throw fail('Choose the status the work moves to. Moving it out of Blocked clears the blocker.');
    }

    const forecastGiven = Object.prototype.hasOwnProperty.call(body || {}, 'current_forecast_finish');
    const forecastNew = forecastGiven && isDate(body.current_forecast_finish)
      ? String(body.current_forecast_finish)
      : null;
    const revisionReason = text(body?.date_revision_reason, 400);

    const photoUris = (Array.isArray(body?.photo_uris) ? body.photo_uris : [])
      .filter((uri) => typeof uri === 'string' && uri.trim().length > 0)
      .map((uri) => uri.trim().slice(0, 500));
    if (photoUris.length > MAX_REPORT_PHOTOS) {
      throw fail(`A report holds at most ${MAX_REPORT_PHOTOS} photos. Remove ${photoUris.length - MAX_REPORT_PHOTOS} and save again.`);
    }

    // The newest report already applied decides whether this one moves the task.
    // Tasks reported on before latest_report_date existed fall back to their
    // newest stored report.
    let latestReportDate = task.latest_report_date || '';
    if (!latestReportDate) {
      const newest = await svc.DailyUpdate.filter({ task_id: task.id }, { sort: '-update_date', limit: 1 });
      latestReportDate = (newest?.items || newest || [])[0]?.update_date || '';
    }
    const historyOnly = isOlderThanLatest(updateDate, latestReportDate);

    /* ------------------------------------------------- what moves on the task */
    const changes = { status };
    if (progressGiven) changes.progress_percent = progressPercent;
    // 'Done today' never replaces the planner's remarks.
    if (workDone) changes.latest_update = workDone;
    if (manpowerTotal !== null) changes.actual_manpower = manpowerTotal;
    if (forecastNew) {
      changes.current_forecast_finish = forecastNew;
      changes.date_revision_reason = revisionReason;
    }
    if (blockerReported) {
      changes.blocker_category = blockerCategory;
      changes.blocker_description = blockerDescription;
      changes.blocker_responsible_party = blockerResponsible;
    }
    if (blockerCleared) {
      changes.blocker_category = null;
      changes.blocker_description = null;
      changes.blocker_responsible_party = null;
      changes.blocked_since = null;
    }

    const memberIds = memberIdsOf(await activeMembers(base44, task.project_id));
    let entries = [];
    let effects = { patch: {}, derived: [] };
    if (!historyOnly) {
      // The blocker requirements and the date the work was first blocked come from
      // one shared rule — not from this report, and never from the browser. It
      // refuses a blocked task with nothing to say, clears the blocker when the work
      // moves on, and keeps the original date while it stays blocked.
      const blocked = blockedStateFor({ task, next: changes });
      Object.assign(changes, blocked.patch);
      entries = diffFields(task, changes, REPORT_FIELDS);
      // Permission, baseline lock, approval separation and the reason rule are
      // decided once, for every write path into a task.
      guardTaskChanges({ task, entries, rank, user, reason: revisionReason });
      effects = deriveTaskEffects({ task, entries, user });
    }
    const forecastEntry = entries.find((entry) => entry.field_changed === 'current_forecast_finish');
    const location = task.location_id ? await getOne(svc.Location, task.location_id) : null;

    /* ------------------------------------------------- the task first, then the report */
    // Written before the report, so a refused or failed task write leaves no
    // report claiming a change that never happened.
    let updatedTask = null;
    if (!historyOnly) {
      const patch = { latest_report_date: updateDate };
      entries.forEach((entry) => {
        patch[entry.field_changed] = entry.new_value;
      });
      if (entries.length) {
        Object.assign(patch, effects.patch);
        patch.updated_by_name = actorName(user);
        patch.member_ids = memberIds;
      }
      if (entries.length || task.latest_report_date !== updateDate) updatedTask = await svc.Task.update(task.id, patch);
    }

    const report = await svc.DailyUpdate.create({
      project_id: task.project_id,
      phase_id: task.phase_id || null,
      location_id: task.location_id || null,
      work_scope: task.location_id ? 'Villa' : 'Site-wide',
      site_area: task.location_id ? null : text(body?.site_area, 120),
      task_id: task.id,
      task_ref: task.task_ref || '',
      task_name: task.name || '',
      villa_code: location?.villa_code || null,
      discipline: task.discipline || null,
      update_date: updateDate,
      reported_at: new Date().toISOString(),
      reported_by_id: user.id,
      reported_by_name: actorName(user),
      status,
      progress_percent: progressPercent,
      work_done: workDone,
      plan_tomorrow: planTomorrow,
      manpower_total: manpowerTotal,
      manpower_items: manpowerItems,
      blocker_reported: blockerReported,
      blocker_category: blockerReported ? blockerCategory : null,
      blocker_description: blockerReported ? blockerDescription : null,
      blocker_responsible_party: blockerReported ? blockerResponsible : null,
      expected_resolution_date: blockerReported ? expectedResolution : null,
      blocker_cleared: blockerCleared,
      forecast_previous: forecastEntry ? forecastEntry.old_value : null,
      forecast_new: forecastEntry ? forecastEntry.new_value : null,
      date_revision_reason: forecastEntry ? revisionReason : null,
      photo_uris: photoUris,
      member_ids: memberIds,
      is_demo: false,
    });

    /* ------------------------------------------------------- task + audit trail */
    const summary = [
      'Daily report',
      manpowerTotal !== null ? `${manpowerTotal} manpower` : '',
      blockerReported ? 'blocker reported' : '',
      blockerCleared ? 'blocker cleared' : '',
      photoUris.length ? `${photoUris.length} photo${photoUris.length === 1 ? '' : 's'}` : '',
      historyOnly ? `filed after a newer report (${latestReportDate}), kept as history only` : '',
    ].filter(Boolean).join(' · ');

    if (entries.length) {
      await writeTaskHistory(base44, {
        task,
        projectId: task.project_id,
        memberIds,
        user,
        note: forecastEntry ? `Forecast revision — ${revisionReason}` : '',
        entries: entries.map((entry) =>
          entry.field_changed === 'current_forecast_finish'
            ? { ...entry, note: `Reason: ${revisionReason}` }
            : entry,
        ),
        extra: [
          {
            change_type: 'Daily Report',
            field_changed: 'daily_update',
            old_value: '',
            new_value: updateDate,
            note: summary,
          },
          ...effects.derived,
        ],
      });
    } else {
      // A report that moved no task field is still part of the day's record.
      await writeTaskHistory(base44, {
        task,
        projectId: task.project_id,
        memberIds,
        user,
        extra: [
          {
            change_type: 'Daily Report',
            field_changed: 'daily_update',
            old_value: '',
            new_value: updateDate,
            note: summary,
          },
        ],
      });
    }

    return Response.json({
      update: report,
      task: updatedTask || task,
      changed: entries.length,
      history_only: historyOnly,
      message: historyOnly
        ? `Saved as history. A newer report (${latestReportDate}) already set this task, so its status, progress and forecast were not changed.`
        : '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('dailyUpdate', handler);
