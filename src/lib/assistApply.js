/**
 * Confirmed proposal actions are written on the server (aiAction assist_confirm,
 * base44/shared/assistApply.ts), through the same guarded functions the ordinary
 * screens use. This module only words the outcome.
 */

/** Wording for one action's outcome, used under the review card. */
export const outcomeLine = (result) =>
  result.ok
    ? `Written${result.task_ref ? ` · ${result.task_ref}` : ''}`
    : `Not written — ${result.error || 'refused'}`;