/**
 * Applying an agreed change from an uploaded work list to an existing task.
 *
 * This is not a second way of writing a task: it runs the same rules the task
 * editor runs — guardTaskChanges decides whether the change is allowed (baseline
 * lock, approval separation, a reason for every forecast revision), diffFields
 * builds the audit entries from the stored record, deriveTaskEffects stamps who
 * did what, and writeTaskHistory records it. What it adds is the two things an
 * import specifically owes the register:
 *
 *  - A comparison that has gone stale is refused. If the task changed after the
 *    comparison was produced, the change stops and the row is reported instead of
 *    being applied on top of a record nobody has looked at.
 *  - A blank cell changes nothing. The change set is built from the cells that
 *    actually carry a value, so a file that leaves progress, a date or a
 *    contractor empty cannot erase what is recorded.
 */

import { diffFields, TASK_FIELDS, writeTaskHistory } from './history.ts';
import {
  blockedStateFor,
  COMPLETION_NOTE,
  deriveTaskEffects,
  FILE_FORBIDDEN_STATUSES,
  guardTaskChanges,
  REPORTED_COMPLETE_STATUS,
} from './taskWriteRules.ts';
import { cleanText } from './workImport.ts';
import { actorName } from './records.ts';
import { changeSetFor, EDITABLE_FIELDS, FORECAST_FIELD, RECONCILE_FIELDS } from './reconcile.ts';

const labelFor = (field) => (RECONCILE_FIELDS.find((entry) => entry.field === field) || {}).label || field;

/**
 * The patch the file proposes, plus any explicit edit or clearing the reviewer
 * made. Only allow-listed fields can be set, and an empty edit means "clear this
 * value deliberately" — it is never reached by leaving a cell blank.
 */
export function buildPatch({ row, task, edits = {} }) {
  const patch = {};
  const cleared = [];
  changeSetFor(row, task).forEach((change) => {
    if (change.field === 'scope') Object.assign(patch, change.patch);
    else patch[change.field] = change.proposed;
  });

  Object.keys(edits || {}).forEach((field) => {
    if (!EDITABLE_FIELDS.includes(field)) return;
    const value = edits[field];
    if (field === 'area_ids' || field === 'floor_id' || field === 'scope_type') {
      patch[field] = value === '' || value === null ? (field === 'area_ids' ? [] : null) : value;
      return;
    }
    const next = value === '' || value === null || value === undefined ? null : value;
    patch[field] = next;
    if (next === null) cleared.push(labelFor(field));
  });
  return { patch, cleared };
}

/**
 * One task, one agreed change. Returns the outcome rather than throwing, so a
 * single refused row is reported beside the rows that succeeded.
 */
export async function applyTaskUpdate({
  base44,
  svc,
  task,
  row,
  user,
  memberIds,
  rank,
  reason,
  edits,
  batchRef,
  fileName,
  expected,
}) {
  const fresh = await svc.Task.filter({ id: task.id }, { limit: 1 }).then((res) => (res?.items || [])[0] || null);
  if (!fresh) return { outcome: 'failed', note: 'That task no longer exists.', changed: [] };

  if (expected && fresh.updated_date && expected !== fresh.updated_date) {
    return {
      outcome: 'failed',
      note: 'This task changed after the comparison was produced — upload the file again and review the fresh comparison.',
      changed: [],
    };
  }

  // Approved or closed work is never altered by a work list: a file is not an
  // authorised approval workflow. The row is flagged for a person to handle.
  if (['Approved', 'Closed'].includes(String(fresh.status || ''))) {
    return {
      outcome: 'failed',
      note: `This task is ${fresh.status}. A work list does not change approved or closed work — raise the change through the task editor or a baseline revision, where it is authorised and recorded.`,
      changed: [],
    };
  }

  const { patch, cleared } = buildPatch({ row, task: fresh, edits });

  // The blocker requirements and the date the work was first blocked follow the
  // same rule as the editor and the daily report.
  const blocked = blockedStateFor({ task: fresh, next: patch });
  Object.assign(patch, blocked.patch);

  // A file may report work done; it may never approve it, close it or move it into
  // inspection. Those steps belong to an authorised person acting on the task.
  const nextStatus = String(patch.status || '');
  if (FILE_FORBIDDEN_STATUSES.includes(nextStatus)) {
    return {
      outcome: 'failed',
      note: `A work list cannot move work into ${nextStatus}. The row is left for an authorised person: the reported completion is verified first, and then a different authorised person approves or closes it.`,
      changed: [],
    };
  }
  const importedCompletion = nextStatus === REPORTED_COMPLETE_STATUS
    && String(fresh.status || '') !== REPORTED_COMPLETE_STATUS;
  if (importedCompletion) {
    // Reported as done by whoever wrote the sheet: the source wording is kept, no
    // completion actor is recorded, and approval waits for verification.
    patch.needs_completion_verification = true;
    patch.source_status = cleanText(row.values.status) || nextStatus;
    patch.latest_update = COMPLETION_NOTE;
  }

  const entries = diffFields(fresh, patch, TASK_FIELDS);
  if (!entries.length) {
    return { outcome: 'unchanged', note: 'The record already held these values — nothing was written.', changed: [] };
  }

  const forecastChanged = entries.some((entry) => entry.field_changed === FORECAST_FIELD);
  const note = forecastChanged && reason ? `Forecast revision — ${reason}` : '';

  // The same permission, baseline and approval rules as the task editor.
  guardTaskChanges({ task: fresh, entries, rank, user, reason });

  const effects = deriveTaskEffects({ task: fresh, entries, user, importedCompletion });
  const write = {};
  entries.forEach((entry) => {
    write[entry.field_changed] = entry.new_value;
  });
  Object.assign(write, effects.patch);
  // The reason for moving a forecast date travels with the task as well as into
  // the audit trail, so the record always shows why its forecast last moved.
  if (forecastChanged && reason) write.date_revision_reason = reason;
  // A reported completion is stamped on the task itself: the file's own word is
  // kept, and the completion is marked as waiting to be verified.
  if (importedCompletion) {
    write.needs_completion_verification = true;
    write.source_status = String(patch.source_status || '');
  }
  write.updated_by_name = actorName(user);
  if (memberIds) write.member_ids = memberIds;

  await svc.Task.update(fresh.id, write);

  await writeTaskHistory(base44, {
    task: fresh,
    projectId: fresh.project_id,
    memberIds,
    user,
    note: `Updated from ${fileName} (batch ${batchRef})${note ? ` — ${note}` : ''}`,
    entries: entries.map((entry) => (
      entry.field_changed === FORECAST_FIELD && reason
        ? { ...entry, note: `Reason: ${reason}` }
        : entry
    )),
    extra: [
      ...effects.derived,
      {
        change_type: 'Import Update',
        field_changed: 'import_batch',
        old_value: '',
        new_value: batchRef,
        note: `Agreed change from ${fileName} — row ${row.row_number}. Cleared: ${cleared.join(', ') || 'nothing'}`,
      },
      ...(importedCompletion
        ? [{
          change_type: 'Import Completion Reported',
          field_changed: 'status',
          old_value: String(fresh.status || ''),
          new_value: REPORTED_COMPLETE_STATUS,
          note: `${COMPLETION_NOTE} — reported in ${fileName}, so no completion actor is recorded and approval needs a different authorised person after verification.`,
        }]
        : []),
    ],
  });

  return {
    outcome: 'updated',
    note: forecastChanged ? `Forecast revised — ${reason}` : '',
    changed: entries.map((entry) => ({
      field: entry.field_changed,
      label: labelFor(entry.field_changed),
      from: entry.old_value,
      to: entry.new_value,
    })),
  };
}