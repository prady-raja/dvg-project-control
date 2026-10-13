/**
 * FRONTEND COPY of the per-task part of base44/shared/dataHealth.ts — the browser may
 * not import from base44/. A parity test keeps the two in step.
 *
 * Data health (MVP gap, step 3): how many outstanding tasks are missing the three
 * fields that imported work lists genuinely lack — the responsible engineer, a
 * forecast finish and a priority — and exactly which tasks they are. Nothing is
 * filled in or guessed; a gap is a gap.
 */
const HEALTH_FIELDS = {
  engineer: { label: 'No responsible engineer', missing: (t) => !t.assignee_user_id && !String(t.responsible_engineer || '').trim() },
  forecast: { label: 'No forecast finish', missing: (t) => !String(t.current_forecast_finish || '').trim() },
  priority: { label: 'No priority', missing: (t) => !String(t.priority || '').trim() },
};

export const FIELD_KEYS = Object.keys(HEALTH_FIELDS);

/** Which of the three a task is missing, in a fixed order. */
export const missingFieldsOf = (task) => FIELD_KEYS.filter((key) => HEALTH_FIELDS[key].missing(task));
