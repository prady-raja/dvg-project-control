import { data } from '@/api/data';

/** Needs Attention actions, all through the server so the usual task rules apply. */
export const dismissItems = (projectId, items, reason, snoozeDays) =>
  data.invoke('attentionAction', { action: 'dismiss', project_id: projectId, items, reason, snooze_days: snoozeDays });

export const restoreItems = (projectId, itemKeys) =>
  data.invoke('attentionAction', { action: 'restore', project_id: projectId, item_keys: itemKeys });

export const bulkFix = (projectId, taskIds, changes, reason = '') =>
  data.invoke('attentionAction', { action: 'bulk_fix', project_id: projectId, task_ids: taskIds, changes, reason });

/** Which fix, if any, an issue code offers on the row itself. */
export const FIX_FOR = {
  no_contractor: 'contractor',
  no_coordinator: 'assignee',
  no_dates: 'dates',
  scope_unclear: 'scope',
};

/** Codes whose record is a task (so a task action applies) versus a register gap. */
export const isTaskItem = (item) => !!item.task_id;
