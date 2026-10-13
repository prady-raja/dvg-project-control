/**
 * Data health (MVP gap, step 3): how many outstanding tasks are missing the three
 * fields that imported work lists genuinely lack — the responsible engineer, a
 * forecast finish and a priority — and exactly which tasks they are. Nothing is
 * filled in or guessed; a gap is a gap.
 */
import { isCountable, isOutstanding } from './dashboardCore.ts';

export const HEALTH_FIELDS = {
  engineer: { label: 'No responsible engineer', missing: (t) => !t.assignee_user_id && !String(t.responsible_engineer || '').trim() },
  forecast: { label: 'No forecast finish', missing: (t) => !String(t.current_forecast_finish || '').trim() },
  priority: { label: 'No priority', missing: (t) => !String(t.priority || '').trim() },
};

export const FIELD_KEYS = Object.keys(HEALTH_FIELDS);

/** Which of the three a task is missing, in a fixed order. */
export const missingFieldsOf = (task) => FIELD_KEYS.filter((key) => HEALTH_FIELDS[key].missing(task));

export function dataHealthView({ tasks = [], ix, asOf, options = {} }) {
  const scope = tasks
    .filter((t) => isCountable(t, { includeDemo: options.includeDemo === true }) && isOutstanding(t) && t.is_villa_work_parent !== true)
    .filter((t) => !options.projectId || t.project_id === options.projectId)
    .filter((t) => !options.phaseId || t.phase_id === options.phaseId);

  const counts = Object.fromEntries(FIELD_KEYS.map((key) => [key, 0]));
  const lists = Object.fromEntries(FIELD_KEYS.map((key) => [key, []]));
  scope.forEach((t) => {
    missingFieldsOf(t).forEach((key) => {
      counts[key] += 1;
      lists[key].push(t);
    });
  });

  const field = FIELD_KEYS.includes(options.field) ? options.field : '';
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const rows = field
    ? lists[field]
      .slice()
      .sort((a, b) => String(a.task_ref || '').localeCompare(String(b.task_ref || ''), undefined, { numeric: true }))
      .slice(offset, offset + limit)
      .map((t) => ({
        id: t.id, ref: t.task_ref || '', name: t.name, villa: t.location_id ? ix?.villaCode(t.location_id) || '' : 'Site-wide',
        discipline: t.discipline || '', missing: missingFieldsOf(t),
      }))
    : [];

  return {
    as_of: asOf,
    tasks_reviewed: scope.length,
    fields: FIELD_KEYS.map((key) => ({ key, label: HEALTH_FIELDS[key].label, count: counts[key] })),
    field,
    rows,
    total: field ? counts[field] : 0,
    offset,
  };
}
