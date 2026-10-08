import { WORK_PACKAGE_REQUIRED_DISCIPLINES } from '@/lib/constants';

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/**
 * Step 1A business rules, applied before a task is saved.
 * Server-side enforcement and audit trails arrive in Step 1B.
 */
export function validateTask(form, options = {}) {
  const errors = [];
  const { originalForecast } = options;

  if (!form.name || !form.name.trim()) errors.push('Task name is required.');
  if (!form.project_id) errors.push('A project is required.');
  if (!form.discipline) errors.push('A discipline is required.');

  if (WORK_PACKAGE_REQUIRED_DISCIPLINES.includes(form.discipline) && !form.work_package) {
    errors.push(`${form.discipline} tasks require a work package.`);
  }

  const progress = num(form.progress_percent);
  if (progress !== null && (progress < 0 || progress > 100)) {
    errors.push('Progress must be between 0 and 100.');
  }

  const nonNegative = [
    ['planned_quantity', 'Planned quantity'],
    ['completed_quantity', 'Completed quantity'],
    ['planned_manpower', 'Planned manpower'],
    ['actual_manpower', 'Actual manpower'],
    ['estimated_manhours', 'Estimated man-hours'],
    ['actual_manhours', 'Actual man-hours'],
  ];
  nonNegative.forEach(([key, label]) => {
    const value = num(form[key]);
    if (value !== null && value < 0) errors.push(`${label} cannot be negative.`);
  });

  const planned = num(form.planned_quantity);
  const completed = num(form.completed_quantity);
  if (planned !== null && completed !== null && completed > planned && !form.quantity_override) {
    errors.push('Completed quantity exceeds planned quantity — tick "Authorised adjustment" to confirm.');
  }

  if (form.actual_start && form.actual_finish && form.actual_finish < form.actual_start) {
    errors.push('Actual finish cannot be earlier than actual start.');
  }

  if (form.blocked_since && !form.blocker_category) {
    errors.push('Select a blocker category for the blocked date.');
  }

  if (form.status === 'Blocked' && !form.blocker_category) {
    errors.push('A blocked task needs a blocker category.');
  }

  if (
    originalForecast !== undefined &&
    (form.current_forecast_finish || null) !== (originalForecast || null) &&
    !(form.date_revision_reason || '').trim()
  ) {
    errors.push('A forecast date change needs a date revision reason.');
  }

  return errors;
}

/** Progress reaching 100% never closes a task automatically. */
export function statusSuggestionForProgress(progress, currentStatus) {
  if (currentStatus === 'Closed') return currentStatus;
  return currentStatus;
}