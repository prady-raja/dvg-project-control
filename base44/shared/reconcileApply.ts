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
import { deriveTaskEffects, guardTaskChanges } from './taskWriteRules.ts';
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

  const { patch, cleared } = buildPatch({ row, task: fresh, edits });
  const entries = diffFields(fresh, patch, TASK_FIELDS);
  if (!entries.length) {
    return { outcome: 'unchanged', note: 'The record already held these values — nothing was written.', changed: [] };
  }

  const forecastChanged = entries.some((entry) => entry.field_changed === FORECAST_FIELD);
  const note = forecastChanged && reason ? `Forecast revision — ${reason}` : '';

  // The same permission, baseline and approval rules as the task editor.
  guardTaskChanges({ task: fresh, entries, rank, user, reason });

  const effects = deriveTaskEffects({ task: fresh, entries, user });
  const write = {};
  entries.forEach((entry) => {
    write[entry.field_changed] = entry.new_value;
  });
  Object.assign(write, effects.patch);
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