/**
 * Dashboard views: executive portfolio, villa execution, contractor board and
 * planning. Each one returns display-ready rows with a stated data date and the
 * quality caveats that belong to the numbers, so a screen can never present an
 * unmeasured figure as a measured one.
 */

import {
  actionFor, compareFinish, dueWithin, finishDate,
  heldLocationIds, isAwaitingClosure, isCountable, isAwaitingVerification, isBlocked, isDemoTask,
  isExecuting, isOutstanding, isOverdue, isParentRow, isUnscheduled, scopeTasks,
  priorityScore, shiftDay, splitHeld, statusCounts, taskRow, weightedProgress,
} from './dashboardCore.ts';

const priorityRow = (task, ix, asOf) => {
  const row = taskRow(task, ix, asOf);
  return { ...row, action: actionFor(row), score: priorityScore(row) };
};

export function villaInventory(locations, tasks, heldIds, asOf, options = {}) {
  const inScope = locations.filter(
    (l) => (!options.projectId || l.project_id === options.projectId) && (!options.phaseId || l.phase_id === options.phaseId),
  );
  const villas = inScope.filter((l) => l.location_type === 'Villa');
  const common = inScope.filter((l) => l.location_type !== 'Villa');
  const openByVilla = new Map();
  tasks.filter(isOutstanding).forEach((task) => {
    if (!task.location_id) return;
    openByVilla.set(task.location_id, (openByVilla.get(task.location_id) || 0) + 1);
  });
  const handedOver = villas.filter((l) => l.possession_status === 'Handed Over');
  return {
    registered: villas.length,
    active: villas.filter((l) => l.active_status !== 'On Hold').length,
    on_hold: villas.filter((l) => l.active_status === 'On Hold').length,
    handed_over: handedOver.length,
    handed_over_open_works: handedOver.filter((l) => (openByVilla.get(l.id) || 0) > 0).length,
    works_complete: villas.filter((l) => (openByVilla.get(l.id) || 0) === 0 && l.works_stage === 'Completed').length,
    common_locations: common.length,
    measured: { as_of: asOf, held_excluded: heldIds.size },
  };
}

/** Stage A / 2 — Executive portfolio dashboard. */
export function executiveView({ tasks, locations, phases, projects, ix, options, asOf }) {
  const includeDemo = options.includeDemo === true;
  const heldIds = heldLocationIds(locations);
  const projectIds = new Set((projects || []).map((p) => p.id));
  const inScope = tasks.filter((t) => projectIds.has(t.project_id));
  const filtered = scopeTasks(inScope, { projectId: options.projectId, phaseId: options.phaseId, includeDemo });
  // Every row recorded in this exact scope, demo included, so an excluded count
  // is drawn from the same set the totals below are drawn from.
  const scopedAll = inScope.filter(
    (t) => t.archived !== true && !isParentRow(t)
      && (!options.projectId || t.project_id === options.projectId)
      && (!options.phaseId || t.phase_id === options.phaseId),
  );
  const { active, held } = splitHeld(filtered, heldIds);

  const villas = locations.filter(
    (l) => l.location_type === 'Villa' && (!options.projectId || l.project_id === options.projectId)
      && (!options.phaseId || l.phase_id === options.phaseId),
  );

  const counts = statusCounts(active, asOf);
  const metrics = {
    registered_villas: villas.length,
    active_villas: villas.filter((l) => l.active_status !== 'On Hold').length,
    on_hold_villas: villas.filter((l) => l.active_status === 'On Hold').length,
    handed_over_villas: villas.filter((l) => l.possession_status === 'Handed Over').length,
    handed_over_open_works: villas.filter(
      (l) => l.possession_status === 'Handed Over'
        && active.some((t) => t.location_id === l.id && isOutstanding(t)),
    ).length,
    open_tasks: counts.open,
    overdue_tasks: counts.overdue,
    blocked_tasks: counts.blocked,
    awaiting_verification: counts.awaitingVerification,
    awaiting_closure: counts.awaitingClosure,
    unscheduled_tasks: counts.unscheduled,
    due_within_7: active.filter((t) => dueWithin(t, asOf, 7)).length,
    due_within_14: active.filter((t) => dueWithin(t, asOf, 14)).length,
    site_wide_open: active.filter((t) => !t.location_id && isOutstanding(t)).length,
    held_open_tasks: statusCounts(held, asOf).open,
    held_overdue_tasks: statusCounts(held, asOf).overdue,
    held_blocked_tasks: statusCounts(held, asOf).blocked,
    villa_work_assignments: inScope.filter(isParentRow).length,
    villa_work_children: inScope.filter(isParentRow).reduce((sum, t) => sum + (Number(t.child_villa_count) || 0), 0),
    demo_tasks_excluded: includeDemo ? 0 : scopedAll.filter(isDemoTask).length,
    demo_view: includeDemo,
  };

  const priorities = active
    .map((task) => priorityRow(task, ix, asOf))
    .filter((row) => row.score > 0 || !row.finish)
    .sort((a, b) => b.score - a.score || compareFinish(a, b))
    .slice(0, options.itemLimit || 25)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const progress = weightedProgress(active);
  const warnings = [];
  if (metrics.demo_tasks_excluded > 0) {
    warnings.push(`${metrics.demo_tasks_excluded} demo task(s) are held out of these totals. Administrators can switch the demo view on.`);
  }
  if (metrics.held_open_tasks > 0) {
    warnings.push(`${metrics.held_open_tasks} open task(s) belong to villas on hold and are excluded from active execution figures.`);
  }
  if (counts.unscheduled > 0) {
    warnings.push(`${counts.unscheduled} outstanding task(s) have neither a baseline nor a forecast finish and cannot be scheduled.`);
  }
  if (!progress.reliable && progress.total > 0) warnings.push(progress.reason);

  return {
    as_of: asOf,
    scope: { project_id: options.projectId || '', phase_id: options.phaseId || '' },
    inventory: villaInventory(locations, active, heldIds, asOf, options),
    metrics,
    progress,
    priorities,
    warnings,
    counts_by_discipline: disciplineCounts(active, ix, asOf),
    counts_by_status: statusCounts(active, asOf),
    demo_available: scopedAll.some(isDemoTask),
  };
}

export function disciplineCounts(tasks, ix, asOf) {
  const groups = new Map();
  tasks.forEach((task) => {
    const code = task.discipline || 'UNSET';
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(task);
  });
  return [...groups.entries()]
    .map(([code, list]) => ({
      discipline: code,
      discipline_name: ix.disciplineName(code),
      ...statusCounts(list, asOf),
      progress: weightedProgress(list),
      contract_measure: `${(list.reduce((sum, t) => sum + Number(t.planned_quantity || 0), 0) || 0)}`,
    }))
    .sort((a, b) => b.open - a.open || a.discipline_name.localeCompare(b.discipline_name));
}

/** Stage A / 3 — Villa execution dashboard. */
export function villaExecutionView({ tasks, location, ix, asOf, snags = [], dependencies = [], options = {} }) {
  const mine = tasks.filter((t) => t.location_id === location.id && isCountable(t, { includeDemo: options.includeDemo === true }));
  const outstanding = mine.filter(isOutstanding);
  const groups = new Map();
  mine.forEach((task) => {
    const code = task.discipline || 'UNSET';
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(task);
  });
  const disciplines = [...groups.entries()]
    .map(([code, list]) => ({
      discipline: code,
      discipline_name: ix.disciplineName(code),
      tasks: list
        .slice()
        .sort((a, b) => compareFinish(taskRow(a, ix, asOf), taskRow(b, ix, asOf)))
        .map((task) => taskRow(task, ix, asOf)),
      counts: statusCounts(list, asOf),
      progress: weightedProgress(list),
    }))
    .sort((a, b) => b.counts.open - a.counts.open || a.discipline_name.localeCompare(b.discipline_name));

  const openSnags = snags.filter((s) => s.status !== 'Closed');
  const dependenciesFor = (taskId) => dependencies.filter((d) => d.predecessor_task_id === taskId || d.successor_task_id === taskId).length;
  const weekEnd = shiftDay(asOf, 7);

  return {
    as_of: asOf,
    villa: {
      id: location.id,
      code: location.villa_code,
      plot_numbers: location.plot_numbers || '',
      location_type: location.location_type,
      phase: ix.phaseName(location.phase_id),
      project: ix.projectName(location.project_id),
      project_id: location.project_id,
      possession_status: location.possession_status,
      possession_date: location.possession_date || '',
      works_stage: location.works_stage,
      active_status: location.active_status,
      assigned_engineer: location.assigned_engineer || '',
      planned_completion_date: location.planned_completion_date || '',
      notes: location.notes || '',
      on_hold: location.active_status === 'On Hold',
    },
    counts: statusCounts(mine, asOf),
    progress: weightedProgress(mine),
    disciplines,
    contractors: contractorMix(mine, ix, asOf),
    blockers: outstanding.filter(isBlocked).map((t) => taskRow(t, ix, asOf)),
    overdue: outstanding.filter((t) => isOverdue(t, asOf)).map((t) => taskRow(t, ix, asOf)),
    this_week: outstanding
      .filter((t) => dueWithin(t, asOf, 7) || (finishDate(t) && finishDate(t) <= weekEnd && isExecuting(t)))
      .map((t) => taskRow(t, ix, asOf))
      .sort(compareFinish),
    awaiting_verification: outstanding.filter(isAwaitingVerification).map((t) => taskRow(t, ix, asOf)),
    awaiting_closure: outstanding.filter(isAwaitingClosure).map((t) => taskRow(t, ix, asOf)),
    unscheduled: outstanding.filter(isUnscheduled).map((t) => taskRow(t, ix, asOf)),
    snags: {
      open: openSnags.filter((s) => s.status === 'Open').length,
      awaiting_reinspection: snags.filter((s) => s.status === 'Awaiting Reinspection').length,
      closed: snags.filter((s) => s.status === 'Closed').length,
      handover_blockers: openSnags.filter((s) => s.handover_blocker).length,
      rows: snags.slice(0, 50),
    },
    dependency_count: outstanding.reduce((sum, t) => sum + dependenciesFor(t.id), 0),
  };
}

export function contractorMix(tasks, ix, asOf) {
  const groups = new Map();
  tasks.forEach((task) => {
    const key = task.contractor_id || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  });
  return [...groups.entries()]
    .map(([id, list]) => ({
      contractor_id: id === 'unassigned' ? '' : id,
      contractor: id === 'unassigned' ? 'Unassigned' : ix.contractorName(id),
      ...statusCounts(list, asOf),
      progress: weightedProgress(list),
    }))
    .sort((a, b) => b.open - a.open);
}

/** Stage A / 4 — Contractor dashboard. */
export function contractorBoardView({ tasks, contractors, ix, options, asOf, updates = [] }) {
  const heldIds = heldLocationIds(options.locations || []);
  const { active: scoped, held: heldScoped } = splitHeld(
    scopeTasks(tasks, {
      projectId: options.projectId, phaseId: options.phaseId, locationId: options.locationId,
      discipline: options.discipline, includeDemo: options.includeDemo,
    }),
    heldIds,
  );

  const staleBefore = shiftDay(asOf, -7);
  const weekAgo = shiftDay(asOf, -7);
  const rows = contractors
    .filter((c) => c.active !== false || scoped.some((t) => t.contractor_id === c.id))
    .map((contractor) => {
      const mine = scoped.filter((t) => t.contractor_id === contractor.id);
      const open = mine.filter(isOutstanding);
      const reports = updates.filter((u) => mine.some((t) => t.id === u.task_id));
      const recent = reports.filter((u) => String(u.reported_at || '').slice(0, 10) >= weekAgo);
      const latest = reports
        .slice()
        .sort((a, b) => String(b.reported_at).localeCompare(String(a.reported_at)))[0] || null;
      const stale = open.filter((t) => {
        const last = ix.lastReportAt(t.id) || t.updated_date || '';
        return !last || String(last).slice(0, 10) < staleBefore;
      });
      const crossContractor = open.filter(
        (t) => t.blocker_responsible_party
          && t.blocker_responsible_party.toLowerCase() !== String(contractor.name || '').toLowerCase(),
      );
      return {
        contractor_id: contractor.id,
        contractor: contractor.name,
        trade: contractor.trade || '',
        classification: contractor.classification || '',
        assigned: mine.length,
        open: open.length,
        overdue: open.filter((t) => isOverdue(t, asOf)).length,
        blocked: open.filter(isBlocked).length,
        due_this_week: open.filter((t) => dueWithin(t, asOf, 7)).length,
        awaiting_approval: mine.filter(isAwaitingVerification).length,
        unscheduled: open.filter(isUnscheduled).length,
        progress: weightedProgress(mine),
        latest_report: latest ? { at: latest.reported_at, by: latest.reported_by_name, text: latest.work_done || latest.latest_update || '', progress: latest.progress_percent ?? null } : null,
        manpower_7d: recent.reduce((sum, u) => sum + (Number(u.manpower_total) || 0), 0),
        manpower_basis: 'Sum of reported daily manpower across all tasks — one worker reported on several tasks is counted on each task, so this is not a headcount.',
        reports_7d: recent.length,
        stale_tasks: stale.length,
        needs_intervention: crossContractor.map((t) => taskRow(t, ix, asOf)),
        villas: [...new Set(open.map((t) => ix.villaCode(t.location_id) || 'Site-wide'))].filter(Boolean),
        on_hold_tasks: heldScoped.filter((t) => t.contractor_id === contractor.id && isOutstanding(t)).length,
        tasks: open.slice().sort((a, b) => compareFinish(taskRow(a, ix, asOf), taskRow(b, ix, asOf))).map((t) => taskRow(t, ix, asOf)),
      };
    })
    .sort((a, b) => b.open - a.open || a.contractor.localeCompare(b.contractor));

  return {
    as_of: asOf,
    rows,
    totals: {
      contractors: rows.length,
      open: rows.reduce((sum, r) => sum + r.open, 0),
      overdue: rows.reduce((sum, r) => sum + r.overdue, 0),
      blocked: rows.reduce((sum, r) => sum + r.blocked, 0),
      due_this_week: rows.reduce((sum, r) => sum + r.due_this_week, 0),
      awaiting_approval: rows.reduce((sum, r) => sum + r.awaiting_approval, 0),
      stale_tasks: rows.reduce((sum, r) => sum + r.stale_tasks, 0),
      unassigned: scoped.filter((t) => !t.contractor_id && isOutstanding(t)).length,
    },
    warnings: [
      'Manpower is a sum of reported task-level manpower, not a count of unique people.',
      scoped.some((t) => !t.contractor_id && isOutstanding(t))
        ? `${scoped.filter((t) => !t.contractor_id && isOutstanding(t)).length} outstanding task(s) have no contractor assigned.`
        : '',
    ].filter(Boolean),
  };
}

export const PLANNING_BUCKETS = ['overdue', 'verification', 'today', 'tomorrow', 'week_7', 'week_14', 'later', 'unscheduled'];

/**
 * Every outstanding row falls into exactly one bucket, so the buckets always add
 * up to the open count. Work already executed is "verification" whatever its
 * date: it waits on an inspector, not on a crew.
 */
export function planningBucketOf(row, asOf) {
  if (['Execution Complete', 'Under Inspection', 'Approved'].includes(row.status)) return 'verification';
  if (row.overdue_days > 0) return 'overdue';
  if (!row.finish) return 'unscheduled';
  if (row.finish === asOf) return 'today';
  if (row.finish === shiftDay(asOf, 1)) return 'tomorrow';
  if (row.finish <= shiftDay(asOf, 7)) return 'week_7';
  if (row.finish <= shiftDay(asOf, 14)) return 'week_14';
  return 'later';
}

/** Stage A / 5 — Daily and weekly planning. */
export function planningView({ tasks, ix, options, asOf }) {
  const heldIds = heldLocationIds(options.locations || []);
  const { active, held } = splitHeld(
    scopeTasks(tasks, {
      projectId: options.projectId, phaseId: options.phaseId, contractorId: options.contractorId,
      discipline: options.discipline, locationId: options.locationId, includeDemo: options.includeDemo,
    }),
    heldIds,
  );

  const outstanding = active.filter(isOutstanding);
  const rows = outstanding.map((t) => taskRow(t, ix, asOf));
  const buckets = Object.fromEntries(PLANNING_BUCKETS.map((name) => [name, []]));
  rows.forEach((row) => buckets[planningBucketOf(row, asOf)].push(row));
  PLANNING_BUCKETS.forEach((name) => buckets[name].sort(compareFinish));
  const counts = Object.fromEntries(PLANNING_BUCKETS.map((name) => [name, buckets[name].length]));
  const heldOpen = held.filter(isOutstanding).length;

  return {
    as_of: asOf,
    held_work_excluded: heldOpen,
    buckets,
    counts: { ...counts, open: rows.length, executing: outstanding.filter(isExecuting).length },
    warnings: [
      counts.unscheduled ? `${counts.unscheduled} outstanding task(s) have no reliable date and appear under Unscheduled.` : '',
      heldOpen ? `${heldOpen} task(s) belong to villas on hold and are excluded from the look-ahead.` : '',
    ].filter(Boolean),
  };
}
