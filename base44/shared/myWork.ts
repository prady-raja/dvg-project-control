/**
 * "Today" (N-02): the work that is mine, and the small counts the menu badges use
 * (N-01). Both are pure views over loadProjectData, so they become a SQL view
 * after the move and never call count() or aggregate() on the platform.
 *
 * "Mine" means assigned to me by user id; until work was assigned to accounts
 * (T-01) a task also counts when the typed engineer name is my full name, ignoring case.
 */
import {
  addWorkingDays, daysBetween, finishDate, healthFor, isBlocked, isCountable, isExecuting, isOutstanding,
  isStale, isWorkingDay, projectSettings, shiftDay, splitHeld, heldLocationIds, statusCounts, taskRow, toDay,
  actionFor, isAwaitingVerification, isOverdue,
} from './dashboardCore.ts';
import { attentionFor } from './attention.ts';
import { normName } from './assignees.ts';
import { commitmentState } from './commitments.ts';
import { accessLine } from './ownerAccess.ts';

const sameName = (a, b) => !!normName(a) && normName(a) === normName(b);

export const isMine = (task, me) =>
  task.assignee_user_id
    ? task.assignee_user_id === me.id
    : sameName(task.responsible_engineer, me.name);

const isMyVilla = (location, me) =>
  location.assigned_engineer_user_id
    ? location.assigned_engineer_user_id === me.id
    : sameName(location.assigned_engineer, me.name);

/** The last working day before asOf — the day whose "plan for tomorrow" is today's plan. */
export function previousWorkingDay(asOf, settings) {
  let day = shiftDay(asOf, -1);
  for (let i = 0; i < 14 && !isWorkingDay(day, settings); i += 1) day = shiftDay(day, -1);
  return day;
}

const reasonsFor = (task, row, asOf, settings, ix) => {
  const reasons = [];
  if (row.overdue_days > 0) reasons.push({ code: 'overdue', label: `Overdue ${row.overdue_days}d`, weight: 100 + row.overdue_days });
  if (isBlocked(task)) reasons.push({ code: 'blocked', label: row.blocked_days ? `Blocked ${row.blocked_days}d` : 'Blocked', weight: 80 });
  if (isExecuting(task) && !isBlocked(task)) {
    const horizon = addWorkingDays(asOf, 7, settings);
    const finish = finishDate(task);
    if (finish && finish >= asOf && finish <= horizon) reasons.push({ code: 'due', label: `Due in ${daysBetween(asOf, finish)}d`, weight: 40 });
    const last = ix.lastReportAt(task.id) || task.latest_report_date || task.updated_date || '';
    if (isStale(last, asOf, settings)) reasons.push({ code: 'stale', label: 'No update for a while', weight: 30 });
  }
  if (isAwaitingVerification(task)) reasons.push({ code: 'verify', label: 'Waiting for inspection', weight: 20 });
  return reasons;
};

export function myWorkView({
  tasks = [], locations = [], commitments = [], snags = [], updates = [], proposals = [], visits = [], ix, asOf, user, options = {},
}) {
  const me = { id: user.id, name: user.full_name || '' };
  const all = options.allVillas === true;
  const heldIds = heldLocationIds(locations);
  const scoped = tasks.filter((t) => isCountable(t, { includeDemo: options.includeDemo === true })
    && (!options.projectId || t.project_id === options.projectId));
  const { active } = splitHeld(scoped, heldIds);
  const settingsOf = (projectId) => ix.settings(projectId);

  const mine = all ? active : active.filter((t) => isMine(t, me));
  const myOpen = mine.filter(isOutstanding);

  /* ------------------------------------------------------------ my villas */
  const villaIds = new Set(myOpen.map((t) => t.location_id).filter(Boolean));
  locations.forEach((l) => {
    if (l.location_type === 'Villa' && (all ? (!options.projectId || l.project_id === options.projectId) && l.active_status !== 'On Hold' : isMyVilla(l, me))) villaIds.add(l.id);
  });
  const reportsToday = updates.filter((u) => toDay(u.update_date) === asOf);
  const reportedBy = new Map();
  reportsToday.forEach((u) => {
    if (!u.location_id) return;
    const entry = reportedBy.get(u.location_id) || { any: false, mine: false };
    entry.any = true;
    if (u.reported_by_id === me.id) entry.mine = true;
    reportedBy.set(u.location_id, entry);
  });
  const villas = [...villaIds]
    .map((id) => locations.find((l) => l.id === id))
    .filter(Boolean)
    .map((l) => {
      const here = active.filter((t) => t.location_id === l.id && isOutstanding(t));
      const counts = statusCounts(here, asOf);
      const seen = reportedBy.get(l.id) || { any: false, mine: false };
      return {
        id: l.id, code: l.villa_code, phase: ix.phaseName(l.phase_id),
        handed_over: l.possession_status === 'Handed Over',
        reported_today: seen.any, reported_by_me: seen.mine,
        open: counts.open, overdue: counts.overdue, blocked: counts.blocked,
      };
    })
    .sort((a, b) => Number(a.reported_today) - Number(b.reported_today) || b.overdue - a.overdue || a.code.localeCompare(b.code));

  /* ------------------------------------------------------------ my tasks */
  const rows = myOpen
    .map((task) => {
      const row = taskRow(task, ix, asOf);
      const reasons = reasonsFor(task, row, asOf, settingsOf(task.project_id), ix);
      return { ...row, reasons, weight: reasons.reduce((max, r) => Math.max(max, r.weight), 0), action: actionFor(row), health: healthFor(task, ix, asOf) };
    })
    .filter((row) => row.reasons.length)
    .sort((a, b) => b.weight - a.weight || String(a.finish || '9').localeCompare(String(b.finish || '9')));

  /* ----------------------------------------------- today's plan (yesterday's) */
  const settings = settingsOf(options.projectId || scoped[0]?.project_id);
  const planDay = previousWorkingDay(asOf, settings);
  const myTaskIds = new Set(myOpen.map((t) => t.id));
  const plan = updates
    .filter((u) => toDay(u.update_date) === planDay && String(u.plan_tomorrow || '').trim()
      && (all || myTaskIds.has(u.task_id) || villaIds.has(u.location_id)))
    .map((u) => ({ id: u.id, task_id: u.task_id, task_ref: u.task_ref, villa: u.villa_code || 'Site-wide', plan: u.plan_tomorrow, reported_by: u.reported_by_name, update_date: planDay }));

  /* ------------------------------------------------------------ commitments */
  const horizon = shiftDay(asOf, 7);
  const myCommitments = commitments
    .filter((c) => (c.status || 'Open') === 'Open' && c.promised_date && toDay(c.promised_date) <= horizon
      && (!options.projectId || c.project_id === options.projectId)
      && (all || c.responsible_user_id === me.id || (!c.responsible_user_id && sameName(c.responsible_person, me.name))))
    .map((c) => ({
      id: c.id, commitment: c.commitment, promised_date: toDay(c.promised_date), task_ref: c.task_ref || '',
      contractor: ix.contractorName(c.contractor_id), person: c.responsible_person || '',
      // Worked out on read, never stored: open and past its date is missed.
      missed: commitmentState(c, asOf) === 'Missed',
    }))
    .sort((a, b) => a.promised_date.localeCompare(b.promised_date));

  /* ---------------------------------------------------------------- snags */
  const reinspect = snags
    .filter((s) => s.status === 'Awaiting Reinspection' && (all ? true : villaIds.has(s.location_id)))
    .map((s) => ({ id: s.id, snag_ref: s.snag_ref, title: s.title, villa: ix.villaCode(s.location_id) || 'Site-wide', severity: s.severity, area_label: s.area_label || '' }));

  /* --------------------------------------------------------- AI proposals */
  const waitingProposals = proposals
    .filter((p) => p.status === 'Proposed' && p.user_id === me.id)
    .map((p) => ({ id: p.id, message: String(p.message || '').slice(0, 140), proposed_at: p.proposed_at, actions: (p.actions || []).length }));

  /* --------------------------------------------------------- owner access */
  const horizonDay = shiftDay(asOf, 14);
  const accessVisits = visits
    .filter((v) => v.status === 'Confirmed' && toDay(v.visit_date) >= asOf && toDay(v.visit_date) <= horizonDay
      && (all ? (!options.projectId || v.project_id === options.projectId) : villaIds.has(v.location_id)))
    .sort((a, b) => toDay(a.visit_date).localeCompare(toDay(b.visit_date)))
    .map((v) => ({ id: v.id, location_id: v.location_id, villa: ix.villaCode(v.location_id) || '', line: accessLine(v), visit_date: toDay(v.visit_date), tasks: (v.task_ids || []).length }));

  const view = {
    as_of: asOf,
    mode: all ? 'all' : 'mine',
    me,
    plan_day: planDay,
    villas,
    tasks: rows,
    plan,
    commitments: myCommitments,
    snags: reinspect,
    access_visits: accessVisits,
    proposals: waitingProposals,
    counts: {
      tasks: rows.length,
      overdue: rows.filter((r) => r.reasons.some((x) => x.code === 'overdue')).length,
      blocked: rows.filter((r) => r.reasons.some((x) => x.code === 'blocked')).length,
      villas_unreported: villas.filter((v) => !v.reported_today).length,
      commitments_missed: myCommitments.filter((c) => c.missed).length,
    },
  };

  if (all) {
    const open = active.filter(isOutstanding);
    const c = statusCounts(active, asOf);
    view.headline = {
      overdue: c.overdue,
      at_risk: open.filter((t) => healthFor(t, ix, asOf) === 'At risk').length,
      blocked: c.blocked,
      awaiting_verification: c.awaitingVerification,
    };
    view.coverage = {
      villas: villas.length,
      reported: villas.filter((v) => v.reported_today).length,
      not_reported: villas.filter((v) => !v.reported_today).map((v) => v.code),
    };
  }
  return view;
}

/**
 * Small counts for the menu badges, from the same loaded data as every other
 * view. `attention` counts only the records that need a decision, not the long
 * tail of things merely to fill in.
 */
export function countsView({ tasks = [], locations = [], snags = [], dependencies = [], dismissals = [], ix, asOf, user, options = {} }) {
  const me = { id: user.id, name: user.full_name || '' };
  const heldIds = heldLocationIds(locations);
  const { active } = splitHeld(
    tasks.filter((t) => isCountable(t, { includeDemo: false }) && (!options.projectId || t.project_id === options.projectId)),
    heldIds,
  );
  const open = active.filter(isOutstanding);
  const mineOpen = open.filter((t) => isMine(t, me));
  const attention = attentionFor({ tasks, locations, areas: [], floors: [], dependencies, updates: [], dismissals, asOf, ix, options });
  return {
    as_of: asOf,
    today: mineOpen.filter((t) => isOverdue(t, asOf) || isBlocked(t)).length,
    blockers: open.filter(isBlocked).length,
    snags: snags.filter((s) => s.status !== 'Closed' && (!options.projectId || s.project_id === options.projectId)).length,
    attention: attention.counts.invalid,
  };
}
