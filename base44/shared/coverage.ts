/**
 * Report coverage and the team view (D-05): which villas went unreported over the
 * last working days, and how each engineer's work stands. Pure, read from the
 * daily reports and the register — no extra records.
 */
import {
  heldLocationIds, isBlocked, isCountable, isOutstanding, isOverdue, isStale, isWorkingDay, shiftDay, toDay,
} from './dashboardCore.ts';

export const COVERAGE_DAYS = 14;

/** The last `days` working days up to and including asOf, oldest first. */
export function lastWorkingDays(asOf, settings, days = COVERAGE_DAYS) {
  const out = [];
  for (let i = 0; i < 90 && out.length < days; i += 1) {
    const day = shiftDay(asOf, -i);
    if (isWorkingDay(day, settings)) out.unshift(day);
  }
  return out;
}

export function coverageView({ locations = [], updates = [], tasks = [], members = [], settings, asOf, days = COVERAGE_DAYS }) {
  const window = lastWorkingDays(asOf, settings, days);
  const held = heldLocationIds(locations);
  const villas = locations
    .filter((l) => l.location_type === 'Villa' && !held.has(l.id) && l.active_status !== 'Inactive')
    .sort((a, b) => String(a.villa_code || '').localeCompare(String(b.villa_code || ''), undefined, { numeric: true }));
  const live = updates.filter((u) => u.voided !== true);

  // location -> day -> 'reported' | 'blocked'
  const cell = new Map();
  live.forEach((u) => {
    const day = toDay(u.update_date);
    if (!u.location_id || !window.includes(day)) return;
    const key = `${u.location_id}|${day}`;
    const blocked = u.blocker_reported === true || u.status === 'Blocked';
    if (blocked || !cell.has(key)) cell.set(key, blocked ? 'blocked' : 'reported');
  });

  const rows = villas.map((v) => {
    const cells = window.map((day) => ({ day, state: cell.get(`${v.id}|${day}`) || 'none' }));
    const reported = cells.filter((c) => c.state !== 'none').length;
    return {
      location_id: v.id, villa: v.villa_code, engineer_user_id: v.assigned_engineer_user_id || '',
      engineer: v.assigned_engineer || '', cells, reported, missed: window.length - reported,
    };
  });

  const open = tasks.filter((t) => isCountable(t) && isOutstanding(t));
  const byEngineer = new Map();
  const bucket = (id, name) => {
    if (!byEngineer.has(id)) byEngineer.set(id, { user_id: id === 'none' ? '' : id, name: name || 'Unassigned', villas: 0, open: 0, overdue: 0, blocked: 0, stale: 0, reports_today: 0 });
    return byEngineer.get(id);
  };
  members.forEach((m) => bucket(m.user_id, m.name || m.email));
  rows.forEach((r) => { if (r.engineer_user_id) bucket(r.engineer_user_id, r.engineer).villas += 1; });
  open.forEach((t) => {
    const b = bucket(t.assignee_user_id || 'none', t.responsible_engineer);
    b.open += 1;
    if (isOverdue(t, asOf)) b.overdue += 1;
    if (isBlocked(t)) b.blocked += 1;
    if (isStale(t.latest_report_date || t.updated_date || '', asOf, settings)) b.stale += 1;
  });
  live.filter((u) => toDay(u.update_date) === asOf).forEach((u) => { if (byEngineer.has(u.reported_by_id)) byEngineer.get(u.reported_by_id).reports_today += 1; });

  const team = [...byEngineer.values()]
    .filter((t) => t.villas || t.open || t.reports_today || t.user_id)
    .sort((a, b) => b.overdue - a.overdue || b.stale - a.stale || a.name.localeCompare(b.name));

  return {
    as_of: asOf,
    days: window,
    rows,
    team,
    totals: {
      villas: villas.length,
      unreported_today: rows.filter((r) => r.cells[r.cells.length - 1]?.state === 'none').length,
      never_reported: rows.filter((r) => r.reported === 0).length,
    },
  };
}
