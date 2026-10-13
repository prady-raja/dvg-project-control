import { base44 } from '@/api/base44Client';

/**
 * One way to call a server function and one way to word its failure (R-01). Every
 * service module calls through here, never the SDK directly, so the move to another
 * backend changes this one file.
 */
export const messageFromError = (error, fallback = 'The action was refused.') =>
  error?.response?.data?.error
  || error?.data?.error
  || (typeof error?.message === 'string' && !error.message.includes('SDK Error') ? error.message : '')
  || fallback;

export async function invokeFn(name, payload, fallback) {
  try {
    const res = await base44.functions.invoke(name, payload);
    return res?.data || {};
  } catch (error) {
    throw new Error(messageFromError(error, fallback));
  }
}
