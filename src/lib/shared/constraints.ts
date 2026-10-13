/**
 * FRONTEND COPY of the blocker wording in base44/shared/constraints.ts — the
 * browser may not import from base44/, so the chase message and its WhatsApp link
 * live here too. Keep the two in step.
 */

/** Who must clear it, in words. */
export const ownerLabel = (constraint) =>
  constraint?.owner_name || (constraint?.owner_type === 'Villa owner' ? 'The villa owner' : constraint?.owner_type || 'Not assigned');

/** The message a coordinator sends to chase a blocker. */
export function chaseMessage({ constraint, task, villa = '', link = '' }) {
  const where = villa ? ` (${villa})` : '';
  const due = constraint?.due_date ? ` It was due to clear by ${constraint.due_date}.` : '';
  return [
    `Hello ${ownerLabel(constraint)} — a follow-up from DVG on ${task?.task_ref || 'a task'}${where}: ${task?.name || ''}.`,
    `It is on hold: ${constraint?.category}${constraint?.description ? ` — ${constraint.description}` : ''}.${due}`,
    'Could you tell us when this can be cleared?',
    link,
  ].filter(Boolean).join('\n');
}

/** A wa.me link with the message ready; without a phone number the caller copies the text instead. */
export function whatsappLink(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  const text = encodeURIComponent(message);
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${text}` : '';
}

/** Open and past its date. */
export const isPastDue = (constraint, asOf) => constraint?.status === 'Open' && !!constraint.due_date && constraint.due_date < asOf;