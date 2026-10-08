/**
 * The reconciled workbook: the same work list, standardised and ready to import
 * again, together with what the system proposed for each row.
 *
 * The sheets are built here, on the server, from the reconciled rows, so the
 * download carries exactly what the review screen showed — the source workbook is
 * never altered. Nothing confidential travels: only the project's own work list,
 * its worksheet, the batch reference and the counts.
 */

import { IMPORT_TEMPLATE_HEADERS, cleanText } from './workImport.ts';
import { OUTCOMES, RECONCILE_FIELDS } from './reconcile.ts';

export const WORKBOOK_SHEETS = ['Works', 'Proposed_Changes', 'Review_Only', 'Import_Summary'];

const roomNamesFor = (row, ctx) => {
  const ids = row.resolved.area_ids || [];
  if (ids.length) {
    return ids
      .map((id) => (ctx.areas.find((area) => area.id === id) || {}).area_name)
      .filter(Boolean)
      .join(', ');
  }
  return cleanText(row.values.area);
};

const floorNameFor = (row, ctx) => {
  const floor = ctx.floors.find((item) => item.id === row.resolved.floor_id);
  return floor ? floor.floor_name : cleanText(row.values.floor);
};

/** One row of the Works sheet, in the import template's own column order. */
function worksRow(row, ctx, taskRef) {
  const r = row.resolved;
  const v = row.values;
  return [
    ctx.project.name,
    r.phase_code || '',
    r.location_id ? r.villa_code : '',
    r.category || '',
    r.discipline || '',
    r.work_package || '',
    floorNameFor(row, ctx),
    roomNamesFor(row, ctx),
    r.scope_type || '',
    r.name || '',
    r.contractor_name || '',
    cleanText(v.responsible_engineer),
    r.priority_value || '',
    r.status_value || '',
    r.baseline_start || '',
    r.baseline_finish || '',
    r.current_forecast_finish || '',
    r.progress_percent === null || r.progress_percent === undefined ? '' : String(r.progress_percent),
    r.planned_quantity === null || r.planned_quantity === undefined ? '' : String(r.planned_quantity),
    r.measurement_unit || '',
    r.acceptance_criterion || '',
    r.estimated_manhours === null || r.estimated_manhours === undefined ? '' : String(r.estimated_manhours),
    cleanText(v.blocker_description),
    cleanText(v.remarks),
    cleanText(v.source_reference),
    taskRef || '',
  ];
}

/**
 * `rows` are the reconciled rows; `outcomes` may override a row's outcome once
 * decisions have been applied (created, updated, rejected, deferred), so the
 * downloaded sheet says what actually happened.
 */
export function reconciledWorkbook({ rows, ctx, file, batchRef, userName, applied, decisions = {}, notes = [] }) {
  const list = rows || [];
  const decisionOf = (row) => cleanText(decisions[row.row_number]) || '';
  const appliedFor = (row) => (applied ? applied[row.row_number] || null : null);

  const works = [IMPORT_TEMPLATE_HEADERS];
  const changes = [[
    'Row', 'Worksheet', 'Proposed action', 'Task reference', 'Field', 'Existing value', 'Proposed value', 'Decision', 'Reason',
  ]];
  const review = [[
    'Row', 'Worksheet', 'Task / villa', 'Outcome', 'Why', 'Missing information',
  ]];

  const counts = { create: 0, update: 0, unchanged: 0, duplicate: 0, clarify: 0 };

  list.forEach((row) => {
    const rec = row.reconcile || {};
    const outcome = rec.outcome || 'create';
    counts[outcome] = (counts[outcome] || 0) + 1;
    const result = appliedFor(row);
    const matchedRef = outcome === 'update' || outcome === 'unchanged' || outcome === 'duplicate' ? cleanText(rec.match?.task_ref) : '';
    const decision = decisionOf(row) || (outcome === 'update' ? 'update' : outcome === 'unchanged' ? 'unchanged' : outcome === 'duplicate' ? 'link' : outcome === 'clarify' ? 'defer' : 'import');

    works.push(worksRow(row, ctx, matchedRef));

    const action = result?.outcome ? `${OUTCOMES[outcome]} → ${result.outcome}` : OUTCOMES[outcome];
    const reason = result?.note || rec.match?.reason || '';

    if (outcome === 'create') {
      changes.push([row.row_number, file.sheet || '', action, '', 'New task', '', cleanText(row.resolved.name), decision, reason]);
    } else if (outcome === 'update') {
      changes.push([row.row_number, file.sheet || '', action, matchedRef, 'Task', cleanText(rec.match?.task_ref), cleanText(row.resolved.name), decision, reason]);
    }
    (rec.changes || []).forEach((change) => {
      changes.push([
        row.row_number,
        file.sheet || '',
        action,
        matchedRef,
        change.label,
        cleanText(change.existing_text),
        cleanText(change.proposed_text),
        decision,
        change.field === 'current_forecast_finish' ? (decisionOf(row) ? `Reason required with the change` : '') : '',
      ]);
    });

    const needsReview = ['duplicate', 'clarify'].includes(outcome)
      || (rec.missing || []).length
      || ['skip', 'defer'].includes(decision)
      || (result && result.outcome === 'failed');
    if (needsReview) {
      review.push([
        row.row_number,
        file.sheet || '',
        `${matchedRef || cleanText(row.resolved.villa_code) || 'Site-wide'} — ${cleanText(row.resolved.name)}`,
        result?.outcome ? `${OUTCOMES[outcome]} (${result.outcome})` : OUTCOMES[outcome],
        [...(rec.clarifications || []), reason, result?.note].filter(Boolean).join(' | '),
        (rec.missing || []).join(' | '),
      ]);
    }
  });

  const created = list.filter((row) => appliedFor(row)?.outcome === 'created').length;
  const updated = list.filter((row) => appliedFor(row)?.outcome === 'updated').length;
  const skipped = list.filter((row) => appliedFor(row)?.outcome === 'skipped').length;
  const deferred = list.filter((row) => appliedFor(row)?.outcome === 'deferred').length;
  const failed = list.filter((row) => appliedFor(row)?.outcome === 'failed').length;

  const summary = [
    ['Import Works reconciliation'],
    ['Source file', file.name || ''],
    ['Worksheet', file.sheet || 'CSV (no worksheet)'],
    ['Project', ctx.project.name],
    ['Project code', ctx.project.code || ''],
    ['Batch reference', batchRef || '(not yet applied)'],
    ['Report state', applied ? 'Applied — this is what was written' : 'Proposed — nothing has been written yet'],
    ['Rows in the file', String(list.length)],
    [],
    ['Proposed action', 'Rows'],
    ['CREATE NEW', String(counts.create)],
    ['UPDATE EXISTING', String(counts.update)],
    ['UNCHANGED', String(counts.unchanged)],
    ['POSSIBLE DUPLICATE', String(counts.duplicate)],
    ['CLARIFICATION REQUIRED', String(counts.clarify)],
    [],
    ...(applied
      ? [
        ['Result', 'Rows'],
        ['Created', String(created)],
        ['Updated', String(updated)],
        ['Rejected', String(skipped)],
        ['Deferred', String(deferred)],
        ['Failed', String(failed)],
        [],
      ]
      : []),
    ['Generated', new Date().toISOString()],
    ['Generated by', userName || ''],
    ['Method', 'Every value read from the file; no villa, room, reference, percentage, contractor or date is invented.'],
    ...(notes.length ? [[], ['Notes'], ...notes.map((note) => ['', note])] : []),
  ];

  return {
    Works: works.map((line) => line.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))),
    Proposed_Changes: changes,
    Review_Only: review,
    Import_Summary: summary,
  };
}

export const RECONCILE_FIELD_LABELS = RECONCILE_FIELDS.map((entry) => entry.label);