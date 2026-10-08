import { base44 } from '@/api/base44Client';

/**
 * Snags are written through their own guarded server function: it decides the
 * permission, issues the permanent SN- reference and never touches a task.
 */
async function call(payload) {
  try {
    const res = await base44.functions.invoke('snagWrite', payload);
    return res?.data || {};
  } catch (error) {
    const message =
      error?.response?.data?.error ||
      error?.data?.error ||
      (typeof error?.message === 'string' && !error.message.includes('SDK Error') ? error.message : '') ||
      'The snag change was refused.';
    throw new Error(message);
  }
}

export const createSnag = (snag) => call({ action: 'create', snag });

export const updateSnag = (id, snag) => call({ action: 'update', id, snag });

export const deleteSnag = (id) => call({ action: 'delete', id });