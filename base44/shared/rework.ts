/**
 * Reject for rework (Q-04). Work that fails inspection goes back to In Progress
 * with a category and a note, a rejection count and the last reason, so rework
 * is recorded instead of hidden in a hand-edited status. Pure rules; taskWrite
 * applies them.
 */
import { fail } from './records.ts';

export const REJECTION_CATEGORIES = ['Workmanship', 'Incomplete', 'Wrong material', 'Not to drawing', 'Other'];
/** Work can be rejected only while it waits for DVG's inspection. */
export const REJECTABLE_FROM = ['Execution Complete', 'Under Inspection'];

/** What a person entered, checked and tidied. */
export function reworkInput(input = {}) {
  const category = String(input?.category || '').trim();
  if (!REJECTION_CATEGORIES.includes(category)) throw fail(`Say why it is rejected: ${REJECTION_CATEGORIES.join(', ')}.`);
  const note = String(input?.note || '').trim().slice(0, 1000);
  if (!note) throw fail('Say what has to be redone, so the contractor knows.');
  return { category, note };
}

/** The stored fields after one more rejection. */
export const reworkPatch = (task, { category, note }) => ({
  rejection_count: (Number(task?.rejection_count) || 0) + 1,
  last_rejection_category: category,
  last_rejection_reason: note,
});

export const isRework = (task) => (Number(task?.rejection_count) || 0) > 0;
