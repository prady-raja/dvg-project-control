/**
 * Owner access visits (P-09). Work in a handed-over villa waits on the owner letting
 * DVG in, so the works that need access are bundled into one request, the visit is
 * confirmed with a date and window, and what happens to the tasks follows from how
 * the visit ends. Pure rules; the ownerAccess function applies them.
 */
import { fail } from './records.ts';

export const VISIT_STATUSES = ['Requested', 'Confirmed', 'Done', 'No-show', 'Cancelled'];
export const CONFIRMED_VIA = ['WhatsApp', 'Phone', 'In person'];
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
const clean = (v, max) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

/** What moves a visit from one state to the next. */
export const NEXT_STATES = {
  Requested: ['Confirmed', 'Cancelled'],
  Confirmed: ['Done', 'No-show', 'Cancelled'],
  Done: [],
  'No-show': [],
  Cancelled: [],
};

export function canMoveVisit(from, to) {
  return (NEXT_STATES[from] || []).includes(to);
}

/** The tasks that can go into a visit: open work in the villa that needs the owner's access. */
export function tasksNeedingAccess(tasks = [], locationId) {
  return tasks.filter((t) => t.location_id === locationId && t.archived !== true && t.is_villa_work_parent !== true
    && t.status !== 'Closed' && t.status !== 'Approved'
    && (t.access_status === 'Pending' || t.blocker_category === 'Owner Access Pending' || t.owner_access_required === 'Yes'));
}

/** A request's content: which tasks, and a day with its window when one is proposed. */
export function requestInput(input = {}, { today = '' } = {}) {
  const taskIds = [...new Set((Array.isArray(input.task_ids) ? input.task_ids : []).map((x) => clean(x, 80)).filter(Boolean))].slice(0, 80);
  if (!taskIds.length) throw fail('Choose at least one task that needs access.');
  const date = clean(input.visit_date, 10);
  if (date && !isDay(date)) throw fail('The visit date must be a real date.');
  if (date && today && date < today) throw fail('The visit date cannot be in the past.');
  const start = clean(input.window_start, 5);
  const end = clean(input.window_end, 5);
  if ((start && !isTime(start)) || (end && !isTime(end))) throw fail('Times are written as HH:MM.');
  if (start && end && end <= start) throw fail('The window must end after it starts.');
  return { task_ids: taskIds, visit_date: date || null, window_start: start || null, window_end: end || null, notes: clean(input.notes, 1000) };
}

/** What confirming needs: a date, a window and how the owner said yes. */
export function confirmInput(input = {}, visit = {}, { today = '' } = {}) {
  const date = clean(input.visit_date || visit.visit_date, 10);
  if (!isDay(date)) throw fail('Give the date the owner agreed to.');
  if (today && date < today) throw fail('The visit date cannot be in the past.');
  const start = clean(input.window_start || visit.window_start, 5);
  const end = clean(input.window_end || visit.window_end, 5);
  if (!isTime(start) || !isTime(end)) throw fail('Give the time window the owner agreed to (HH:MM).');
  if (end <= start) throw fail('The window must end after it starts.');
  const via = clean(input.confirmed_via, 20);
  if (!CONFIRMED_VIA.includes(via)) throw fail(`Say how it was confirmed: ${CONFIRMED_VIA.join(', ')}.`);
  return { visit_date: date, window_start: start, window_end: end, confirmed_via: via };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Access booked Thu 10:00–17:00" for a confirmed visit. */
export function accessLine(visit) {
  if (!visit || visit.status !== 'Confirmed' || !isDay(visit.visit_date)) return '';
  const day = WEEKDAYS[new Date(`${visit.visit_date}T00:00:00Z`).getUTCDay()];
  return `Access booked ${day} ${visit.window_start || ''}${visit.window_end ? `–${visit.window_end}` : ''}`.trim();
}

/** The one WhatsApp message to the owner, listing the works, the trades and the hours. */
export function requestMessage({ location, tasks = [], contractors = [], visit = {}, ownerName = '' }) {
  const trades = [...new Set(tasks.map((t) => contractors.find((c) => c.id === t.contractor_id)?.trade || contractors.find((c) => c.id === t.contractor_id)?.name).filter(Boolean))];
  const hours = tasks.reduce((s, t) => s + (Number(t.estimated_manhours) || 0), 0);
  const when = visit.visit_date ? `${visit.visit_date}${visit.window_start ? ` between ${visit.window_start} and ${visit.window_end || '…'}` : ''}` : 'a day that suits you';
  return [
    `Hello ${ownerName || location?.owner_name || ''} — DVG would like access to ${location?.villa_code || 'your villa'} on ${when} to finish the pending works:`,
    ...tasks.slice(0, 12).map((t) => `• ${t.name}`),
    tasks.length > 12 ? `…and ${tasks.length - 12} more` : '',
    trades.length ? `Trades: ${trades.join(', ')}.` : '',
    hours ? `Estimated ${Math.round(hours)} working hours in all.` : '',
    location?.access_notes ? `Access notes on record: ${location.access_notes}` : '',
    'Could you confirm the day and times? Thank you.',
  ].filter(Boolean).join('\n');
}

/** Visits that did not happen, per villa. */
export function noShowCount(visits = [], locationId) {
  return visits.filter((v) => v.location_id === locationId && v.status === 'No-show').length;
}
