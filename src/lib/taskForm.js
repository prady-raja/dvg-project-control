import { toDateInput } from '@/lib/format';
import { TASK_STATUSES } from '@/lib/constants';

/**
 * Pure helpers behind the task edit dialogs. A dialog builds its form from the
 * task each time it opens and sends only what the user changed, so opening and
 * saving with no edits writes nothing.
 */

/** Same rule as base44/shared/taskRef.ts escapeRegex; src does not import base44/shared. */
export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mirrors base44/shared/taskWriteRules.ts APPROVABLE_FROM / CLOSABLE_FROM.
const APPROVABLE_FROM = ['Execution Complete', 'Under Inspection'];
const CLOSABLE_FROM = ['Approved', 'Execution Complete', 'Under Inspection'];

/** Planning rows carry forecast_finish; task records carry current_forecast_finish. */
export const forecastOf = (task) =>
  toDateInput(task?.current_forecast_finish ?? task?.forecast_finish ?? task?.baseline_finish);

/** Statuses the server will accept as the next status of this task. */
export function legalNextStatuses(current) {
  const from = current || 'Not Started';
  return TASK_STATUSES.filter((status) => {
    if (status === from) return true;
    if (status === 'Approved') return APPROVABLE_FROM.includes(from);
    if (status === 'Closed') return CLOSABLE_FROM.includes(from);
    return true;
  });
}

export const quickUpdateForm = (task) => ({
  status: task?.status || 'Not Started',
  progress_percent: task?.progress_percent ?? '',
  current_forecast_finish: toDateInput(task?.current_forecast_finish),
  date_revision_reason: '',
  remarks: task?.remarks || '',
  latest_update: task?.latest_update || '',
});

const comparable = (value) => (value === null || value === undefined ? '' : String(value).trim());

/** Only the fields that differ from the form the task opened with. */
export function changedFields(task, form) {
  const initial = quickUpdateForm(task);
  const changes = {};
  for (const field of ['status', 'progress_percent', 'current_forecast_finish', 'remarks', 'latest_update']) {
    if (comparable(form[field]) !== comparable(initial[field])) changes[field] = form[field];
  }
  if ('current_forecast_finish' in changes) changes.date_revision_reason = String(form.date_revision_reason || '').trim();
  return changes;
}

/** Approved and Closed work takes no further reports. */
export const REPORTABLE_STATUSES = TASK_STATUSES.filter((s) => !['Approved', 'Closed'].includes(s));

/** Task picker: only open work a report can be filed against. */
export function pickerQuery({ projectId, locationId, siteWideOnly, term }) {
  const query = {
    project_id: projectId,
    archived: { $ne: true },
    is_villa_work_parent: { $ne: true },
    status: { $in: REPORTABLE_STATUSES },
  };
  if (locationId) query.location_id = locationId;
  if (siteWideOnly) query.location_id = null;
  const text = String(term || '').trim();
  if (text) {
    const pattern = escapeRegex(text);
    query.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { task_ref: { $regex: pattern, $options: 'i' } },
    ];
  }
  return query;
}
