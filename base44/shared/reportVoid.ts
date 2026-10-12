/**
 * Undoing a daily report (F-01). A person may take back their own report on the
 * day they filed it; the report row is kept and marked voided (so the audit trail
 * stays whole), and the task goes back to what it held before — but only while
 * nothing else has changed the task since.
 */
const dayInIst = (iso) => new Date(Date.parse(iso) + 330 * 60000).toISOString().slice(0, 10);

/** What a report changed on its task, with the value each field held before. */
export function appliedChanges({ entries = [], effectsPatch = {}, task = {} }) {
  const seen = new Set(entries.map((e) => e.field_changed));
  return [
    ...entries.map((e) => ({ field: e.field_changed, from: e.old_value ?? null, to: e.new_value ?? null })),
    ...Object.keys(effectsPatch)
      .filter((key) => !seen.has(key))
      .map((key) => ({ field: key, from: task[key] === undefined ? null : task[key], to: effectsPatch[key] ?? null })),
  ];
}

export function planVoid({ report, task, userId, today }) {
  if (!report) return { error: 'That report no longer exists.' };
  if (report.voided === true) return { error: 'That report has already been undone.' };
  if (report.reported_by_id !== userId) return { error: 'Only the person who filed a report can undo it.' };
  if (dayInIst(report.reported_at || report.created_date) !== today) {
    return { error: 'A report can only be undone on the day it was filed. Correct the task itself instead.' };
  }
  // A report filed as history only never moved the task: voiding it changes nothing else.
  if (!task || report.history_only === true) return { patch: null };

  if (String(task.latest_report_date || '') !== String(report.update_date || '')) {
    return { error: 'A newer report has been filed on this task since, so this one cannot be taken back. Correct the task itself.' };
  }
  if (report.created_date && String(task.updated_date || '') > String(report.created_date)) {
    return { error: 'The task was changed after this report, so it cannot be taken back automatically. Correct the task itself.' };
  }
  const patch = {};
  [...(report.applied || [])].reverse().forEach((change) => {
    patch[change.field] = change.from === undefined || change.from === '' ? null : change.from;
  });
  patch.latest_report_date = report.prev_latest_report_date || null;
  return { patch };
}
