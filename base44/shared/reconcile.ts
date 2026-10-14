/**
 * Import reconciliation: what an uploaded work list would change.
 *
 * The importer has always refused to overwrite anything. This module is the step
 * before that decision: every uploaded row is compared with the work already on
 * the register and given one of five outcomes — CREATE NEW, UPDATE EXISTING,
 * UNCHANGED, POSSIBLE DUPLICATE or CLARIFICATION REQUIRED — together with the
 * exact existing and proposed value of every field that would change.
 *
 * Three rules are absolute here:
 *  - A blank cell never proposes a change. There is no way for a file that leaves
 *    progress, a date or a contractor empty to erase what is already recorded.
 *  - A text similarity may raise a POSSIBLE DUPLICATE for a person to decide; it
 *    never authorises an update on its own. Only a stated task reference, a
 *    previous import row, a source reference or the same work in the same villa,
 *    discipline and room counts as a confirmed match.
 *  - Nothing is written by this module. It only states what would change, and the
 *    confirmed change set goes through the same task-write rules as the editor.
 */

import { normalizeValue } from './history.ts';
import { cleanText, listOf, looseKey, scopeKeyOf } from './workImport.ts';
import { standardLabelHint } from './areaLabels.ts';

export const OUTCOMES = {
  create: 'CREATE NEW',
  update: 'UPDATE EXISTING',
  unchanged: 'UNCHANGED',
  duplicate: 'POSSIBLE DUPLICATE',
  clarify: 'CLARIFICATION REQUIRED',
};

export const OUTCOME_ORDER = ['create', 'update', 'unchanged', 'duplicate', 'clarify'];

/**
 * The fields a file may change, in the order the review screen shows them.
 * `cell` is the column that has to carry a value: an empty cell proposes nothing.
 */
export const RECONCILE_FIELDS = [
  { field: 'name', label: 'Description', cell: 'name' },
  { field: 'discipline', label: 'Discipline', cell: 'discipline' },
  { field: 'work_package', label: 'Work package', cell: 'work_package' },
  { field: 'contractor_id', label: 'Contractor', cell: 'contractor' },
  { field: 'status', label: 'Status', cell: 'status' },
  { field: 'progress_percent', label: 'Progress', cell: 'progress_percent' },
  { field: 'current_forecast_finish', label: 'Forecast finish', cell: 'current_forecast_finish' },
  { field: 'baseline_start', label: 'Baseline start', cell: 'baseline_start' },
  { field: 'baseline_finish', label: 'Baseline finish', cell: 'baseline_finish' },
  { field: 'priority', label: 'Priority', cell: 'priority' },
  { field: 'planned_quantity', label: 'Quantity', cell: 'planned_quantity' },
  { field: 'measurement_unit', label: 'Unit', cell: 'measurement_unit' },
  { field: 'estimated_manhours', label: 'Estimated man-hours', cell: 'estimated_manhours' },
  { field: 'acceptance_criterion', label: 'Acceptance criterion', cell: 'acceptance_criterion' },
  { field: 'blocker_description', label: 'Blocker', cell: 'blocker_description' },
  { field: 'remarks', label: 'Remarks', cell: 'remarks' },
  { field: 'responsible_engineer', label: 'Responsible engineer', cell: 'responsible_engineer' },
];

/** The scope fields are proposed together, and only when a floor or room is given. */
export const SCOPE_FIELDS = ['floor_id', 'area_ids', 'area_label', 'scope_type', 'source_location_text', 'scope_unresolved'];

/** A user edit may only set these fields — never identity, references or provenance. */
export const EDITABLE_FIELDS = [
  ...RECONCILE_FIELDS.map((entry) => entry.field),
  'floor_id', 'area_ids', 'scope_type',
];

export const FORECAST_FIELD = 'current_forecast_finish';

const same = (field, a, b) => {
  const left = normalizeValue(field, a);
  const right = normalizeValue(field, b);
  if (left === null || left === '') return right === null || right === '';
  if (typeof left === 'number' || typeof right === 'number') return Number(left) === Number(right);
  return String(left) === String(right);
};

/** The value the row proposes for a field, read from the validated row. */
export function proposedValue(row, field) {
  const r = row.resolved;
  const values = row.values;
  switch (field) {
    case 'name': return cleanText(r.name);
    case 'discipline': return cleanText(r.discipline);
    case 'work_package': return cleanText(r.work_package) || null;
    case 'contractor_id': return cleanText(r.contractor_id) || null;
    case 'status': return cleanText(r.status_value);
    case 'progress_percent': return r.progress_percent;
    case 'current_forecast_finish': return r.current_forecast_finish;
    case 'baseline_start': return r.baseline_start;
    case 'baseline_finish': return r.baseline_finish;
    case 'priority': return cleanText(r.priority_value);
    case 'planned_quantity': return r.planned_quantity;
    case 'measurement_unit': return cleanText(r.measurement_unit) || null;
    case 'estimated_manhours': return r.estimated_manhours;
    case 'acceptance_criterion': return cleanText(r.acceptance_criterion) || null;
    case 'blocker_description': return cleanText(values.blocker_description) || null;
    case 'remarks': return cleanText(values.remarks) || null;
    case 'responsible_engineer': return cleanText(values.responsible_engineer) || null;
    default: return null;
  }
}

/** Human-readable value for the review screen and the downloaded sheets. */
export function displayValue(field, value, ctx) {
  if (value === null || value === undefined || value === '') return '';
  if (field === 'contractor_id') {
    const contractor = (ctx?.contractors || []).find((c) => c.id === value);
    return contractor ? contractor.name : String(value);
  }
  if (field === 'progress_percent') return `${value}%`;
  return String(value);
}

/** The change set a row proposes for one existing task. Blanks are skipped. */
export function changeSetFor(row, task) {
  const changes = [];
  RECONCILE_FIELDS.forEach((entry) => {
    if (!cleanText(row.values[entry.cell])) return; // the cell is empty: propose nothing
    const proposed = proposedValue(row, entry.field);
    if (same(entry.field, task ? task[entry.field] : null, proposed)) return;
    changes.push({
      field: entry.field,
      label: entry.label,
      existing: task ? task[entry.field] : null,
      proposed,
    });
  });

  // Where inside the villa the work sits: only when the file names a floor or room.
  const namesScope = ['floor', 'area', 'scope_type'].some((cell) => cleanText(row.values[cell]));
  if (namesScope && !row.resolved.scope_unassigned) {
    const next = {
      floor_id: row.resolved.floor_id || null,
      area_ids: row.resolved.area_ids || [],
      area_label: row.resolved.area_label || null,
      scope_type: row.resolved.scope_type || null,
      source_location_text: [row.resolved.floor_text, row.resolved.area_text].filter(Boolean).join(' · ') || null,
      scope_unresolved: false,
    };
    const moved = ['floor_id', 'scope_type', 'source_location_text'].some((field) => !same(field, task ? task[field] : null, next[field]))
      || (task ? scopeKeyOf(task) : 'whole') !== scopeKeyOf(next);
    if (moved) {
      changes.push({
        field: 'scope',
        label: 'Villa / room scope',
        existing: (task ? task.area_label : '') || '',
        proposed: row.resolved.area_label || row.resolved.scope_type || '',
        patch: next,
      });
    }
  }
  return changes;
}

/**
 * The task a row refers to, and how that was established.
 *
 * Only these count as confirmed: the file stating the task reference, the same
 * row of the same file imported before, a matching source reference, or the same
 * wording in the same villa, discipline and room. A looser similarity is offered
 * as a candidate for a person to decide.
 */
export function matchFor({ row, ctx, linkedTaskId, byRef }) {
  const explicit = cleanText(row.values.task_ref);
  if (explicit) {
    const key = looseKey(explicit);
    const byReference = byRef.get(key) || null;
    const sameId = ctx.tasks.find((task) => looseKey(task.task_ref) === key) || null;
    const task = byReference || sameId;
    if (!task) {
      return { task: null, via: 'task_ref', confidence: 'unknown', reason: `No task on ${ctx.project.name} has the reference “${explicit}”.` };
    }
    return { task, via: 'task_ref', confidence: 'confirmed', reason: `The file names ${task.task_ref}.` };
  }
  if (linkedTaskId) {
    const task = ctx.tasks.find((item) => item.id === linkedTaskId) || null;
    if (task) return { task, via: 'chosen', confidence: 'confirmed', reason: 'Chosen on the review screen.' };
    return { task: null, via: 'chosen', confidence: 'unknown', reason: 'That task was not found on this project.' };
  }
  const duplicate = row.duplicate;
  if (!duplicate || !duplicate.task_id) return { task: null, via: '', confidence: '', reason: '' };
  const task = ctx.tasks.find((item) => item.id === duplicate.task_id) || null;
  if (!task) return { task: null, via: '', confidence: '', reason: '' };
  return {
    task,
    via: duplicate.in_file ? 'in_file' : duplicate.confidence === 'confident' ? 'work' : 'similar',
    confidence: duplicate.confidence,
    reason: duplicate.reason,
  };
}

/**
 * A row this very file already wrote on an earlier (possibly unfinished) run.
 *
 * Every condition has to hold: the task sits in this project, carries the import
 * batch of the same file fingerprint (ctx.alreadyImported, built by the caller),
 * was written from this source row number, and the row has no other candidate,
 * no repeat inside the file and no field that differs. Anything less stays a
 * decision for a person.
 */
function alreadyImportedFor({ row, ctx, match, linkedTaskId, clarifications }) {
  const prior = ctx.alreadyImported?.get(row.row_number);
  if (!prior || prior.ambiguous || row.blocking || clarifications.length) return null;
  const task = ctx.tasks.find((item) => item.id === prior.task_id);
  if (!task || task.archived === true || task.import_batch_id !== prior.batch_id) return null;
  if (task.project_id && ctx.project?.id && task.project_id !== ctx.project.id) return null;
  if (row.issues.some((issue) => issue.code === 'duplicate_in_file' || issue.code === 'repeated_in_file')) return null;
  const dup = row.duplicate;
  if (dup && (dup.in_file || dup.task_id !== task.id || (dup.others || []).length)) return null;
  const stated = cleanText(row.values.task_ref);
  if (stated && looseKey(stated) !== looseKey(task.task_ref)) return null;
  if (linkedTaskId && linkedTaskId !== task.id) return null;
  if (match.task && match.task.id !== task.id) return null;
  if (changeSetFor(row, task).length) return null;
  return { task, prior };
}

/** Why a row cannot be decided yet, stated so the person knows what to fix. */
function clarificationsFor({ row, match, task }) {
  const notes = [];
  row.issues.filter((issue) => issue.severity === 'error').forEach((issue) => notes.push(issue.message));

  const villaNamed = cleanText(row.values.villa_code);
  if (task && villaNamed && row.resolved.location_id && task.location_id && task.location_id !== row.resolved.location_id) {
    notes.push(`The file puts this row in ${row.resolved.villa_code}, but ${task.task_ref} is recorded in ${match.villaLabel || 'another villa'} — confirm the villa, or import this as new work.`);
  }
  if (task && (task.archived === true)) {
    notes.push(`${task.task_ref} is archived. Restore it first, or import this row as new work.`);
  }
  if (['floor', 'area'].some((cell) => cleanText(row.values[cell])) && row.resolved.scope_unassigned) {
    // The company's own wording is offered beside what the file wrote. The source
    // text is kept as written, no room is created and two rooms are never merged.
    const hint = standardLabelHint(row.values.area);
    notes.push(
      `The floor or room named here is not in the villa register, so the location cannot be compared with the recorded work — register the room or choose the right one.${
        hint && cleanText(hint) !== cleanText(row.values.area) ? ` “${cleanText(row.values.area)}” reads as the standard label “${hint}”.` : ''
      }`,
    );
  }
  if (match.confidence === 'unknown' && cleanText(row.values.task_ref)) {
    notes.push(match.reason);
  }
  // A sheet exported for editing carries when each row was last updated: if the task
  // has changed since, applying the sheet could overwrite someone's newer work (I-03).
  const exportedAt = cleanText(row.values.exported_at);
  if (task && exportedAt && task.updated_date && Date.parse(task.updated_date) > Date.parse(exportedAt)) {
    notes.push(`${task.task_ref} was changed after this sheet was exported (${task.updated_date}). Export it again, or confirm that the sheet's values are still right.`);
  }
  return [...new Set(notes)];
}

/** Candidate existing tasks a person may link a row to. */
function candidatesFor(row, ctx) {
  const name = looseKey(row.resolved.name);
  const discipline = row.resolved.discipline;
  const pool = new Map();
  const add = (task) => {
    if (!task || pool.has(task.id)) return;
    pool.set(task.id, task);
  };
  if (name && discipline) {
    (ctx.dupIndex.byNameDiscipline.get(`${name}|${discipline}`) || []).forEach(add);
  }
  if (name && row.resolved.location_id) {
    (ctx.dupIndex.byName.get(name) || [])
      .filter((task) => (task.location_id || '') === row.resolved.location_id)
      .forEach(add);
  }
  if (row.duplicate?.task_id) add(ctx.tasks.find((task) => task.id === row.duplicate.task_id));

  return [...pool.values()].slice(0, 6).map((task) => ({
    id: task.id,
    task_ref: task.task_ref,
    name: task.name,
    villa: ctx.locationCodeById.get(task.location_id) || 'Site-wide',
    area_label: task.area_label || '',
    discipline: task.discipline,
    status: task.status,
    archived: task.archived === true,
  }));
}

/**
 * One outcome per row. `rows` are the validated rows from validateImportRows, so
 * a row that cannot be read is a clarification, not a guess.
 */
export function reconcileRows({ rows, ctx, links = {}, byRef }) {
  const referenceIndex = byRef || new Map(ctx.tasks.filter((task) => task.task_ref).map((task) => [looseKey(task.task_ref), task]));

  const reconciled = (rows || []).map((row) => {
    const linkedTaskId = String(links[row.row_number] || '');
    let match = matchFor({ row, ctx, linkedTaskId, byRef: referenceIndex });
    const firstClarifications = clarificationsFor({ row, match, task: match.task });
    const already = alreadyImportedFor({ row, ctx, match, linkedTaskId, clarifications: firstClarifications });
    if (already) {
      match = {
        task: already.task,
        via: 'already_imported',
        confidence: 'confirmed',
        reason: `Already imported: row ${row.row_number} of this file was written to ${already.task.task_ref} in batch ${already.prior.batch_ref || already.prior.batch_id}.`,
      };
    }
    const task = match.task;
    const taskWithVilla = task ? { ...task, villaLabel: ctx.locationCodeById.get(task.location_id) || 'Site-wide' } : null;

    const clarifications = already ? [] : clarificationsFor({ row, match: { ...match, villaLabel: taskWithVilla?.villaLabel }, task });
    const changes = task && !row.blocking ? changeSetFor(row, task) : [];
    const missing = [];
    if (!row.resolved.contractor_id) missing.push('Contractor');
    if (!row.resolved.baseline_start) missing.push('Baseline start');
    if (!row.resolved.baseline_finish) missing.push('Baseline finish');
    if (row.resolved.progress_percent === null) missing.push('Progress');
    if (row.resolved.scope_unassigned) missing.push('Room/area not in the register');

    let outcome;
    if (already) outcome = 'unchanged';
    else if (row.blocking || clarifications.length) outcome = 'clarify';
    else if (!task) outcome = row.duplicate?.in_file ? 'duplicate' : 'create';
    else if (match.confidence !== 'confirmed') outcome = 'duplicate';
    else if (changes.length) outcome = 'update';
    else outcome = 'unchanged';

    const forecastChange = changes.some((change) => change.field === FORECAST_FIELD);

    return {
      ...row,
      reconcile: {
        outcome,
        label: OUTCOMES[outcome],
        match: task
          ? {
            task_id: task.id,
            task_ref: task.task_ref,
            villa: taskWithVilla.villaLabel,
            area_label: task.area_label || '',
            status: task.status,
            via: match.via,
            confidence: match.confidence,
            reason: match.reason,
            updated_date: task.updated_date || '',
            baseline_locked: task.baseline_locked === true,
            ...(already ? { batch_id: already.prior.batch_id, batch_ref: already.prior.batch_ref || '' } : {}),
          }
          : { task_id: '', task_ref: '', confidence: match.confidence, via: match.via, reason: match.reason },
        changes: changes.map((change) => ({
          field: change.field,
          label: change.label,
          existing: change.existing ?? null,
          existing_text: change.field === 'scope'
            ? cleanText(change.existing)
            : displayValue(change.field, change.existing, ctx),
          proposed: change.proposed ?? null,
          proposed_text: change.field === 'scope'
            ? cleanText(change.proposed)
            : displayValue(change.field, change.proposed, ctx),
          patch: change.patch || null,
        })),
        clarifications,
        candidates: candidatesFor(row, ctx),
        missing,
        // A forecast revision needs a reason recorded with it, every time.
        needs_reason: forecastChange,
        ai_suggestion: null,
      },
    };
  });

  return { rows: reconciled, summary: summarise(reconciled), byRef: referenceIndex };
}

/** Counts by outcome, for the review strip and the batch record. */
export function summarise(rows) {
  const list = rows || [];
  const of = (key) => list.filter((row) => row.reconcile?.outcome === key).length;
  return {
    total: list.length,
    create: of('create'),
    update: of('update'),
    unchanged: of('unchanged'),
    duplicate: of('duplicate'),
    clarify: of('clarify'),
    changes: list.reduce((total, row) => total + (row.reconcile?.changes?.length || 0), 0),
    needing_a_decision: list.filter((row) => ['update', 'duplicate', 'clarify'].includes(row.reconcile?.outcome)).length,
  };
}

/** A row a person may update: a confirmed match with something to change. */
export function updatableTaskId(row) {
  const r = row.reconcile;
  if (!r || r.outcome !== 'update') return '';
  return r.match.task_id || '';
}

export const listOfRows = (value) => listOf(value);