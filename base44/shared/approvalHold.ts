/**
 * Approval holds (Q-04 follow-up). Work that failed inspection cannot be approved
 * or closed until the failure is dealt with: a rejected task must be inspected
 * again, the latest checklist must not be a Fail, and snags raised against the
 * task must be closed. Pure rules; taskWrite applies them.
 */
const stamp = (c) => String(c?.created_date || c?.completed_date || '');

/** Why this task may not be approved or closed yet, or '' when nothing is holding it. */
export function approvalHold({ task, checklists = [], snags = [] } = {}) {
  if (task?.rework_pending === true) {
    return 'This work was sent back for rework. Start a new inspection once it is redone, then approve it.';
  }
  const latest = [...checklists].filter((c) => c && c.subject_type !== 'Snag').sort((a, b) => stamp(b).localeCompare(stamp(a)))[0];
  if (latest?.overall === 'Fail') {
    return 'The latest inspection checklist has failed items. Record a passing inspection, or reject the work for rework, before approving it.';
  }
  const open = snags.filter((s) => s && s.status !== 'Closed');
  if (open.length) {
    return `${open.length} snag${open.length === 1 ? ' is' : 's are'} still open against this task. Close ${open.length === 1 ? 'it' : 'them'} before approving the work.`;
  }
  return '';
}

/** Whether the person's copy of a record is still the current one. No version sent means no check. */
export function staleProblem(record, expectedVersion) {
  const expected = String(expectedVersion || '').trim();
  if (!expected) return '';
  return String(record?.updated_date || '') === expected
    ? ''
    : 'Someone else changed this task after you opened it. Reload it to see their change, then make yours again.';
}
