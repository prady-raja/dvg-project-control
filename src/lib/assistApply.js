import { submitDailyUpdate } from '@/lib/dailyService';
import { createTask } from '@/lib/taskService';
import { createSnag } from '@/lib/snagService';
import { createRecord } from '@/lib/recordService';

/**
 * Confirmed proposal actions are written through the same guarded paths the
 * ordinary screens use — the daily report service, the task service, the snag
 * service and the record service. Nothing here writes a record directly, and
 * every action is reported back one by one so the outcome can be recorded.
 */
export async function applyProposalActions(actions = []) {
  const results = [];

  for (const action of actions) {
    const summary = action.summary || '';
    const review = action.review || {};
    try {
      if (action.type === 'record_progress') {
        await submitDailyUpdate(action.payload);
        results.push({ action_id: action.action_id, summary, ok: true, task_ref: review.task_ref || '', task_id: review.task_id || '' });
      } else if (action.type === 'create_task') {
        const changes = action.payload?.changes || {};
        const task = await createTask(changes);
        results.push({ action_id: action.action_id, summary, ok: true, task_ref: task?.task_ref || '', task_id: task?.id || '' });
      } else if (action.type === 'raise_snag') {
        const snag = await createSnag(action.payload?.snag || {});
        results.push({ action_id: action.action_id, summary, ok: true, task_ref: snag?.snag_ref || '', task_id: review.task_id || '' });
      } else if (action.type === 'link_dependency') {
        await createRecord('TaskDependency', action.payload?.data || {});
        results.push({ action_id: action.action_id, summary, ok: true, task_ref: review.task_ref || '', task_id: review.task_id || '' });
      } else {
        results.push({ action_id: action.action_id, summary, ok: false, error: 'This action is not supported by the review screen.' });
      }
    } catch (error) {
      results.push({
        action_id: action.action_id,
        summary,
        ok: false,
        error: error?.response?.data?.error || error?.message || 'The write was refused.',
      });
    }
  }

  return results;
}

/** Wording for one action's outcome, used under the review card. */
export const outcomeLine = (result) =>
  result.ok
    ? `Written${result.task_ref ? ` · ${result.task_ref}` : ''}`
    : `Not written — ${result.error || 'refused'}`;