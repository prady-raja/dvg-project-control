import { invokeFn } from '@/lib/invokeFn';

/**
 * Snags are written through their own guarded server function: it decides the
 * permission, issues the permanent SN- reference and never touches a task.
 */
const call = (payload) => invokeFn('snagWrite', payload, 'The snag change was refused.');

export const createSnag = (snag) => call({ action: 'create', snag });

export const updateSnag = (id, snag) => {
  // The owner's acknowledgement travels beside the change, not inside it (Q-08).
  const { owner_ack: ownerAck, ...rest } = snag;
  return call({ action: 'update', id, snag: rest, ...(ownerAck ? { owner_ack: ownerAck } : {}) });
};

export const deleteSnag = (id) => call({ action: 'delete', id });