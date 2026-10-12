/**
 * Acting on Needs Attention (D-03): dismiss with a reason or until a date, and fix
 * many records at once. Pure helpers; the attentionAction function applies them
 * through the same task rules as every other write.
 */
import { shiftDay } from './dashboardCore.ts';
import { fail } from './records.ts';

export const dismissalKey = (item) => `${item.code}|${item.task_id || item.villa || ''}`;

/** A dismissal still in force on `asOf`: kept for good, or snoozed to a date not yet reached. */
export const isDismissed = (item, dismissals = [], asOf) =>
  dismissals.some((d) => d.active !== false && d.item_key === dismissalKey(item) && (!d.snooze_until || d.snooze_until >= asOf));

export const SNOOZE_CHOICES = [
  { value: '', label: 'For good' },
  { value: '7', label: 'For a week' },
  { value: '30', label: 'For 30 days' },
];

export function dismissalFor({ item, projectId, reason, snoozeDays, today }) {
  const why = String(reason || '').trim();
  if (why.length < 3) throw fail('Say why this is being dismissed.');
  const days = Number(snoozeDays);
  return {
    project_id: projectId,
    code: item.code,
    item_key: dismissalKey(item),
    task_id: item.task_id || null,
    villa: item.villa || null,
    reason: why.slice(0, 300),
    snooze_until: Number.isFinite(days) && days > 0 ? shiftDay(today, days) : null,
    active: true,
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The only fields a bulk fix may set, each checked; anything else is refused. */
export const BULK_FIELDS = ['contractor_id', 'assignee_user_id', 'baseline_start', 'baseline_finish', 'current_forecast_finish'];

export function bulkChanges(input = {}) {
  const changes = {};
  Object.keys(input || {}).forEach((key) => {
    if (!BULK_FIELDS.includes(key)) throw fail(`${key} cannot be set from Needs Attention.`);
    const value = input[key];
    if (value === '' || value === null || value === undefined) return;
    if (key.endsWith('_start') || key.endsWith('_finish')) {
      if (!DATE.test(String(value))) throw fail('Dates must be real dates.');
    }
    changes[key] = value;
  });
  if (!Object.keys(changes).length) throw fail('Choose something to set.');
  if (changes.baseline_start && changes.baseline_finish && changes.baseline_finish < changes.baseline_start) {
    throw fail('The finish date cannot be before the start date.');
  }
  return changes;
}

/** How many a person may change in one go. */
export const MAX_BULK = 200;
