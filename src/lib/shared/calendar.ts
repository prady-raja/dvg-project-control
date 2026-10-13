/**
 * FRONTEND COPY of the project settings rules in base44/shared/calendar.ts — the
 * browser may not import from base44/, so the settings every screen reads and the
 * checks the settings dialog makes live here too. Keep the two in step.
 *
 * Weekdays use ISO numbers: 1 = Monday ... 7 = Sunday.
 */

export const DEFAULT_SETTINGS = {
  working_days: [1, 2, 3, 4, 5, 6],
  holidays: [],
  stale_days: 7,
  at_risk_window_days: 7,
  backdate_limit_days: 7,
  report_cutoff_time: '18:00',
  site_lat: null,
  site_lng: null,
};

const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const toDay = (value) => (value ? String(value).slice(0, 10) : '');
const number = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

/** A project's settings with defaults filled in and nonsense replaced by the default. */
export function projectSettings(project) {
  const raw = project || {};
  const days = Array.isArray(raw.working_days)
    ? [...new Set(raw.working_days.map(Number).filter((d) => d >= 1 && d <= 7))].sort()
    : [];
  const positive = (value, fallback, max = 365) => {
    const n = number(value);
    return n !== null && Number.isFinite(n) && n >= 0 && n <= max ? Math.floor(n) : fallback;
  };
  return {
    working_days: days.length ? days : DEFAULT_SETTINGS.working_days,
    holidays: Array.isArray(raw.holidays) ? [...new Set(raw.holidays.map(toDay).filter(isDay))].sort() : [],
    stale_days: Math.max(positive(raw.stale_days, DEFAULT_SETTINGS.stale_days), 1),
    at_risk_window_days: positive(raw.at_risk_window_days, DEFAULT_SETTINGS.at_risk_window_days),
    backdate_limit_days: positive(raw.backdate_limit_days, DEFAULT_SETTINGS.backdate_limit_days),
    report_cutoff_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw.report_cutoff_time || ''))
      ? raw.report_cutoff_time
      : DEFAULT_SETTINGS.report_cutoff_time,
    site_lat: Number.isFinite(number(raw.site_lat)) && Math.abs(number(raw.site_lat)) <= 90 ? number(raw.site_lat) : null,
    site_lng: Number.isFinite(number(raw.site_lng)) && Math.abs(number(raw.site_lng)) <= 180 ? number(raw.site_lng) : null,
  };
}

/** Why these settings cannot be saved, one message per problem. */
export function settingsProblems(input) {
  const problems = [];
  const check = (field, label, min, max) => {
    const n = number(input?.[field]);
    if (input?.[field] === undefined || n === null) return;
    if (!Number.isInteger(n) || n < min || n > max) problems.push(`${label} must be a whole number from ${min} to ${max}.`);
  };
  check('stale_days', 'Stale after', 1, 60);
  check('at_risk_window_days', 'At-risk window', 0, 60);
  check('backdate_limit_days', 'Backdating limit', 0, 60);
  if (Array.isArray(input?.working_days)) {
    if (!input.working_days.length) problems.push('Choose at least one working day.');
    if (input.working_days.some((d) => !(Number(d) >= 1 && Number(d) <= 7))) problems.push('Working days must be Monday (1) to Sunday (7).');
  }
  if (Array.isArray(input?.holidays) && input.holidays.some((d) => !isDay(toDay(d)))) problems.push('Holidays must be dates.');
  if (input?.report_cutoff_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.report_cutoff_time))) problems.push('Report cut-off must be a time like 18:00.');
  const lat = number(input?.site_lat);
  const lng = number(input?.site_lng);
  if (lat !== null && !(Math.abs(lat) <= 90)) problems.push('Latitude must be between -90 and 90.');
  if (lng !== null && !(Math.abs(lng) <= 180)) problems.push('Longitude must be between -180 and 180.');
  return problems;
}