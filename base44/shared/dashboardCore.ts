/**
 * Dashboard calculation core.
 *
 * Every management figure in this application is computed here, on the server,
 * from stored records — never in the browser and never by the AI model. The
 * rules are deliberately explicit so they can be moved to another database
 * without rewriting the meaning of a number:
 *
 *  - Closed work is no longer outstanding. Everything else is.
 *  - Overdue means the work is still to be executed and its finish date has
 *    passed. Work that is already executed, awaiting inspection or approved is
 *    never called overdue — it is called "awaiting verification".
 *  - Finish date = current forecast finish, falling back to the approved
 *    baseline finish. Nothing else is treated as a scheduled date.
 *  - A villa-work parent row is an assignment holder, never work: it is held out
 *    of every count so parent and children are never double counted.
 *  - Demo records are excluded from operational totals unless an administrator
 *    explicitly switches the demo view on.
 *  - Villas on hold stay in inventory, but their work is held out of active
 *    execution figures and reported separately instead of being hidden.
 */

import { isStale, projectSettings } from './calendar.ts';

export { addWorkingDays, isStale, isWorkingDay, projectSettings, workingDaysBetween } from './calendar.ts';

export const IST_OFFSET_MINUTES = 330;
export const DAY_MS = 86400000;

export const todayIst = (now = Date.now()) =>
  new Date(now + IST_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);

export const toDay = (value) => (value ? String(value).slice(0, 10) : '');

export const shiftDay = (day, days) => {
  const base = Date.parse(`${toDay(day)}T00:00:00Z`);
  return Number.isNaN(base) ? '' : new Date(base + days * DAY_MS).toISOString().slice(0, 10);
};

export const daysBetween = (from, to) => {
  const a = Date.parse(`${toDay(from)}T00:00:00Z`);
  const b = Date.parse(`${toDay(to)}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.round((b - a) / DAY_MS);
};

export const EXECUTING_STATUSES = ['Not Started', 'In Progress', 'Blocked'];
export const VERIFICATION_STATUSES = ['Execution Complete', 'Under Inspection'];
export const CLOSURE_STATUSES = ['Approved'];

export const isArchived = (task) => task?.archived === true;
export const isParentRow = (task) => task?.is_villa_work_parent === true;
export const isDemoTask = (task) => task?.is_demo === true;
export const isExecuting = (task) => EXECUTING_STATUSES.includes(task?.status);
export const isAwaitingVerification = (task) => VERIFICATION_STATUSES.includes(task?.status);
export const isAwaitingClosure = (task) => CLOSURE_STATUSES.includes(task?.status);
export const isOutstanding = (task) => !!task && task.status !== 'Closed';
/**
 * Blocked means work that is still to be executed and either has the status
 * Blocked or carries a recorded blocker. Every board uses this one reading, so
 * the Villa page, the Blocker board, the Contractor board and the meeting report
 * can never disagree (X-06). Finished work with a leftover blocker note is not blocked.
 */
export const isBlocked = (task) =>
  !!task && isExecuting(task) && (task.status === 'Blocked' || !!String(task.blocker_description || '').trim());

/** The one date the application schedules against. */
export const finishDate = (task) => toDay(task?.current_forecast_finish) || toDay(task?.baseline_finish);
export const finishSource = (task) =>
  task?.current_forecast_finish ? 'Forecast' : task?.baseline_finish ? 'Baseline' : '';

/** Days past the finish date. Only still-to-be-executed work can be overdue. */
export const overdueDays = (task, asOf) => {
  if (!isOutstanding(task) || !isExecuting(task)) return 0;
  const finish = finishDate(task);
  if (!finish || finish >= asOf) return 0;
  return daysBetween(finish, asOf) || 0;
};

export const isOverdue = (task, asOf) => overdueDays(task, asOf) > 0;

export const dueInDays = (task, asOf) => {
  if (!isOutstanding(task) || !isExecuting(task)) return null;
  const finish = finishDate(task);
  if (!finish || finish < asOf) return null;
  return daysBetween(asOf, finish);
};

export const dueWithin = (task, asOf, days) => {
  const delta = dueInDays(task, asOf);
  return delta !== null && delta <= days;
};

export const isUnscheduled = (task) =>
  isOutstanding(task) && !toDay(task?.baseline_finish) && !toDay(task?.current_forecast_finish);

/** Quantity progress, only when both sides of the measurement exist. */
export const quantityProgress = (task) => {
  const planned = Number(task?.planned_quantity);
  const completed = Number(task?.completed_quantity);
  if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(completed)) return null;
  return Math.round((completed / planned) * 1000) / 10;
};

/** Progress as recorded: finished work counts as 100%, everything else only when it was measured. */
export const measuredProgress = (task) => {
  if (!task) return null;
  if (['Approved', 'Closed'].includes(task.status)) return 100;
  return typeof task.progress_percent === 'number' ? task.progress_percent : null;
};

/**
 * Weighted completion, only from measured progress.
 *
 * A percentage is produced only when EVERY task in the set is measured —
 * Approved and Closed work counts as 100% — otherwise the answer is null and the
 * screens show status counts plus "N of M tasks measured" instead. Nothing is
 * averaged blindly and nothing is invented. Weight is the task's estimated
 * man-hours (1 when unset).
 */
export function weightedProgress(tasks) {
  const counted = tasks || [];
  const measured = counted.filter((task) => measuredProgress(task) !== null);
  let weight = 0;
  let acc = 0;
  measured.forEach((task) => {
    const w = Number(task.estimated_manhours) > 0 ? Number(task.estimated_manhours) : 1;
    weight += w;
    acc += w * measuredProgress(task);
  });
  const reliable = counted.length > 0 && measured.length === counted.length;
  return {
    percent: reliable && weight > 0 ? Math.round((acc / weight) * 10) / 10 : null,
    measured: measured.length,
    total: counted.length,
    measured_share: counted.length ? Math.round((measured.length / counted.length) * 100) : 0,
    reliable,
    basis: 'Estimated man-hours',
    reason: !counted.length
      ? 'No task records in this scope'
      : reliable
        ? ''
        : `Measured progress exists for ${measured.length} of ${counted.length} tasks`,
  };
}

export function statusCounts(tasks, asOf) {
  const list = tasks || [];
  return {
    total: list.length,
    open: list.filter(isOutstanding).length,
    executing: list.filter(isExecuting).length,
    blocked: list.filter(isBlocked).length,
    overdue: list.filter((t) => isOverdue(t, asOf)).length,
    awaitingVerification: list.filter(isAwaitingVerification).length,
    awaitingClosure: list.filter(isAwaitingClosure).length,
    unscheduled: list.filter(isUnscheduled).length,
    closed: list.filter((t) => t.status === 'Closed').length,
  };
}

/* -------------------------------------------------------------- reference index */

export function buildIndex({ projects = [], phases = [], locations = [], contractors = [], disciplines = [], updates = [] } = {}) {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const contractorMap = new Map(contractors.map((c) => [c.id, c]));
  const disciplineMap = new Map(disciplines.map((d) => [d.code, d]));

  const reportByTask = new Map();
  const latestReport = new Map();
  updates.forEach((update) => {
    if (!update?.task_id) return;
    if (!reportByTask.has(update.task_id)) reportByTask.set(update.task_id, []);
    reportByTask.get(update.task_id).push(update);
    const at = Date.parse(update.reported_at || '') || 0;
    const current = latestReport.get(update.task_id);
    if (!current || (Date.parse(current.reported_at || '') || 0) < at) latestReport.set(update.task_id, update);
  });

  return {
    project: (id) => projectMap.get(id) || null,
    settings: (id) => projectSettings(projectMap.get(id)),
    projectName: (id) => projectMap.get(id)?.name || '',
    phase: (id) => phaseMap.get(id) || null,
    phaseName: (id) => phaseMap.get(id)?.name || '',
    phaseCode: (id) => phaseMap.get(id)?.code || '',
    villa: (id) => locationMap.get(id) || null,
    villaCode: (id) => locationMap.get(id)?.villa_code || '',
    contractor: (id) => contractorMap.get(id) || null,
    contractorName: (id) => contractorMap.get(id)?.name || '',
    disciplineName: (code) => disciplineMap.get(code)?.name || code || '',
    reportsFor: (taskId) => (reportByTask.get(taskId) || []).slice().sort((a, b) => String(b.reported_at).localeCompare(String(a.reported_at))),
    latestReportFor: (taskId) => latestReport.get(taskId) || null,
    lastReportAt: (taskId) => latestReport.get(taskId)?.reported_at || '',
  };
}

/** Villas whose work is held out of active execution figures. */
export const heldLocationIds = (locations = []) =>
  new Set(locations.filter((l) => l.active_status === 'On Hold').map((l) => l.id));

/**
 * The one exclusion filter every dashboard screen uses (X-06): archived rows,
 * villa-work parents (assignment holders, never work) and demo records are left
 * out of every figure. Villas on hold are handled by splitHeld, so their work is
 * reported separately rather than hidden.
 */
export const isCountable = (task, { includeDemo = false } = {}) =>
  !!task && !isArchived(task) && !isParentRow(task) && (includeDemo || !isDemoTask(task));

export function scopeTasks(tasks, options = {}) {
  const { projectId, phaseId, locationId, contractorId, discipline, includeDemo = false } = options;
  return (tasks || []).filter((task) => {
    if (!isCountable(task, { includeDemo })) return false;
    if (projectId && task.project_id !== projectId) return false;
    if (phaseId && task.phase_id !== phaseId) return false;
    if (locationId && task.location_id !== locationId) return false;
    if (contractorId && task.contractor_id !== contractorId) return false;
    if (discipline && task.discipline !== discipline) return false;
    return true;
  });
}

/** Split scoped work into active execution and work held on a villa that is on hold. */
export function splitHeld(tasks, heldIds) {
  return {
    active: tasks.filter((t) => !t.location_id || !heldIds.has(t.location_id)),
    held: tasks.filter((t) => t.location_id && heldIds.has(t.location_id)),
  };
}

/** One shape for every task row a dashboard shows. */
export function taskRow(task, ix, asOf) {
  const villa = task.location_id ? ix.villa(task.location_id) : null;
  const finish = finishDate(task);
  const overdue = overdueDays(task, asOf);
  const decisions = [];
  if (isAwaitingVerification(task)) decisions.push('Inspection and verification pending');
  if (isAwaitingClosure(task)) decisions.push('Approval and closure pending');
  if (task.access_status === 'Pending') decisions.push('Owner access pending');
  if (task.selection_status === 'Pending Selection') decisions.push('Client selection pending');
  if (['To Order', 'Ordered'].includes(task.procurement_status)) decisions.push(`${task.procurement_status} material`);
  if (isBlocked(task)) decisions.push('Blocker to clear');

  return {
    id: task.id,
    ref: task.task_ref || '',
    name: task.name || '',
    description: task.description || '',
    project_id: task.project_id,
    project: ix.projectName(task.project_id),
    phase_id: task.phase_id || '',
    phase: ix.phaseName(task.phase_id),
    location_id: task.location_id || '',
    villa: villa?.villa_code || (task.location_id ? 'Location' : 'Site-wide'),
    villa_on_hold: villa?.active_status === 'On Hold',
    possession: villa?.possession_status || '',
    scope: task.location_id ? 'Villa' : 'Site-wide',
    discipline: task.discipline || '',
    discipline_name: ix.disciplineName(task.discipline),
    work_package: task.work_package || '',
    status: task.status || '',
    priority: task.priority || '',
    contractor_id: task.contractor_id || '',
    contractor: ix.contractorName(task.contractor_id),
    engineer: task.responsible_engineer || '',
    progress: typeof task.progress_percent === 'number' ? task.progress_percent : null,
    quantity: {
      planned: task.planned_quantity ?? null,
      completed: task.completed_quantity ?? null,
      unit: task.measurement_unit || '',
      percent: quantityProgress(task),
    },
    baseline_finish: toDay(task.baseline_finish),
    forecast_finish: toDay(task.current_forecast_finish),
    finish,
    finish_source: finishSource(task),
    overdue_days: overdue,
    due_in_days: dueInDays(task, asOf),
    blocked: isBlocked(task),
    blocked_since: toDay(task.blocked_since),
    blocked_days: task.blocked_since ? daysBetween(task.blocked_since, asOf) : null,
    blocker: task.blocker_description || '',
    blocker_category: task.blocker_category || '',
    blocker_responsible: task.blocker_responsible_party || '',
    baseline_locked: task.baseline_locked === true,
    decisions,
    latest_update: task.latest_update || '',
    last_reported_at: ix.lastReportAt(task.id) || task.updated_date || '',
    is_demo: isDemoTask(task),
    is_parent: isParentRow(task),
  };
}

/** One line of "what to do about it" per task, derived from recorded state only. */
export function actionFor(row) {
  if (row.status === 'Blocked') return `Clear blocker${row.blocker_category ? ` — ${row.blocker_category}` : ''}`;
  if (row.status === 'Execution Complete' || row.status === 'Under Inspection') return 'Inspect and verify the work';
  if (row.status === 'Approved') return 'Close the task after handover checks';
  if (row.overdue_days > 0) return 'Re-plan the finish date with a reason';
  if (row.due_in_days !== null && row.due_in_days <= 7) return 'Complete within the week';
  if (!row.finish) return 'Set baseline or forecast dates';
  if (row.decisions.length) return row.decisions[0];
  return 'Monitor';
}

/** Importance score for the management priority list — recorded facts only. */
export function priorityScore(row) {
  const priorityWeight = { Critical: 30, High: 15, Medium: 5, Low: 0 }[row.priority] || 0;
  return (
    Math.min(row.overdue_days || 0, 120) * 2 +
    (row.status === 'Blocked' ? 50 : 0) +
    (row.blocker ? 20 : 0) +
    priorityWeight +
    (row.overdue_days > 0 ? 10 : 0)
  );
}

export const take = (list, limit) => (list || []).slice(0, limit);

export const compareFinish = (a, b) => {
  if (!a.finish && !b.finish) return 0;
  if (!a.finish) return 1;
  if (!b.finish) return -1;
  return a.finish.localeCompare(b.finish);
};

/**
 * The task set behind each headline number, so every figure on a dashboard can
 * be opened and reconciled against the underlying records.
 */
export function metricTasks(tasks, metric, asOf, options = {}) {
  const locations = options.locations || [];
  const heldIds = options.heldIds || new Set();
  const settingsFor = options.settingsFor || (() => projectSettings(null));
  const villaOf = new Map(locations.map((l) => [l.id, l]));
  // The list behind a headline figure is scoped exactly like the figure itself:
  // same project, same phase, same exclusion filter.
  const scoped = scopeTasks(tasks, { projectId: options.projectId, phaseId: options.phaseId, includeDemo: options.includeDemo });
  const active = scoped.filter((t) => !t.location_id || !heldIds.has(t.location_id));
  switch (metric) {
    case 'open': return active.filter(isOutstanding);
    case 'executing': return active.filter(isExecuting);
    case 'overdue': return active.filter((t) => isOverdue(t, asOf));
    case 'blocked': return active.filter(isBlocked);
    case 'awaiting_verification': return active.filter(isAwaitingVerification);
    case 'awaiting_closure': return active.filter(isAwaitingClosure);
    case 'due_7': return active.filter((t) => dueWithin(t, asOf, 7));
    case 'due_14': return active.filter((t) => dueWithin(t, asOf, 14));
    case 'unscheduled': return active.filter(isUnscheduled);
    case 'held': return scoped.filter((t) => t.location_id && heldIds.has(t.location_id) && isOutstanding(t));
    case 'site_wide': return active.filter((t) => !t.location_id && isOutstanding(t));
    case 'handed_over_open_works':
      return active.filter(
        (t) => isOutstanding(t) && villaOf.get(t.location_id)?.possession_status === 'Handed Over',
      );
    case 'stale_updates':
      return active.filter((t) => {
        if (!isOutstanding(t)) return false;
        const last = t.last_report_at || t.latest_report_date || t.updated_date || '';
        return isStale(last, asOf, settingsFor(t.project_id));
      });
    default: return active.filter(isOutstanding);
  }
}