/**
 * Blockers as records with an owner and a date (F-02). Pure helpers: validate what
 * a person entered, and word the WhatsApp chase. The task's own blocker fields
 * stay as a summary, set by the shared blockedStateFor rule, so every board keeps
 * reading the same facts.
 */
import { BLOCKER_CATEGORIES, CONSTRAINT_OWNER_TYPES, defaultOwnerTypeFor } from './enums.ts';
import { fail } from './records.ts';

const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const clean = (value, max) => String(value === null || value === undefined ? '' : value).trim().slice(0, max);

/** What a person typed into the Block sheet, checked and completed. */
export function constraintInput(input = {}, { today = '' } = {}) {
  const category = clean(input.category, 60);
  if (!BLOCKER_CATEGORIES.includes(category)) throw fail(`Choose a blocker category: ${BLOCKER_CATEGORIES.join(', ')}.`);
  const description = clean(input.description, 1000);
  if (!description) throw fail('Say what is holding the work up.');
  const ownerType = CONSTRAINT_OWNER_TYPES.includes(input.owner_type) ? input.owner_type : defaultOwnerTypeFor(category);
  const due = clean(input.due_date, 10);
  if (due && !isDay(due)) throw fail('The date it should clear by must be a real date.');
  if (due && today && due < today) throw fail('The date it should clear by cannot be in the past.');
  return {
    category,
    description,
    owner_type: ownerType,
    owner_id: clean(input.owner_id, 80) || null,
    owner_name: clean(input.owner_name, 160) || null,
    due_date: due || null,
  };
}

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

/**
 * When a task leaves Blocked by any route (a daily report, the editor), its open
 * blocker record is closed too, so the Blocker board and the task never disagree.
 */
export async function clearOpenConstraints(svc, task, { userName = '', nextStatus = '' } = {}) {
  if (!svc?.TaskConstraint || task?.status !== 'Blocked' || nextStatus === 'Blocked' || !nextStatus) return 0;
  const found = await svc.TaskConstraint.filter({ task_id: task.id, status: 'Open' }, { limit: 20 });
  const open = Array.isArray(found) ? found : found?.items || [];
  for (const row of open) {
    await svc.TaskConstraint.update(row.id, {
      status: 'Cleared', cleared_at: new Date().toISOString(), cleared_by_name: userName, clear_note: `Task moved to ${nextStatus}`,
    });
  }
  return open.length;
}

/** Open and past its date. */
export const isPastDue = (constraint, asOf) => constraint?.status === 'Open' && !!constraint.due_date && constraint.due_date < asOf;
