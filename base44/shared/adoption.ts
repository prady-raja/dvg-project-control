/**
 * Adoption, measured from the app's own data (O-02): reports per user per working
 * day, and villas reported today. It replaces an outside analytics tool.
 */
import { heldLocationIds, shiftDay, toDay } from './dashboardCore.ts';
import { isWorkingDay } from './calendar.ts';

export function adoptionView({ updates = [], members = [], locations = [], settings, asOf, days = 14 }) {
  const window = [];
  for (let i = 0; i < days; i += 1) {
    const day = shiftDay(asOf, -i);
    if (isWorkingDay(day, settings)) window.push(day);
  }
  const live = updates.filter((u) => u.voided !== true);
  const byUser = new Map(members.map((m) => [m.user_id, { user_id: m.user_id, name: m.name || m.email, perDay: Object.fromEntries(window.map((d) => [d, 0])), total: 0 }]));
  live.forEach((u) => {
    const day = toDay(u.update_date);
    if (!window.includes(day)) return;
    const row = byUser.get(u.reported_by_id) || byUser.set(u.reported_by_id, { user_id: u.reported_by_id, name: u.reported_by_name || 'Unknown', perDay: Object.fromEntries(window.map((d) => [d, 0])), total: 0 }).get(u.reported_by_id);
    row.perDay[day] += 1;
    row.total += 1;
  });
  const held = heldLocationIds(locations);
  const villas = locations.filter((l) => l.location_type === 'Villa' && !held.has(l.id));
  const reportedToday = new Set(live.filter((u) => toDay(u.update_date) === asOf).map((u) => u.location_id).filter(Boolean));
  const rows = [...byUser.values()].map((row) => ({
    ...row,
    per_working_day: window.length ? Math.round((row.total / window.length) * 10) / 10 : 0,
    days_reported: window.filter((d) => row.perDay[d] > 0).length,
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return {
    as_of: asOf,
    working_days: window.length,
    rows,
    villas_total: villas.length,
    villas_reported_today: villas.filter((v) => reportedToday.has(v.id)).length,
    reports_today: live.filter((u) => toDay(u.update_date) === asOf).length,
  };
}
