/**
 * Owner sign-off (Q-08). In a handed-over villa, closing a work item or a snag on
 * DVG's word alone leaves nothing to show in a dispute, so the owner's
 * acknowledgement — who, when and how — is recorded with it. A project can make
 * this required or optional. Pure rules; the write functions apply them.
 */
import { fail } from './records.ts';

export const ACK_METHODS = ['Signed sheet (photo)', 'WhatsApp confirmation (screenshot)', 'Told to the engineer'];
const NEEDS_EVIDENCE = ['Signed sheet (photo)', 'WhatsApp confirmation (screenshot)'];
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const clean = (v, max) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

/** Whether closing here must carry the owner's acknowledgement. */
export const needsAck = ({ location, project }) =>
  location?.possession_status === 'Handed Over' && project?.owner_signoff === 'Required';

/** What a person entered, checked and tidied into the stored fields. */
export function ackInput(input = {}, { today = '' } = {}) {
  const name = clean(input?.name, 160);
  if (!name) throw fail("Enter the owner's name — the person who accepted the work.");
  const date = clean(input?.date, 10);
  if (!isDay(date)) throw fail('Enter the date the owner accepted it.');
  if (today && date > today) throw fail('The acknowledgement cannot be dated in the future.');
  const method = clean(input?.method, 60);
  if (!ACK_METHODS.includes(method)) throw fail(`Say how it was acknowledged: ${ACK_METHODS.join(', ')}.`);
  const evidence = clean(input?.evidence_uri, 500);
  if (NEEDS_EVIDENCE.includes(method) && !evidence) throw fail('Attach the photo or screenshot that shows it.');
  return { owner_ack_name: name, owner_ack_date: date, owner_ack_method: method, owner_ack_evidence_uri: evidence || null };
}

/** signed | awaiting | not_needed — for a done item in a villa. */
export function signoffState(item, { location } = {}) {
  if (item?.owner_ack_date) return 'signed';
  if (location?.possession_status !== 'Handed Over') return 'not_needed';
  return 'awaiting';
}

export const ACK_FIELDS = ['owner_ack_name', 'owner_ack_date', 'owner_ack_method', 'owner_ack_evidence_uri', 'owner_ack_by_name'];
