import { data } from '@/api/data';
import { chaseMessage, whatsappLink } from '@/lib/shared/constraints.ts';

/** Raise, change, chase and clear a blocker — always through the server, which keeps the task and the board in step. */
export const raiseBlocker = (payload) => data.invoke('constraintWrite', { action: 'raise', ...payload });
export const updateBlocker = (constraintId, patch) => data.invoke('constraintWrite', { action: 'update', constraint_id: constraintId, ...patch });
export const clearBlocker = (constraintId, nextStatus, note = '') =>
  data.invoke('constraintWrite', { action: 'clear', constraint_id: constraintId, next_status: nextStatus, note });
export const recordChase = (constraintId) => data.invoke('constraintWrite', { action: 'chase', constraint_id: constraintId });

/**
 * Chase a blocker on WhatsApp: the message is ready, addressed to the owner's
 * phone when one is on record. Without a number the text is copied to paste.
 */
export async function chaseOnWhatsApp({ row, phone }) {
  const link = typeof window !== 'undefined' ? `${window.location.origin}/tasks/${row.id}` : '';
  const message = chaseMessage({
    constraint: { ...row.constraint, category: row.constraint?.category || row.blocker_category, description: row.blocker, owner_name: row.constraint?.owner_name || row.blocker_responsible },
    task: { task_ref: row.ref, name: row.name },
    villa: row.villa,
    link,
  });
  if (row.constraint?.id) await recordChase(row.constraint.id).catch(() => {});
  const url = whatsappLink(phone, message);
  if (url) {
    window.open(url, '_blank', 'noopener');
    return { sent: true, copied: false };
  }
  try {
    await navigator.clipboard.writeText(message);
    return { sent: false, copied: true };
  } catch {
    return { sent: false, copied: false, message };
  }
}