/**
 * FRONTEND COPY of the owner-access helpers in base44/shared/ownerAccess.ts — the
 * browser may not import from base44/. A parity test keeps the two in step.
 */
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/** The tasks that can go into a visit: open work in the villa that needs the owner's access. */
export function tasksNeedingAccess(tasks = [], locationId) {
  return tasks.filter((t) => t.location_id === locationId && t.archived !== true && t.is_villa_work_parent !== true
    && t.status !== 'Closed' && t.status !== 'Approved'
    && (t.access_status === 'Pending' || t.blocker_category === 'Owner Access Pending' || t.owner_access_required === 'Yes'));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Access booked Thu 10:00–17:00" for a confirmed visit. */
export function accessLine(visit) {
  if (!visit || visit.status !== 'Confirmed' || !isDay(visit.visit_date)) return '';
  const day = WEEKDAYS[new Date(`${visit.visit_date}T00:00:00Z`).getUTCDay()];
  return `Access booked ${day} ${visit.window_start || ''}${visit.window_end ? `–${visit.window_end}` : ''}`.trim();
}
