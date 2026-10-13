/**
 * FRONTEND COPY of the Needs Attention helpers in base44/shared/attentionActions.ts
 * — the browser may not import from base44/, so the dismissal rule and the snooze
 * choices live here too. Keep the two in step.
 */

export const dismissalKey = (item) => `${item.code}|${item.task_id || item.villa || ''}`;

/** A dismissal still in force on `asOf`: kept for good, or snoozed to a date not yet reached. */
export const isDismissed = (item, dismissals = [], asOf) =>
  dismissals.some((d) => d.active !== false && d.item_key === dismissalKey(item) && (!d.snooze_until || d.snooze_until >= asOf));

export const SNOOZE_CHOICES = [
  { value: '', label: 'For good' },
  { value: '7', label: 'For a week' },
  { value: '30', label: 'For 30 days' },
];