import { invokeFn } from '@/lib/invokeFn';

/**
 * Every task write goes through the server, which decides permission from the
 * signed-in session and records the change history. The interface never writes
 * a task record directly.
 */

const invoke = (name, payload) => invokeFn(name, payload, 'The action was refused.');

export async function createTask(payload) {
  const data = await invoke('taskWrite', { action: 'create', changes: payload });
  if (!data.task) throw new Error('The task could not be created.');
  return data.task;
}

export async function updateTask(id, changes, options = {}) {
  // The owner's acknowledgement (Q-08) and a rejection for rework (Q-04) travel beside the change, not inside it, and so does the version the person opened (R-03): if someone else changed the task since, the server refuses with a clear message.
  const { owner_ack: ownerAck, rejection, expected_version: expectedVersion, ...rest } = changes;
  const data = await invoke('taskWrite', { action: 'update', id, changes: rest, ...(ownerAck ? { owner_ack: ownerAck } : {}), ...(rejection ? { rejection } : {}), ...(expectedVersion ? { expected_version: expectedVersion } : {}) });
  return data.task || null;
}

export const quickUpdateTask = (id, changes) => updateTask(id, changes);

export const archiveTask = (id) => invoke('taskWrite', { action: 'archive', id });

export const restoreTask = (id) => invoke('taskWrite', { action: 'restore', id });

/** One Villa Work activity across one, several or all active villas of a phase. */
export const createVillaWork = (payload) => invoke('villaWorkCreate', payload);

/** Baseline drafts, approval and rebaselining. */
export const runBaselineAction = (payload) => invoke('baselineAction', payload);