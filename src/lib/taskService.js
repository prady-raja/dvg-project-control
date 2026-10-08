import { base44 } from '@/api/base44Client';

/**
 * Every task write goes through the server, which decides permission from the
 * signed-in session and records the change history. The interface never writes
 * a task record directly.
 */

const invoke = async (name, payload) => {
  try {
    const res = await base44.functions.invoke(name, payload);
    return res?.data || {};
  } catch (error) {
    const message =
      error?.response?.data?.error ||
      error?.data?.error ||
      (typeof error?.message === 'string' && !error.message.includes('SDK Error') ? error.message : '') ||
      'The action was refused.';
    throw new Error(message);
  }
};

export async function createTask(payload) {
  const data = await invoke('taskWrite', { action: 'create', changes: payload });
  if (!data.task) throw new Error('The task could not be created.');
  return data.task;
}

export async function updateTask(id, changes, options = {}) {
  const data = await invoke('taskWrite', { action: 'update', id, changes });
  return data.task || null;
}

export const quickUpdateTask = (id, changes) => updateTask(id, changes);

export const archiveTask = (id) => invoke('taskWrite', { action: 'archive', id });

export const restoreTask = (id) => invoke('taskWrite', { action: 'restore', id });

/** One Villa Work activity across one, several or all active villas of a phase. */
export const createVillaWork = (payload) => invoke('villaWorkCreate', payload);

/** Baseline drafts, approval and rebaselining. */
export const runBaselineAction = (payload) => invoke('baselineAction', payload);