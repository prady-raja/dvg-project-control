/**
 * Pure rules for a dated site report. A report is a record of one day: it may be
 * filed late, within a limit, but an older report never overwrites what a newer
 * one already put on the task.
 */

/** Default until project settings (S-01) carry backdate_limit_days. */
export const BACKDATE_LIMIT_DAYS = 7;

export const MAX_REPORT_PHOTOS = 10;

const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const dayNumber = (day) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000);

/** Why this report date is refused, or '' when it is acceptable. */
export function reportDateProblem(updateDate, today, limitDays = BACKDATE_LIMIT_DAYS) {
  if (!isDay(updateDate)) return 'Choose the day this report is for.';
  if (updateDate > today) return 'A report cannot be dated in the future.';
  const limit = Number.isFinite(Number(limitDays)) && Number(limitDays) >= 0 ? Number(limitDays) : BACKDATE_LIMIT_DAYS;
  if (dayNumber(today) - dayNumber(updateDate) > limit) {
    return `A report can be backdated by at most ${limit} day${limit === 1 ? '' : 's'}.`;
  }
  return '';
}

/** Why this task takes no reports, or '' when it does. */
export function reportTargetProblem(task) {
  if (!task) return 'That task no longer exists.';
  if (task.archived === true) return 'This task is archived. Restore it before reporting on it.';
  if (task.is_villa_work_parent === true) {
    return 'This is a Villa Work assignment that holds one task per villa. Report against the villa task instead.';
  }
  return '';
}

/**
 * True when a newer report already moved the task, so this one is kept as
 * history only. Reports for the same day still apply, in the order they arrive.
 */
export const isOlderThanLatest = (updateDate, latestReportDate) =>
  isDay(latestReportDate) && String(updateDate) < String(latestReportDate);
