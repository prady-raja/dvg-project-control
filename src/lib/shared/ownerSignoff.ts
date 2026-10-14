/**
 * FRONTEND COPY of the owner sign-off helpers in base44/shared/ownerSignoff.ts — the
 * browser may not import from base44/. A parity test keeps the two in step.
 */
export const ACK_METHODS = ['Signed sheet (photo)', 'WhatsApp confirmation (screenshot)', 'Told to the engineer'];

/** Whether closing here must carry the owner's acknowledgement. */
export const needsAck = ({ location, project }) =>
  location?.possession_status === 'Handed Over' && project?.owner_signoff === 'Required';

/** signed | awaiting | not_needed — for a done item in a villa. */
export function signoffState(item, { location }: any = {}) {
  if (item?.owner_ack_date) return 'signed';
  if (location?.possession_status !== 'Handed Over') return 'not_needed';
  return 'awaiting';
}
