/**
 * The two views built around a villa: the villa x discipline matrix (D-02) and the
 * pending-works statement for owner and handover conversations (D-08). Both are
 * pure functions over loadProjectData, share the one exclusion filter and the one
 * meaning of blocked, overdue and open, and never invent a date or a percentage.
 */
import {
  daysBetween, finishDate, heldLocationIds, isAwaitingClosure, isAwaitingVerification, isBlocked, isCountable,
  isOutstanding, isOverdue, isStale, isUnscheduled, measuredProgress, shiftDay, statusCounts, taskRow, toDay, weightedProgress,
} from './dashboardCore.ts';

/* ------------------------------------------------------------------ forecast */

/**
 * When a villa's pending works are expected to be complete: the latest forecast
 * (or baseline) finish among its open tasks. Labelled differently once the villa
 * is handed over. Never guessed — undated tasks are counted instead.
 */
export function villaForecast(location, openTasks) {
  const dated = openTasks.map(finishDate).filter(Boolean).sort();
  const undated = openTasks.filter((t) => isUnscheduled(t)).length;
  const handedOver = location?.possession_status === 'Handed Over';
  const date = dated.length ? dated[dated.length - 1] : '';
  const planned = toDay(location?.planned_completion_date);
  return {
    date,
    label: handedOver ? 'Pending works complete by' : 'Forecast handover',
    undated,
    state: !openTasks.length ? 'complete' : date ? (undated ? 'partly_scheduled' : 'scheduled') : 'not_scheduled',
    slip_days: date && planned ? daysBetween(planned, date) : null,
    planned,
  };
}

/* -------------------------------------------------------------------- matrix */

const cellCategory = (open, blocked, tasks) => {
  if (!tasks.length) return '';
  if (blocked) return 'Stuck';
  if (!open.length) return 'Done';
  if (open.every((t) => isAwaitingVerification(t) || isAwaitingClosure(t))) return 'Verify';
  if (open.some((t) => t.status === 'In Progress')) return 'Active';
  return 'To do';
};

export function villaMatrixView({ tasks = [], locations = [], ix, asOf, options = {} }) {
  const heldIds = heldLocationIds(locations);
  const scoped = tasks.filter((t) => isCountable(t, { includeDemo: options.includeDemo === true })
    && t.location_id
    && (!options.projectId || t.project_id === options.projectId)
    && (!options.phaseId || t.phase_id === options.phaseId)
    && (!options.contractorId || t.contractor_id === options.contractorId));

  const villas = locations
    .filter((l) => l.location_type === 'Villa'
      && (!options.projectId || l.project_id === options.projectId)
      && (!options.phaseId || l.phase_id === options.phaseId)
      && (!options.possession || l.possession_status === options.possession));

  const byVilla = new Map();
  scoped.forEach((t) => byVilla.set(t.location_id, [...(byVilla.get(t.location_id) || []), t]));

  const codes = [...new Set(scoped.map((t) => t.discipline || 'UNSET'))];
  const disciplines = codes
    .map((code) => ({ code, name: ix.disciplineName(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = villas
    .map((villa) => {
      const mine = byVilla.get(villa.id) || [];
      const open = mine.filter(isOutstanding);
      const forecast = villaForecast(villa, open);
      const cells = Object.fromEntries(disciplines.map(({ code }) => {
        const inCell = mine.filter((t) => (t.discipline || 'UNSET') === code);
        const openIn = inCell.filter(isOutstanding);
        const blocked = openIn.filter(isBlocked).length;
        const progress = weightedProgress(inCell);
        return [code, inCell.length ? {
          total: inCell.length,
          open: openIn.length,
          closed: inCell.length - openIn.length,
          blocked,
          overdue: openIn.filter((t) => isOverdue(t, asOf)).length,
          owner_access: openIn.filter((t) => t.access_status === 'Pending' || t.blocker_category === 'Owner Access Pending').length,
          percent: progress.reliable ? progress.percent : null,
          category: cellCategory(openIn, blocked, inCell),
        } : null];
      }));
      const counts = statusCounts(mine, asOf);
      return {
        location_id: villa.id,
        villa: villa.villa_code,
        plot_numbers: villa.plot_numbers || '',
        phase: ix.phaseName(villa.phase_id),
        possession_status: villa.possession_status || 'Not Handed Over',
        possession_date: toDay(villa.possession_date),
        works_stage: villa.works_stage || '',
        on_hold: heldIds.has(villa.id),
        open: counts.open,
        closed: counts.closed,
        blocked: counts.blocked,
        overdue: counts.overdue,
        owner_access: open.filter((t) => t.access_status === 'Pending' || t.blocker_category === 'Owner Access Pending').length,
        forecast,
        cells,
      };
    })
    // Handed-over villas that still have open works come first, as on the handover board.
    .sort((a, b) =>
      Number(b.possession_status === 'Handed Over' && b.open > 0) - Number(a.possession_status === 'Handed Over' && a.open > 0)
      || b.open - a.open || a.villa.localeCompare(b.villa, undefined, { numeric: true }));

  return {
    as_of: asOf,
    disciplines,
    rows,
    totals: {
      villas: rows.length,
      handed_over_with_open_works: rows.filter((r) => r.possession_status === 'Handed Over' && r.open > 0).length,
      open: rows.reduce((s, r) => s + r.open, 0),
      blocked: rows.reduce((s, r) => s + r.blocked, 0),
      overdue: rows.reduce((s, r) => s + r.overdue, 0),
      not_scheduled: rows.filter((r) => r.forecast.state === 'not_scheduled').length,
    },
    legend: [
      { category: 'Stuck', meaning: 'something in the cell is blocked' },
      { category: 'Active', meaning: 'work is under way' },
      { category: 'To do', meaning: 'not started' },
      { category: 'Verify', meaning: 'finished, waiting for inspection or closure' },
      { category: 'Done', meaning: 'everything in the cell is closed' },
    ],
    warnings: [
      rows.some((r) => r.forecast.state === 'not_scheduled')
        ? `${rows.filter((r) => r.forecast.state === 'not_scheduled').length} villa(s) have open work but no dated task, so no forecast can be stated.`
        : '',
    ].filter(Boolean),
  };
}

/* ---------------------------------------------------------------------- list */

/**
 * One row per location for the Villas list (L-04): progress (only when measured),
 * open, blocked, overdue and snag counts, possession, engineer, forecast with its
 * slip, and the last report — red once it is older than the project's stale days.
 * Sorted by risk, with handed-over villas that still have open works first.
 */
export function villaListView({ tasks = [], locations = [], snags = [], ix, asOf, options = {} }) {
  const heldIds = heldLocationIds(locations);
  const scoped = tasks.filter((t) => isCountable(t, { includeDemo: options.includeDemo === true }) && t.location_id
    && (!options.projectId || t.project_id === options.projectId)
    && (!options.phaseId || t.phase_id === options.phaseId));
  const byLocation = new Map();
  scoped.forEach((t) => byLocation.set(t.location_id, [...(byLocation.get(t.location_id) || []), t]));
  const snagsBy = new Map();
  snags.filter((s) => s.status !== 'Closed' && s.status !== 'Cancelled').forEach((s) => snagsBy.set(s.location_id, (snagsBy.get(s.location_id) || 0) + 1));

  const rows = locations
    .filter((l) => (!options.projectId || l.project_id === options.projectId) && (!options.phaseId || l.phase_id === options.phaseId))
    .map((l) => {
      const mine = byLocation.get(l.id) || [];
      const open = mine.filter(isOutstanding);
      const counts = statusCounts(mine, asOf);
      const progress = weightedProgress(mine);
      const settings = ix.settings(l.project_id);
      const last = mine.map((t) => toDay(t.latest_report_date)).filter(Boolean).sort().pop() || '';
      const stale = open.length > 0 && isStale(last, asOf, settings);
      const handedOpen = l.possession_status === 'Handed Over' && open.length > 0;
      return {
        location_id: l.id,
        villa: l.villa_code,
        plot_numbers: l.plot_numbers || '',
        location_type: l.location_type,
        phase: ix.phaseName(l.phase_id),
        possession_status: l.possession_status || 'Not Handed Over',
        active_status: l.active_status || 'Active',
        on_hold: heldIds.has(l.id),
        engineer: l.assigned_engineer || '',
        total: mine.length,
        open: counts.open,
        blocked: counts.blocked,
        overdue: counts.overdue,
        snags_open: snagsBy.get(l.id) || 0,
        percent: progress.reliable ? progress.percent : null,
        forecast: villaForecast(l, open),
        last_report_date: last,
        stale,
        handed_over_open: handedOpen,
        risk: counts.overdue * 3 + counts.blocked * 2 + (stale ? 2 : 0) + (handedOpen ? 5 : 0),
      };
    })
    .sort((a, b) => b.risk - a.risk || a.villa.localeCompare(b.villa, undefined, { numeric: true }));

  return { as_of: asOf, rows, totals: { locations: rows.length, handed_over_with_open_works: rows.filter((r) => r.handed_over_open).length } };
}

/* ----------------------------------------------------------------- statement */

export const STATUS_WORDS = {
  'Not Started': 'Not started',
  'In Progress': 'In progress',
  Blocked: 'On hold',
  'Execution Complete': 'Work finished, waiting for inspection',
  'Under Inspection': 'Being inspected',
  Approved: 'Inspected and approved, to be closed',
  Closed: 'Closed',
};

const holdingFor = (task) => {
  if (isBlocked(task)) {
    const why = [task.blocker_category, task.blocker_description].filter(Boolean).join(' — ');
    return why || 'On hold';
  }
  if (task.access_status === 'Pending') return 'Waiting for access to the villa';
  if (task.selection_status === 'Pending Selection') return 'Waiting for a selection by the owner';
  if (['To Order', 'Ordered'].includes(task.procurement_status)) return `Material ${String(task.procurement_status).toLowerCase()}`;
  return '';
};

const neededFromOwner = (task) =>
  task.access_status === 'Pending' || task.selection_status === 'Pending Selection'
  || ['Owner Access Pending', 'Client Selection Pending'].includes(task.blocker_category);

export function villaStatementView({ location, tasks = [], snags = [], floors = [], ix, asOf, options = {} }) {
  const mine = tasks.filter((t) => t.location_id === location.id && isCountable(t, { includeDemo: options.includeDemo === true }));
  const open = mine.filter(isOutstanding);
  const floorName = new Map(floors.map((f) => [f.id, f.floor_name || f.floor_code]));
  const groupsMap = new Map();
  open
    .slice()
    .sort((a, b) => String(a.area_label || '').localeCompare(String(b.area_label || '')) || String(finishDate(a) || '9').localeCompare(String(finishDate(b) || '9')))
    .forEach((task) => {
      const key = (task.floor_id && floorName.get(task.floor_id)) || 'Whole villa or floor not stated';
      const item = {
        id: task.id,
        ref: task.task_ref || '',
        what: task.name,
        room: task.area_label ? String(task.area_label).split(' · ').slice(-1)[0] : '',
        trade: ix.disciplineName(task.discipline),
        status: STATUS_WORDS[task.status] || task.status,
        expected: finishDate(task) || '',
        date_note: finishDate(task) ? '' : 'date not set',
        holding: holdingFor(task),
        needs_owner: neededFromOwner(task),
      };
      groupsMap.set(key, [...(groupsMap.get(key) || []), item]);
    });
  const groups = [...groupsMap.entries()]
    .map(([floor, items]) => ({ floor, items }))
    .sort((a, b) => (a.floor.startsWith('Whole') ? 1 : 0) - (b.floor.startsWith('Whole') ? 1 : 0) || a.floor.localeCompare(b.floor));

  const openSnags = snags.filter((s) => s.location_id === location.id && s.status !== 'Closed')
    .map((s) => ({ id: s.id, ref: s.snag_ref || '', title: s.title, area: s.area_label || '', severity: s.severity, status: s.status === 'Awaiting Reinspection' ? 'Fixed, waiting to be re-checked' : 'Open', photo: (s.photo_uris || [])[0] || '' }));

  const since = shiftDay(asOf, -30);
  const completed = mine
    .filter((t) => ['Execution Complete', 'Under Inspection', 'Approved', 'Closed'].includes(t.status))
    .map((t) => ({ task: t, day: toDay(t.actual_finish) || toDay(t.approved_at) || toDay(t.updated_date) }))
    .filter(({ day }) => day && day >= since && day <= asOf)
    .sort((a, b) => b.day.localeCompare(a.day))
    .map(({ task, day }) => ({ id: task.id, what: task.name, room: task.area_label || '', day, status: STATUS_WORDS[task.status] }));

  const owner = open.filter(neededFromOwner).map((task) => ({
    id: task.id,
    what: task.name,
    need: task.access_status === 'Pending' || task.blocker_category === 'Owner Access Pending'
      ? 'Access to the villa'
      : 'A selection by the owner',
  }));

  const progress = weightedProgress(mine);
  const forecast = villaForecast(location, open);
  return {
    as_of: asOf,
    villa: {
      id: location.id,
      code: location.villa_code,
      plots: location.plot_numbers || '',
      phase: ix.phaseName(location.phase_id),
      project: ix.projectName(location.project_id),
      possession_status: location.possession_status || 'Not Handed Over',
      possession_date: toDay(location.possession_date),
      on_hold_reason: location.active_status === 'On Hold' ? location.on_hold_reason || 'On hold' : '',
    },
    forecast,
    groups,
    snags: openSnags,
    needed_from_owner: owner,
    completed_recently: completed,
    totals: {
      open_tasks: open.length,
      open_snags: openSnags.length,
      waiting_on_owner: owner.length,
      completed_in_30_days: completed.length,
      // Only when every task is measured; otherwise counts only.
      percent: progress.reliable ? progress.percent : null,
      measured_of: progress.reliable ? null : `${progress.measured} of ${progress.total} tasks measured`,
    },
    // The register says the works are complete while work is still open.
    contradiction: location.works_stage === 'Completed' && open.length > 0
      ? `The villa is marked Works Completed but ${open.length} task(s) are still open.`
      : '',
  };
}

const dayLabel = (day) => (day ? day : 'date not set');

/** The statement as plain text for WhatsApp: short lines, no tables, no internal fields. */
export function statementText(view, { includeRefs = false } = {}) {
  const v = view.villa;
  const lines = [
    `Pending works — ${v.code}${v.plots ? ` (${v.plots})` : ''}, ${v.project}${v.phase ? `, ${v.phase}` : ''}`,
    `As of ${view.as_of}. ${v.possession_status === 'Handed Over' ? `Handed over${v.possession_date ? ` on ${v.possession_date}` : ''}.` : 'Not yet handed over.'}`,
    view.forecast.date
      ? `${view.forecast.label}: ${view.forecast.date}${view.forecast.undated ? ` (${view.forecast.undated} item(s) have no date yet)` : ''}`
      : view.totals.open_tasks ? `${view.forecast.label}: not scheduled yet` : 'No pending works.',
    '',
  ];
  view.groups.forEach((group) => {
    lines.push(group.floor.toUpperCase());
    group.items.forEach((item) => {
      lines.push(`• ${item.room ? `${item.room}: ` : ''}${item.what}${includeRefs && item.ref ? ` [${item.ref}]` : ''} — ${item.trade}, ${item.status.toLowerCase()}, ${dayLabel(item.expected)}${item.holding ? `. ${item.holding}` : ''}`);
    });
    lines.push('');
  });
  if (view.snags.length) {
    lines.push('SNAGS TO FIX');
    view.snags.forEach((s) => lines.push(`• ${s.title}${s.area ? ` (${s.area})` : ''} — ${s.status.toLowerCase()}`));
    lines.push('');
  }
  if (view.needed_from_owner.length) {
    lines.push('NEEDED FROM YOU');
    view.needed_from_owner.forEach((o) => lines.push(`• ${o.need}: ${o.what}`));
    lines.push('');
  }
  if (view.completed_recently.length) {
    lines.push(`COMPLETED IN THE LAST 30 DAYS: ${view.completed_recently.length}`);
  }
  lines.push(`${view.totals.open_tasks} work item(s) and ${view.totals.open_snags} snag(s) open.${view.totals.percent !== null ? ` ${view.totals.percent}% complete (measured).` : ''}`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
