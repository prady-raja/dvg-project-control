/**
 * The project calendar (S-01): which days are working days, the holidays, and the
 * thresholds that are counted in working days. Every stale, at-risk, overdue and
 * reminder rule reads its settings through here, so a Sunday or a festival never
 * makes work look neglected.
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

const DAY_MS = 86400000;
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

const isoWeekday = (day) => {
  const dow = new Date(`${toDay(day)}T00:00:00Z`).getUTCDay();
  return dow === 0 ? 7 : dow;
};

const shift = (day, n) => new Date(Date.parse(`${toDay(day)}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

export function isWorkingDay(day, settings = DEFAULT_SETTINGS) {
  if (!isDay(toDay(day))) return false;
  return settings.working_days.includes(isoWeekday(day)) && !settings.holidays.includes(toDay(day));
}

/** Working days in (from, to]: from is the day already done, to is today. 0 when to is not after from. */
export function workingDaysBetween(from, to, settings = DEFAULT_SETTINGS) {
  const start = toDay(from);
  const end = toDay(to);
  if (!isDay(start) || !isDay(end) || end <= start) return 0;
  let count = 0;
  // Bounded: a year of days is far beyond any rule that calls this.
  for (let day = shift(start, 1), guard = 0; day <= end && guard < 800; day = shift(day, 1), guard += 1) {
    if (isWorkingDay(day, settings)) count += 1;
  }
  return count;
}

/** The day that is n working days after `day` (n may be 0). */
export function addWorkingDays(day, n, settings = DEFAULT_SETTINGS) {
  let current = toDay(day);
  let left = Math.max(Number(n) || 0, 0);
  for (let guard = 0; left > 0 && guard < 800; guard += 1) {
    current = shift(current, 1);
    if (isWorkingDay(current, settings)) left -= 1;
  }
  return current;
}

/**
 * True when nothing has been reported for more working days than the project
 * allows. A task never reported at all is stale.
 */
export function isStale(lastDay, asOf, settings = DEFAULT_SETTINGS) {
  const last = toDay(lastDay);
  if (!isDay(last)) return true;
  return workingDaysBetween(last, asOf, settings) > settings.stale_days;
}
