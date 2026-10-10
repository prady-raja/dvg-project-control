/**
 * Applying a confirmed AI proposal, on the server.
 *
 * Each action is written by the same guarded function an ordinary screen calls
 * (dailyUpdate, taskWrite, snagWrite, saveRecord), invoked with the user's own
 * client so the permission checks are theirs. Every outcome is stored under
 * `${external_id}:${index}`, so confirming again resumes only the actions not
 * yet written and nothing is ever written twice.
 *
 * Pure apart from the injected `invoke`, so the rules can be tested without the
 * platform.
 */

export const resultKey = (externalId, index) => `${externalId}:${index}`;

/** Statuses after which a proposal is never written again. */
export const FINAL_STATUSES = ['Applied', 'Cancelled'];

/** A proposal marked Applying more recently than this is treated as in flight. */
export const APPLYING_LEASE_MS = 2 * 60 * 1000;

const callFor = (action) => {
  const payload = action.payload || {};
  switch (action.type) {
    case 'record_progress':
      return ['dailyUpdate', payload];
    case 'create_task':
      return ['taskWrite', { action: 'create', changes: payload.changes || {} }];
    case 'raise_snag':
      return ['snagWrite', { action: 'create', snag: payload.snag || {} }];
    case 'link_dependency':
      return ['saveRecord', { entity: 'TaskDependency', action: 'create', data: payload.data || {} }];
    default:
      return null;
  }
};

const errorText = (error) =>
  String(error?.response?.data?.error || error?.data?.error || error?.message || 'The write was refused.').slice(0, 300);

/** Index of each action within the stored proposal, which keys its result. */
export const indexOfAction = (actions, actionId) => (actions || []).findIndex((a) => a.action_id === actionId);

/** True when this action already has a successful stored result. */
export const alreadyWritten = (results, key) => (results || []).some((row) => row.result_key === key && row.ok === true);

/**
 * Writes each action that is not yet written and returns every stored result,
 * the earlier ones included. `onProgress` is called after each write so the
 * caller can persist progress and a timeout loses nothing already written.
 */
export async function applyProposal({ externalId, allActions, selected, previous = [], invoke, onProgress }) {
  const results = [...(previous || [])];
  const upsert = (row) => {
    const at = results.findIndex((r) => r.result_key === row.result_key);
    if (at >= 0) results[at] = row;
    else results.push(row);
  };

  for (const action of selected) {
    const index = indexOfAction(allActions, action.action_id);
    const key = resultKey(externalId, index);
    if (alreadyWritten(results, key)) continue;
    const review = action.review || {};
    const base = {
      result_key: key,
      action_id: action.action_id,
      summary: String(action.summary || '').slice(0, 220),
    };
    const call = callFor(action);
    if (!call) {
      upsert({ ...base, ok: false, error: 'This action is not supported.' });
      continue;
    }
    try {
      const res = await invoke(call[0], call[1]);
      const data = res?.data ?? res ?? {};
      const ref = data.task?.task_ref || data.snag?.snag_ref || data.ref || review.task_ref || '';
      const id = data.task?.id || review.task_id || '';
      upsert({ ...base, ok: true, error: '', task_ref: String(ref).slice(0, 40), task_id: String(id).slice(0, 60) });
    } catch (error) {
      upsert({ ...base, ok: false, error: errorText(error), task_ref: review.task_ref || '', task_id: review.task_id || '' });
    }
    if (onProgress) await onProgress(results);
  }
  return results;
}

/** Overall status from the results of the selected actions. */
export function proposalStatus(results, selectedCount) {
  const written = (results || []).filter((row) => row.ok).length;
  if (selectedCount > 0 && written >= selectedCount) return 'Applied';
  return written ? 'Partial' : 'Failed';
}
