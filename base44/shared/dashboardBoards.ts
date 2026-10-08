/**
 * Board views: blockers and dependency chains, contractor meeting reports,
 * handover and snagging, and common (site-wide) works.
 *
 * Nothing here invents a relationship. A dependency chain is drawn only from
 * TaskDependency records that actually exist and that the signed-in user is
 * allowed to see; where those records are missing the screen says so instead of
 * guessing at a critical path.
 */

import {
  compareFinish, daysBetween, dueWithin, isAwaitingClosure, isAwaitingVerification,
  isBlocked, isDemoTask, isExecuting, isOutstanding, isOverdue, isParentRow,
  isUnscheduled, shiftDay, statusCounts, taskRow, weightedProgress,
} from './dashboardCore.ts';

const scopeBoardTasks = (tasks, options) =>
  tasks.filter((t) => {
    if (t.archived === true || isParentRow(t)) return false;
    if (!options.includeDemo && isDemoTask(t)) return false;
    if (options.projectId && t.project_id !== options.projectId) return false;
    if (options.phaseId && t.phase_id !== options.phaseId) return false;
    return true;
  });

const chainNode = (task, ix, asOf) => {
  const row = taskRow(task, ix, asOf);
  return {
    id: row.id,
    ref: row.ref,
    name: row.name,
    villa: row.villa,
    discipline: row.discipline,
    discipline_name: row.discipline_name,
    contractor: row.contractor,
    status: row.status,
    finish: row.finish,
  };
};

/** Follow recorded successor links forward from one task. */
function walkChain(startId, successors, byId, ix, asOf, limit, depth = 0, seen = new Set()) {
  if (depth >= limit) return [];
  const out = [];
  (successors.get(startId) || []).forEach((nextId) => {
    if (seen.has(nextId)) return;
    seen.add(nextId);
    const task = byId.get(nextId);
    if (!task) return;
    out.push(chainNode(task, ix, asOf));
    out.push(...walkChain(nextId, successors, byId, ix, asOf, limit, depth + 1, seen));
  });
  return out;
}

/** Stage A / 6 — Blockers and dependency chains. */
export function blockerBoardView({ tasks, dependencies = [], ix, options, asOf, heldIds }) {
  const scoped = scopeBoardTasks(tasks, options).filter(
    (t) => !t.location_id || !heldIds.has(t.location_id),
  );
  const byId = new Map(scoped.map((t) => [t.id, t]));
  const successors = new Map();
  const predecessors = new Map();
  dependencies.forEach((dep) => {
    if (!dep || dep.active === false) return;
    successors.set(dep.predecessor_task_id, [...(successors.get(dep.predecessor_task_id) || []), dep.successor_task_id]);
    predecessors.set(dep.successor_task_id, [...(predecessors.get(dep.successor_task_id) || []), dep.predecessor_task_id]);
  });

  const outstanding = scoped.filter(isOutstanding);
  const rows = outstanding
    .filter((t) => isBlocked(t) || t.blocker_description)
    .map((task) => {
      const row = taskRow(task, ix, asOf);
      const latest = ix.latestReportFor(task.id);
      const chain = walkChain(task.id, successors, byId, ix, asOf, 6);
      const resolution = latest?.expected_resolution_date || '';
      return {
        ...row,
        identified: row.blocked_since,
        days_blocked: row.blocked_since ? daysBetween(row.blocked_since, asOf) : null,
        expected_resolution_date: resolution,
        resolution_overdue: !!resolution && resolution < asOf,
        downstream_count: chain.length,
        downstream: chain,
        dependencies_recorded: (predecessors.get(task.id) || []).length,
      };
    })
    .sort((a, b) => (b.days_blocked || 0) - (a.days_blocked || 0) || compareFinish(a, b));

  const chains = rows
    .filter((row) => row.downstream.length)
    .map((row) => ({
      root: { ref: row.ref, name: row.name, villa: row.villa, discipline_name: row.discipline_name, status: row.status, finish: row.finish },
      nodes: row.downstream,
    }));

  const recordedEdges = dependencies.filter(
    (dep) => dep && dep.active !== false && byId.has(dep.predecessor_task_id) && byId.has(dep.successor_task_id),
  );
  const otherContractorBlockers = rows.filter(
    (row) => row.blocker_responsible
      && row.blocker_responsible.toLowerCase() !== String(row.contractor || '').toLowerCase(),
  );

  const warnings = [];
  if (!recordedEdges.length) {
    warnings.push('No task dependencies are recorded for this scope, so scheduling impact and any critical path cannot be determined.');
  } else {
    warnings.push(`${recordedEdges.length} recorded dependency link(s) are shown. Impact is stated only where a link exists.`);
  }
  if (outstanding.some((t) => isUnscheduled(t))) {
    warnings.push(`${outstanding.filter((t) => isUnscheduled(t)).length} outstanding task(s) have no dates, so their scheduling effect cannot be judged.`);
  }
  const invisible = rows.reduce((sum, row) => sum + row.downstream.filter((n) => !byId.has(n.id)).length, 0);
  if (invisible) warnings.push('Some dependent tasks are outside your project access and are not listed.');

  return {
    as_of: asOf,
    rows,
    chains,
    counts: {
      blocked: rows.filter((r) => r.status === 'Blocked').length,
      with_blocker_recorded: rows.length,
      blocked_by_another_party: otherContractorBlockers.length,
      overdue_and_blocked: rows.filter((r) => r.overdue_days > 0).length,
      resolution_overdue: rows.filter((r) => r.resolution_overdue).length,
      dependency_links: recordedEdges.length,
      tasks_with_downstream: rows.filter((r) => r.downstream_count > 0).length,
    },
    by_category: [...new Set(rows.map((r) => r.blocker_category).filter(Boolean))].map((category) => ({
      category,
      count: rows.filter((r) => r.blocker_category === category).length,
    })).sort((a, b) => b.count - a.count),
    warnings,
  };
}

export function resolveChain(startRef, dependencies, tasks, ix, asOf) {
  const byRef = new Map(tasks.map((t) => [t.task_ref, t]));
  const start = byRef.get(startRef);
  if (!start) return [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const successors = new Map();
  dependencies.forEach((dep) => {
    successors.set(dep.predecessor_task_id, [...(successors.get(dep.predecessor_task_id) || []), dep.successor_task_id]);
  });
  return [chainNode(start, ix, asOf), ...walkChain(start.id, successors, byId, ix, asOf, 6)].filter(Boolean);
}

/** Stage A / 7 — Contractor meeting report. */
export function meetingReportView({ tasks, commitments = [], dependencies = [], ix, options, asOf }) {
  const scoped = scopeBoardTasks(tasks, options).filter(
    (t) => !options.contractorId || t.contractor_id === options.contractorId,
  );
  const outstanding = scoped.filter(isOutstanding);
  const meetingDate = options.meetingDate || asOf;
  const byId = new Map(scoped.map((t) => [t.id, t]));
  const predecessors = new Map();
  dependencies.forEach((dep) => {
    if (!dep || dep.active === false) return;
    predecessors.set(dep.successor_task_id, [...(predecessors.get(dep.successor_task_id) || []), dep.predecessor_task_id]);
  });

  const rows = outstanding
    .slice()
    .sort((a, b) => compareFinish(taskRow(a, ix, asOf), taskRow(b, ix, asOf)))
    .map((t) => taskRow(t, ix, asOf));

  const villaGroups = new Map();
  rows.forEach((row) => {
    const key = row.location_id || 'site-wide';
    if (!villaGroups.has(key)) {
      villaGroups.set(key, { location_id: row.location_id, villa: row.villa, scope: row.scope, rows: [] });
    }
    villaGroups.get(key).rows.push(row);
  });

  const dependenciesOnOthers = rows
    .filter((row) => row.blocker_responsible && row.blocker_responsible.toLowerCase() !== ix.contractorName(options.contractorId).toLowerCase())
    .map((row) => ({
      ...row,
      dependency_type: 'Blocker owned by another party',
      dependent_on: row.blocker_responsible,
    }))
    .concat(
      rows.flatMap((row) => (predecessors.get(row.id) || [])
        .map((predId) => byId.get(predId))
        .filter((pred) => pred && pred.contractor_id !== options.contractorId && isOutstanding(pred))
        .map((pred) => ({
          ...row,
          dependency_type: 'Waits on an earlier task',
          dependent_on: ix.contractorName(pred.contractor_id) || 'Unassigned',
          dependent_on_ref: pred.task_ref,
        }))),
    );

  const commitmentsForScope = commitments
    .filter((c) => !options.projectId || c.project_id === options.projectId)
    .filter((c) => !options.phaseId || c.phase_id === options.phaseId)
    .filter((c) => !options.contractorId || c.contractor_id === options.contractorId)
    .sort((a, b) => String(b.meeting_date).localeCompare(String(a.meeting_date)));

  const openCommitments = commitmentsForScope.filter((c) => c.status === 'Open');
  const unresolved = openCommitments.filter((c) => c.promised_date && c.promised_date < meetingDate);

  return {
    as_of: asOf,
    meeting_date: meetingDate,
    scope: {
      project_id: options.projectId || '',
      phase_id: options.phaseId || '',
      contractor_id: options.contractorId || '',
      contractor: ix.contractorName(options.contractorId),
      project: ix.projectName(options.projectId),
    },
    counts: {
      outstanding: rows.length,
      overdue: rows.filter((r) => r.overdue_days > 0).length,
      due_7: rows.filter((r) => r.due_in_days !== null && r.due_in_days <= 7).length,
      blocked: rows.filter((r) => r.status === 'Blocked' || r.blocker).length,
      awaiting_verification: rows.filter((r) => r.status === 'Execution Complete' || r.status === 'Under Inspection').length,
      awaiting_closure: rows.filter((r) => r.status === 'Approved').length,
      dependencies_on_others: dependenciesOnOthers.length,
      pending_decisions: rows.filter((r) => r.decisions.length).length,
      open_commitments: openCommitments.length,
      unresolved_commitments: unresolved.length,
      villas: villaGroups.size,
    },
    by_villa: [...villaGroups.values()].sort((a, b) => b.rows.length - a.rows.length),
    overdue: rows.filter((r) => r.overdue_days > 0),
    due_7: rows.filter((r) => r.due_in_days !== null && r.due_in_days <= 7),
    blockers: rows.filter((r) => r.status === 'Blocked' || r.blocker),
    dependencies_on_others: dependenciesOnOthers,
    pending_decisions: rows.filter((r) => r.decisions.length),
    commitments: commitmentsForScope.slice(0, 100),
    unresolved_commitments: unresolved,
    warnings: [
      'Only recorded dependencies are shown; where none are recorded the meeting report does not claim an impact.',
      rows.some((r) => !r.finish) ? `${rows.filter((r) => !r.finish).length} outstanding task(s) in this scope have no dates.` : '',
    ].filter(Boolean),
  };
}

/** Stage A / 8 — Handover and snagging. */
export function handoverBoardView({ tasks, locations, snags = [], ix, asOf, options }) {
  const villas = locations.filter(
    (l) => l.location_type === 'Villa'
      && (!options.projectId || l.project_id === options.projectId)
      && (!options.phaseId || l.phase_id === options.phaseId),
  );
  const scoped = scopeBoardTasks(tasks, options);
  const heldIds = new Set(locations.filter((l) => l.active_status === 'On Hold').map((l) => l.id));

  const rows = villas.map((villa) => {
    const mine = scoped.filter((t) => t.location_id === villa.id);
    const outstanding = mine.filter(isOutstanding);
    const villaSnags = snags.filter((s) => s.location_id === villa.id);
    const openSnags = villaSnags.filter((s) => s.status !== 'Closed');
    const latest = mine
      .map((t) => ({ task: t, report: ix.latestReportFor(t.id) }))
      .filter((x) => x.report)
      .sort((a, b) => String(b.report.reported_at).localeCompare(String(a.report.reported_at)))[0] || null;
    const decisions = [...new Set(outstanding.map((t) => taskRow(t, ix, asOf)).flatMap((r) => r.decisions))];
    const handedOver = villa.possession_status === 'Handed Over';
    const stage = !handedOver && !outstanding.length && !openSnags.length && villa.works_stage === 'Completed'
      ? 'Ready for handover'
      : handedOver && (outstanding.length || openSnags.length)
        ? 'Handed over — works or snags outstanding'
        : handedOver
          ? 'Handed over — works complete'
          : outstanding.length
            ? 'Works in progress — possession not handed over'
            : 'No open works — possession not handed over';

    return {
      location_id: villa.id,
      villa: villa.villa_code,
      plot_numbers: villa.plot_numbers || '',
      phase: ix.phaseName(villa.phase_id),
      possession_status: villa.possession_status,
      possession_date: villa.possession_date || '',
      works_stage: villa.works_stage,
      on_hold: villa.active_status === 'On Hold',
      assigned_engineer: villa.assigned_engineer || '',
      outstanding: outstanding.length,
      overdue: outstanding.filter((t) => isOverdue(t, asOf)).length,
      awaiting_verification: outstanding.filter(isAwaitingVerification).length,
      awaiting_closure: outstanding.filter(isAwaitingClosure).length,
      unscheduled: outstanding.filter(isUnscheduled).length,
      open_snags: openSnags.filter((s) => s.status === 'Open').length,
      snags_awaiting_reinspection: villaSnags.filter((s) => s.status === 'Awaiting Reinspection').length,
      snags_blocking_handover: openSnags.filter((s) => s.handover_blocker).length,
      decisions,
      handover_stage: stage,
      needs_attention: (handedOver && (outstanding.length > 0 || openSnags.length > 0)) || openSnags.some((s) => s.handover_blocker),
      last_report_at: latest?.report?.reported_at || '',
      photos: (latest?.report?.photo_uris || []).slice(0, 3),
      progress: weightedProgress(mine),
      counts: statusCounts(mine, asOf),
    };
  }).sort((a, b) => Number(b.needs_attention) - Number(a.needs_attention) || b.outstanding - a.outstanding || a.villa.localeCompare(b.villa));

  const openSnagsAll = snags.filter((s) => s.status !== 'Closed');
  return {
    as_of: asOf,
    rows,
    snags: snags
      .filter((s) => s.status !== 'Closed' || String(s.closed_date || '') >= shiftDay(asOf, -60))
      .slice()
      .sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(b.raised_date).localeCompare(String(a.raised_date)))
      .slice(0, 200),
    summary: {
      villas: rows.length,
      handed_over: rows.filter((r) => r.possession_status === 'Handed Over').length,
      handed_over_with_open_works: rows.filter((r) => r.possession_status === 'Handed Over' && r.outstanding > 0).length,
      handed_over_with_open_snags: rows.filter((r) => r.possession_status === 'Handed Over' && (r.open_snags + r.snags_awaiting_reinspection) > 0).length,
      ready_for_handover: rows.filter((r) => r.handover_stage === 'Ready for handover').length,
      works_complete_possession_pending: rows.filter((r) => !r.possession_status.includes('Handed') && r.outstanding === 0).length,
      open_snags: openSnagsAll.filter((s) => s.status === 'Open').length,
      snags_awaiting_reinspection: snags.filter((s) => s.status === 'Awaiting Reinspection').length,
      snags_blocking_handover: openSnagsAll.filter((s) => s.handover_blocker).length,
      on_hold: rows.filter((r) => r.on_hold).length,
    },
    warnings: [
      'Possession is tracked independently of works: a handed-over villa keeps every open work and snag on this list.',
      'Snags are separate records from tasks — closing a snag never changes a task status by itself.',
      heldIds.size ? `${[...heldIds].length} villa(s) are on hold; their works stay visible here.` : '',
    ].filter(Boolean),
  };
}

/** Stage A / 9 — Common infrastructure and site-wide works. */
export function siteWideView({ tasks, locations, ix, options, asOf }) {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const scoped = tasks.filter((t) => {
    if (t.archived === true || isParentRow(t)) return false;
    if (!options.includeDemo && isDemoTask(t)) return false;
    if (options.projectId && t.project_id !== options.projectId) return false;
    if (options.phaseId && t.phase_id !== options.phaseId) return false;
    const villa = t.location_id ? byId.get(t.location_id) : null;
    if (t.location_id && villa?.location_type === 'Villa') return false;
    return true;
  });

  const outstanding = scoped.filter(isOutstanding);
  const groups = new Map();
  outstanding.forEach((task) => {
    const code = task.discipline || 'UNSET';
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(task);
  });

  return {
    as_of: asOf,
    rows: outstanding
      .slice()
      .sort((a, b) => compareFinish(taskRow(a, ix, asOf), taskRow(b, ix, asOf)))
      .slice(0, 300)
      .map((t) => taskRow(t, ix, asOf)),
    groups: [...groups.entries()]
      .map(([code, list]) => ({
        discipline: code,
        discipline_name: ix.disciplineName(code),
        counts: statusCounts(list, asOf),
        overdue: list.filter((t) => isOverdue(t, asOf)).length,
        blocked: list.filter(isBlocked).length,
        awaiting_verification: list.filter(isAwaitingVerification).length,
        progress: weightedProgress(list),
        areas: [...new Set(list.map((t) => byId.get(t.location_id)?.villa_code || 'Unassigned area'))],
      }))
      .sort((a, b) => b.counts.open - a.counts.open),
    counts: {
      open: outstanding.length,
      overdue: outstanding.filter((t) => isOverdue(t, asOf)).length,
      blocked: outstanding.filter(isBlocked).length,
      awaiting_verification: outstanding.filter(isAwaitingVerification).length,
      due_7: outstanding.filter((t) => dueWithin(t, asOf, 7)).length,
      unscheduled: outstanding.filter(isUnscheduled).length,
      unassigned_area: outstanding.filter((t) => !t.location_id).length,
    },
    areas: [...new Set(outstanding.map((t) => byId.get(t.location_id)?.villa_code || 'No area recorded'))].sort(),
    warnings: [
      'Site-wide work is reported separately from villa work and contributes to project-level totals.',
      outstanding.some((t) => !t.location_id)
        ? `${outstanding.filter((t) => !t.location_id).length} site-wide task(s) have no common area recorded.`
        : '',
    ].filter(Boolean),
  };
}

export const boardHelpers = { isExecuting, heldLocationIdsOf: (locations) => new Set(locations.filter((l) => l.active_status === 'On Hold').map((l) => l.id)) };