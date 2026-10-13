/**
 * FRONTEND COPY of the attention list in base44/shared/attention.ts — the browser
 * may not import from base44/, so the codes and their wording live here too.
 * Keep the two in step.
 */

export const ATTENTION_CODES = {
  scope_unclear: { label: 'Room/area scope not stated', severity: 'incomplete' },
  no_contractor: { label: 'No contractor assigned', severity: 'incomplete' },
  no_coordinator: { label: 'No responsible DVG coordinator', severity: 'incomplete' },
  no_dates: { label: 'No baseline or forecast date', severity: 'incomplete' },
  progress_unknown: { label: 'Progress not measured', severity: 'incomplete' },
  stale_update: { label: 'No site update for too long', severity: 'incomplete' },
  unverified_complete: { label: 'Executed but not verified', severity: 'incomplete' },
  incomplete_predecessor: { label: 'A recorded predecessor is not closed', severity: 'incomplete' },
  possible_duplicate: { label: 'Possibly the same work listed twice', severity: 'invalid' },
  ambiguous_reference: { label: 'Ambiguous villa or plot reference', severity: 'invalid' },
  room_register_missing: { label: 'Villa has no rooms registered', severity: 'incomplete' },
  completed_with_open_work: { label: 'Villa marked Works Completed but work is still open', severity: 'invalid' },
  unassigned_location: { label: 'Villa work with no villa recorded', severity: 'invalid' },
};