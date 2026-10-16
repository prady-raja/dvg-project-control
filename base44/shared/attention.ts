/**
 * Task readiness, the standard lifecycle reading, and the Needs Attention list.
 *
 * Readiness is derived from what is recorded — never inferred:
 *
 *  - Waiting: a recorded blocker, the status Blocked, pending owner access or
 *    client selection, material to order or ordered, or a recorded predecessor
 *    that is not closed.
 *  - Ready: none of those, with a contractor and a finish date on the record.
 *  - Unknown: no blocking prerequisite is recorded AND the record does not say
 *    enough to judge (no contractor, or no date). Ready therefore never implies
 *    that materials, drawings or approvals were checked — only that nothing
 *    blocking has been recorded and the work has been planned.
 *
 * The lifecycle reading maps the stored statuses onto the standard stages
 * without rewriting a single stored value, so no report and no history changes
 * meaning. A blocker is a condition beside the execution stage, not a stage.
 */

import { isBlocked, isCountable, isOutstanding, isAwaitingVerification, isStale, toDay } from './dashboardCore.ts';
import { normalizeAreaName } from './villaAreas.ts';
import { looseKey, plotNumbersOf } from './villaResolve.ts';
import { isDismissed } from './attentionActions.ts';

export const READINESS_STATES = ['Ready', 'Waiting', 'Unknown'];

export const LIFECYCLE_STAGES = [
  'Not Started',
  'In Progress',
  'Execution Complete — Awaiting Verification',
  'Verified / Closed',
];

/** The standard stage for a stored status, plus the blocker condition beside it. */
export function lifecycleOf(task) {
  const status = task?.status || 'Not Started';
  const blocked = isBlocked(task);
  let stage = 'Not Started';
  if (status === 'Closed') stage = 'Verified / Closed';
  else if (status === 'Approved') stage = 'Verified / Closed';
  else if (status === 'Under Inspection' || status === 'Execution Complete') stage = 'Execution Complete — Awaiting Verification';
  else if (status === 'In Progress' || status === 'Blocked') stage = 'In Progress';

  return {
    stage,
    blocked,
    blocker_category: task?.blocker_category || '',
    blocker_since: toDay(task?.blocked_since),
    // Verification is recorded once, by the person who approved or closed the
    // work; the stage above only reads it back.
    verified_by: task?.approved_by_name || '',
    verified_at: task?.approved_at || '',
    executed_by: task?.execution_completed_by_name || '',
    execution_status_recorded: status === 'Blocked'
      ? 'Blocked was stored as the status; the underlying execution stage was not recorded separately on this record.'
      : '',
  };
}

/** Recorded reasons that make work wait, and that make readiness unknown. */
export function readinessOf(task, { dependencies = [], tasksById } = {}) {
  if (!task || task.archived === true) return { state: '', reasons: [] };
  if (['Closed', 'Approved'].includes(task.status)) return { state: '', reasons: [] };

  const reasons = [];
  if (task.status === 'Blocked') reasons.push({ code: 'status_blocked', label: 'Recorded as blocked' });
  if (task.blocker_description) {
    reasons.push({ code: 'blocker', label: `Blocker recorded${task.blocker_category ? ` — ${task.blocker_category}` : ''}` });
  }
  if (task.access_status === 'Pending') reasons.push({ code: 'access', label: 'Owner access pending' });
  if (task.selection_status === 'Pending Selection') reasons.push({ code: 'selection', label: 'Client selection pending' });
  if (['To Order', 'Ordered'].includes(task.procurement_status)) {
    reasons.push({ code: 'material', label: `Material ${String(task.procurement_status).toLowerCase()}` });
  }

  const predecessors = (dependencies || []).filter(
    (link) => link.active !== false && link.successor_task_id === task.id,
  );
  const openPredecessors = predecessors.filter((link) => {
    const before = tasksById?.get(link.predecessor_task_id);
    return before ? !['Closed', 'Approved'].includes(before.status) : true;
  });
  if (openPredecessors.length) {
    reasons.push({
      code: 'predecessor',
      label: `Waiting on ${openPredecessors.length} recorded predecessor${openPredecessors.length === 1 ? '' : 's'}`,
    });
  }

  const planned = !!task.contractor_id && !!toDay(task.baseline_finish || task.current_forecast_finish);
  const state = reasons.length ? 'Waiting' : planned ? 'Ready' : 'Unknown';
  const note = state === 'Ready'
    ? 'No blocking prerequisite is recorded, and the work is assigned with a finish date.'
    : state === 'Waiting'
      ? reasons.map((reason) => reason.label).join(' · ')
      : 'Nothing blocking is recorded, but the record does not yet carry an assignment and a finish date, so readiness has not been assessed.';

  return {
    state,
    reasons,
    note,
    predecessors: openPredecessors.length,
    dependency_links_recorded: predecessors.length,
  };
}

/* ------------------------------------------------------------- needs attention */

export const ATTENTION_CODES = {
  scope_unclear: { label: 'Room/area scope not stated', severity: 'incomplete' },
  no_contractor: { label: 'No contractor assigned', severity: 'incomplete' },
  no_coordinator: { label: 'No responsible DVG coordinator', severity: 'incomplete' },
  no_dates: { label: 'No baseline or forecast date', severity: 'incomplete' },
  progress_unknown: { label: 'Progress not measured', severity: 'incomplete' },
  stale_update: { label: 'No site update for too long', severity: 'incomplete' },
  unverified_complete: { label: 'Executed but not verified', severity: 'incomplete' },
  incomplete_predecessor: { label: 'A recorded predecessor is not closed', severity: 'incomplete' },
  possible_duplicate: { label: 'Possibly the same work listed twice', severity: 'invalid' },
  same_wording_no_room: { label: 'Same wording, no room recorded', severity: 'incomplete' },
  ambiguous_reference: { label: 'Ambiguous villa or plot reference', severity: 'invalid' },
  room_register_missing: { label: 'Villa has no rooms registered', severity: 'incomplete' },
  completed_with_open_work: { label: 'Villa marked Works Completed but work is still open', severity: 'invalid' },
  unassigned_location: { label: 'Villa work with no villa recorded', severity: 'invalid' },
};

const SEVERITY_ORDER = { invalid: 0, incomplete: 1 };

/**
 * The whole review list for one scope. Every item points at a record or at a
 * register gap, and says whether the record is invalid (a decision is needed
 * before it can be trusted) or merely incomplete (acceptable to import and fill
 * in later).
 */
export function attentionFor({ tasks = [], locations = [], areas = [], floors = [], dependencies = [], updates = [], dismissals = [], asOf, ix, options = {} }) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  // Demo and archived records never reach the review list; the same filter as every board.
  const scope = (options.projectId ? tasks.filter((task) => task.project_id === options.projectId) : tasks)
    .filter((task) => (options.phaseId ? task.phase_id === options.phaseId : true))
    .filter((task) => isCountable(task, { includeDemo: options.includeDemo === true }));
  const items = [];
  const add = (code, row) => {
    const meta = ATTENTION_CODES[code] || { label: code, severity: 'incomplete' };
    items.push({
      code,
      label: meta.label,
      severity: meta.severity,
      task_id: row.task?.id || '',
      task_ref: row.task?.task_ref || '',
      task_name: row.task?.name || '',
      villa: row.task?.location_id ? ix?.villaCode(row.task.location_id) || '' : 'Site-wide',
      discipline: row.task?.discipline || '',
      detail: row.detail,
      link: row.task?.id ? `/tasks/${row.task.id}` : '',
      readiness: row.readiness || '',
      since: toDay(row.task?.updated_date || row.task?.created_date),
    });
  };

  const lastReport = (task) => ix?.lastReportAt(task.id) || task.latest_report_date || task.updated_date || '';
  const roomfulVillas = new Set((areas || []).map((area) => area.location_id));

  const seen = new Map();
  scope.forEach((task) => {
    if (!isOutstanding(task) || task.is_villa_work_parent === true) return;
    const life = lifecycleOf(task);
    const readiness = readinessOf(task, { dependencies, tasksById });

    if (!task.location_id) {
      // Site-wide work is legitimate; only work that says it is for a villa
      // without naming one is a real gap.
      if (task.scope_type && task.scope_type !== 'Site-wide') add('unassigned_location', { task, detail: 'Scope says villa work, but no villa is recorded.', readiness: readiness.state });
    } else {
      const hasScope = (task.area_ids || []).length > 0 || !!task.floor_id || task.scope_type === 'Entire Villa';
      if (!hasScope) add('scope_unclear', { task, detail: 'No floor, room or whole-villa scope is recorded.', readiness: readiness.state });
    }

    if (!task.contractor_id) add('no_contractor', { task, detail: 'The register does not name a contractor for this work.', readiness: readiness.state });
    if (!task.responsible_engineer) add('no_coordinator', { task, detail: 'No DVG engineer or coordinator is recorded.', readiness: readiness.state });
    if (!toDay(task.baseline_finish) && !toDay(task.current_forecast_finish)) {
      add('no_dates', { task, detail: 'Neither a baseline nor a forecast finish date is recorded.', readiness: readiness.state });
    }
    if (typeof task.progress_percent !== 'number') add('progress_unknown', { task, detail: 'Progress has not been measured; leave it blank until it is.', readiness: readiness.state });
    if (isAwaitingVerification(task)) {
      add('unverified_complete', { task, detail: `${life.executed_by || 'Site team'} reported the work executed; verification is pending.`, readiness: readiness.state });
    }
    const settings = ix?.settings ? ix.settings(task.project_id) : undefined;
    if (lastReport(task) && isStale(lastReport(task), asOf, settings)) {
      add('stale_update', {
        task,
        detail: `Last site update ${String(lastReport(task)).slice(0, 10)}; more than ${settings?.stale_days ?? 7} working days ago.`,
        readiness: readiness.state,
      });
    }
    if (readiness.reasons.some((reason) => reason.code === 'predecessor')) {
      add('incomplete_predecessor', { task, detail: readiness.reasons.find((reason) => reason.code === 'predecessor').label, readiness: readiness.state });
    }

    // The same wording in two different rooms is two pieces of work, so the room
    // (or floor, or the words the source used for a room not yet registered) is part of the key.
    const rooms = [...(task.area_ids || [])].filter(Boolean).sort().join('+');
    const knownPlace = rooms ? `rooms:${rooms}` : task.floor_id ? `floor:${task.floor_id}` : looseKey(task.source_location_text || task.area_label || '');
    // No room, floor or room wording at all: the rows cannot be judged. Rows that
    // carry their own distinct source reference are different work; the rest are
    // reported as missing a room, not as an invalid duplicate.
    const place = knownPlace || 'whole';
    const sourceRef = looseKey(task.source_reference || '');
    const key = `${task.location_id || 'site'}|${looseKey(task.discipline)}|${place}|${normalizeAreaName(task.name)}${knownPlace ? '' : `|${sourceRef}`}`;
    if (normalizeAreaName(task.name) && task.discipline) {
      if (seen.has(key)) {
        const first = seen.get(key);
        const code = knownPlace ? 'possible_duplicate' : 'same_wording_no_room';
        const detail = knownPlace
          ? (other) => `Same villa, room, discipline and wording as ${other || 'another task'} — decide whether these are one piece of work.`
          : (other) => `Same wording as ${other || 'another task'} on this villa and no room is recorded, so they cannot be told apart. Record the room on each.`;
        add(code, { task, detail: detail(first.task_ref), readiness: readiness.state });
        if (!first.flagged) {
          add(code, { task: first, detail: detail(task.task_ref) });
          first.flagged = true;
        }
      } else {
        seen.set(key, task);
      }
    }
  });

  // Villa-level register gaps: outstanding work on a villa whose rooms are not
  // registered yet, so room-level tracking cannot start there.
  const villasWithWork = new Set(
    scope.filter((task) => isOutstanding(task) && task.location_id && !task.is_villa_work_parent).map((task) => task.location_id),
  );
  villasWithWork.forEach((locationId) => {
    if (roomfulVillas.has(locationId)) return;
    const villa = (locations || []).find((item) => item.id === locationId);
    if (!villa) return;
    items.push({
      code: 'room_register_missing',
      label: ATTENTION_CODES.room_register_missing.label,
      severity: 'incomplete',
      task_id: '',
      task_ref: '',
      task_name: '',
      villa: villa.villa_code,
      discipline: '',
      detail: `${villa.villa_code} has outstanding work but no floors or rooms registered, so room-level scope cannot be stated yet.`,
      link: `/locations/${villa.id}`,
      readiness: '',
    });
  });

  // The register says the works are finished while tasks are still open — one of the two is wrong.
  villasWithWork.forEach((locationId) => {
    const villa = (locations || []).find((item) => item.id === locationId);
    if (!villa || villa.works_stage !== 'Completed') return;
    const openHere = scope.filter((task) => isOutstanding(task) && task.location_id === locationId && !task.is_villa_work_parent).length;
    items.push({
      code: 'completed_with_open_work',
      label: ATTENTION_CODES.completed_with_open_work.label,
      severity: 'invalid',
      task_id: '',
      task_ref: '',
      task_name: '',
      villa: villa.villa_code,
      discipline: '',
      detail: `${villa.villa_code} is marked Works Completed but ${openHere} task(s) are still open. Either close the work or correct the villa's works stage.`,
      link: `/locations/${villa.id}`,
      readiness: '',
      since: toDay(villa.updated_date),
    });
  });

  // Ambiguous references inside the register itself: two villas of one phase
  // answering to the same plot number. Plot 14 is the live example, where the
  // suffix decides — so the register asks instead of choosing.
  const byPhase = new Map();
  (locations || []).forEach((location) => {
    const key = location.phase_id || 'none';
    byPhase.set(key, [...(byPhase.get(key) || []), location]);
  });
  byPhase.forEach((list, phaseKey) => {
    const plotMap = new Map();
    list.forEach((location) => {
      plotNumbersOf(location).forEach((number) => {
        plotMap.set(number, [...(plotMap.get(number) || []), location]);
      });
    });
    plotMap.forEach((holders, number) => {
      if (holders.length < 2) return;
      items.push({
        code: 'ambiguous_reference',
        label: ATTENTION_CODES.ambiguous_reference.label,
        severity: 'invalid',
        task_id: '',
        task_ref: '',
        task_name: '',
        villa: holders.map((holder) => holder.villa_code).join(' / '),
        discipline: '',
        detail: `Plot ${number} is carried by ${holders.length} villas${phaseKey === 'none' ? '' : ' in the same phase'} (${holders.map((holder) => holder.villa_code).join(', ')}). A reference to it must state the suffix.`,
        link: `/locations/${holders[0].id}`,
        readiness: '',
      });
    });
  });

  // Dismissed with a reason (or snoozed to a date not yet reached): kept out of the list, counted apart.
  const kept = items.filter((item) => !isDismissed(item, dismissals, asOf));
  const dismissedCount = items.length - kept.length;
  items.length = 0;
  items.push(...kept);

  // Most serious first, then by kind, then oldest first inside each kind.
  items.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || a.code.localeCompare(b.code)
    || String(a.since || '9999').localeCompare(String(b.since || '9999'))
    || String(a.villa).localeCompare(String(b.villa))
    || String(a.task_ref).localeCompare(String(b.task_ref)));

  const byCode = [...items.reduce((map, item) => {
    const current = map.get(item.code) || { code: item.code, label: item.label, severity: item.severity, count: 0 };
    current.count += 1;
    map.set(item.code, current);
    return map;
  }, new Map()).values()].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count);

  const readiness = { Ready: 0, Waiting: 0, Unknown: 0 };
  const readinessReasons = new Map();
  scope.forEach((task) => {
    if (!isOutstanding(task) || task.is_villa_work_parent === true) return;
    const state = readinessOf(task, { dependencies, tasksById });
    if (!state.state) return;
    readiness[state.state] += 1;
    state.reasons.forEach((reason) => {
      const current = readinessReasons.get(reason.code) || { code: reason.code, label: reason.label, count: 0 };
      current.count += 1;
      readinessReasons.set(reason.code, current);
    });
  });

  return {
    counts: {
      tasks_reviewed: scope.filter((task) => isOutstanding(task) && task.is_villa_work_parent !== true).length,
      invalid: items.filter((item) => item.severity === 'invalid').length,
      incomplete: items.filter((item) => item.severity === 'incomplete').length,
      total: items.length,
      dismissed: dismissedCount,
    },
    by_code: byCode,
    readiness,
    readiness_reasons: [...readinessReasons.values()].sort((a, b) => b.count - a.count),
    ...pageOf(items, options),
    data_date: asOf,
  };
}

/**
 * The list is filtered by issue code and paged on the server, so a code late in
 * the severity order is never cut off by a cap on the whole list, and each page
 * says how many there are in all.
 */
export function pageOf(items, options = {}) {
  const code = options.code || '';
  const filtered = code ? items.filter((item) => item.code === code) : items;
  const limit = Math.min(Math.max(Number(options.itemLimit) || 100, 10), 500);
  const offset = Math.max(Number(options.offset) || 0, 0);
  return {
    items: filtered.slice(offset, offset + limit),
    page: { code, offset, limit, total: filtered.length, has_more: offset + limit < filtered.length },
  };
}

/** The unassigned rows a CSV import left behind, shown in the same review view. */
export const importGaps = (tasks = []) =>
  (tasks || [])
    .filter((task) => task.import_source_file && !task.location_id && task.scope_type !== 'Site-wide')
    .map((task) => ({
      code: 'unassigned_location',
      label: ATTENTION_CODES.unassigned_location.label,
      severity: 'invalid',
      task_id: task.id,
      task_ref: task.task_ref || '',
      villa: 'Unassigned',
      detail: `Imported from ${task.import_source_file} row ${task.import_row_number || '?'} without a villa.`,
      link: `/tasks/${task.id}`,
    }));