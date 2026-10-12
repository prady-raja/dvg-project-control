/**
 * Undoing one import batch (I-02). Pure: given the batch's own report and the
 * tasks as they stand now, decide what to archive, what to put back and what to
 * leave alone.
 *
 *  - A task the batch CREATED is archived (never deleted — archive is reversible).
 *  - A task the batch UPDATED gets the fields the batch changed put back to what
 *    they held before.
 *  - Only where the task has not been touched since the batch: a task edited after
 *    the import is skipped and listed, so the undo can never wipe later work.
 *  - A task under an approved baseline is never reverted on its baseline dates.
 */
import { BASELINE_FIELDS } from './history.ts';

const stamp = (value) => String(value || '');

/** Archived tasks stay archived; an already-undone batch cannot be undone twice. */
export function planUndo({ batch, tasksById }) {
  const plan = { archive: [], revert: [], skipped: [], nothing: 0 };
  if (!batch) return { ...plan, error: 'That import batch was not found.' };
  if (batch.status === 'Undone') return { ...plan, error: 'This import has already been undone.' };
  if (batch.status === 'Importing') return { ...plan, error: 'This import is still running.' };

  const batchTime = stamp(batch.updated_date || batch.imported_at);
  const touchedSince = (task) => stamp(task.updated_date) > batchTime;

  (batch.report || []).forEach((entry) => {
    const task = entry.task_id ? tasksById.get(entry.task_id) : null;
    const row = { row_number: entry.row_number, task_id: entry.task_id || '', task_ref: entry.task_ref || '', name: entry.name || '' };

    if (entry.outcome === 'created') {
      if (!task) return plan.skipped.push({ ...row, reason: 'The task no longer exists.' });
      if (task.archived === true) return plan.skipped.push({ ...row, reason: 'Already archived.' });
      if (touchedSince(task)) return plan.skipped.push({ ...row, reason: 'Edited or reported on since the import — left as it is.' });
      return plan.archive.push(row);
    }

    if (entry.outcome === 'updated') {
      if (!task) return plan.skipped.push({ ...row, reason: 'The task no longer exists.' });
      if (touchedSince(task)) return plan.skipped.push({ ...row, reason: 'Edited since the import — left as it is.' });
      const frozen = task.baseline_locked === true || task.baseline_approval_status === 'Approved';
      const changes = (entry.changed || []).filter((change) => !(frozen && BASELINE_FIELDS.includes(change.field)));
      if (!changes.length) return plan.skipped.push({ ...row, reason: 'Only baseline dates changed, and they are frozen under an approved baseline.' });
      const patch = {};
      // Put back in reverse, so a field changed twice ends where it started.
      [...changes].reverse().forEach((change) => {
        patch[change.field] = change.from === undefined || change.from === '' ? null : change.from;
      });
      return plan.revert.push({ ...row, patch, fields: Object.keys(patch) });
    }

    plan.nothing += 1;
    return undefined;
  });
  return plan;
}

/** A short summary for the confirmation screen. */
export const undoSummary = (plan) => ({
  archive: plan.archive.length,
  revert: plan.revert.length,
  skipped: plan.skipped.length,
  nothing_to_undo: plan.nothing,
});
