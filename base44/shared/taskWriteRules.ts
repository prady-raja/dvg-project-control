/**
 * The rules that decide whether a change set may be applied to a task, and the
 * server-owned stamps that travel with it.
 *
 * They live here once because there is more than one way into a task: the full
 * editor, the daily site report, a confirmed AI update and an import
 * reconciliation all run through this module, so the baseline lock, the status
 * sequence, the blocker requirements and the separation of duties cannot drift
 * apart between screens.
 */

import { canApproveWork, canManageProject } from './access.ts';
import { BASELINE_FIELDS } from './history.ts';
import { actorName, fail } from './records.ts';

export const TASK_STATUSES = [
  'Not Started', 'In Progress', 'Blocked', 'Execution Complete', 'Under Inspection', 'Approved', 'Closed',
];

export const BLOCKER_CATEGORIES = [
  'Previous Work Incomplete', 'Materials Pending', 'Client Selection Pending', 'Owner Access Pending',
  'Drawing / Design Clarification', 'Contractor Manpower', 'DVG Approval', 'External Utility / Authority', 'Other',
];

/** Every task starts here. Completion, inspection, approval and closure are recorded on the task. */
export const OPENING_STATUSES = ['Not Started', 'In Progress', 'Blocked'];

/** Work may only be approved from one of these, and closed from these or Approved. */
export const APPROVABLE_FROM = ['Execution Complete', 'Under Inspection'];
export const CLOSABLE_FROM = ['Approved', 'Execution Complete', 'Under Inspection'];

/**
 * A source work list saying any of these means the work is *reported* as done.
 * It is never an approval, and it is never attributed to whoever imported it.
 */
export const REPORTED_COMPLETE_STATUSES = ['Execution Complete', 'Under Inspection', 'Approved', 'Closed'];

/** A file or a model may not move work into these by itself. */
export const FILE_FORBIDDEN_STATUSES = ['Under Inspection', 'Approved', 'Closed'];

/** The status a reported-complete record takes on the register until it is verified. */
export const REPORTED_COMPLETE_STATUS = 'Execution Complete';

export const COMPLETION_NOTE = 'Imported as complete — needs verification';

const IST_OFFSET_MINUTES = 330;

/** The server's own date in Asia/Kolkata — never the browser's. */
export const todayIst = () => new Date(Date.now() + IST_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);

const entryFor = (entries, field) => (entries || []).find((entry) => entry.field_changed === field);

/* --------------------------------------------------------------- 1. baselines */

/**
 * An approved baseline is frozen for every role, including an application
 * administrator. The only way a frozen date moves is the baseline revision
 * workflow, which carries a reason, records the previous dates and goes through
 * approval — so a single screen can never rewrite a committed programme.
 */
function guardBaseline(task, entries) {
  const entry = BASELINE_FIELDS.map((field) => entryFor(entries, field)).find(Boolean);
  if (!entry) return;
  const frozen = task
    && (task.baseline_locked === true || task.baseline_approval_status === 'Approved');
  if (!frozen) return;
  throw fail(
    'These dates sit under an approved baseline, so they cannot be changed here — not even by an administrator. '
      + 'Revise the baseline through the baseline revision workflow, where the change carries a reason, records the '
      + 'previous dates and is approved before it takes effect.',
    403,
  );
}

/* ------------------------------------------------------------ 2. the sequence */

/**
 * The operational sequence: work is completed by one person, inspected, then
 * approved or closed by another. Nothing may jump straight to Approved or
 * Closed, and a new task cannot be born already approved.
 */
function guardStatusSequence(task, entries, { isCreate } = {}) {
  const entry = entryFor(entries, 'status');
  const next = String((entry ? entry.new_value : task && task.status) || 'Not Started');

  if (isCreate) {
    if (!OPENING_STATUSES.includes(next)) {
      throw fail(
        `A new task starts as ${OPENING_STATUSES.join(', ')}. Completion, inspection, approval and closure are recorded `
          + 'on the task as the work progresses, so that who completed the work and who approved it stay separate.',
      );
    }
    return;
  }

  if (!entry) return;
  const current = String(task && task.status ? task.status : 'Not Started');
  if (next === current) return;

  if (next === 'Approved' && !APPROVABLE_FROM.includes(current)) {
    throw fail(
      `Work can only be approved from ${APPROVABLE_FROM.join(' or ')} — this task is ${current}. `
        + 'Record the completion first, with the person who completed it, and then approve it.',
    );
  }
  if (next === 'Closed' && !CLOSABLE_FROM.includes(current)) {
    throw fail(
      `Work can only be closed from ${CLOSABLE_FROM.join(', ')} — this task is ${current}. `
        + 'Record the completion first, and the approval, and then close it.',
    );
  }
}

/* ------------------------------------------------- 3. who may approve, and who */

/**
 * Approval and closure stay with an authorised person, and never with the person
 * who completed the work — or, for an imported completion, with the person who
 * verified that reported completion.
 */
function guardApproval({ task, entries, rank, user }) {
  const entry = entryFor(entries, 'status');
  if (!entry || !['Approved', 'Closed'].includes(String(entry.new_value || ''))) return;

  if (!canApproveWork(rank)) {
    throw fail('Only a Project Editor or an administrator can approve or close work.', 403);
  }
  if (task && task.needs_completion_verification === true) {
    throw fail(
      'This completion was reported in an imported file and has not been verified yet. An authorised person verifies the '
        + 'reported completion first — and then a different authorised person approves or closes it.',
      403,
    );
  }
  if (task && task.execution_completed_by_id && task.execution_completed_by_id === user.id) {
    throw fail('You cannot approve or close work you marked Execution Complete yourself.', 403);
  }
  if (task && task.completion_verified_by_id && task.completion_verified_by_id === user.id) {
    throw fail(
      'You verified this reported completion, so a different authorised person must approve or close it.',
      403,
    );
  }
}

/* ------------------------------------------------------------- 4. blocked work */

/**
 * One rule for every path that can put a task into Blocked, or leave it there:
 * `taskWrite`, the daily report, a confirmed AI update and an import
 * reconciliation all call this. A blocked task always says what is holding it up
 * and since when, the original date is kept while it stays blocked, and the
 * blocker is cleared when the work moves on.
 */
export function blockedStateFor({ task, next = {}, isCreate = false }) {
  const statusGiven = next.status !== undefined && next.status !== null && next.status !== '';
  let status = String(
    statusGiven
      ? next.status
      : (isCreate ? 'Not Started' : (task && task.status) || 'Not Started'),
  );
  const has = (field) => Object.prototype.hasOwnProperty.call(next, field);
  const valueOf = (field) => (has(field) ? next[field] : (task ? task[field] : null));

  // A newly recorded blocker means the work is blocked: on open work it moves the
  // task to Blocked (with blocked_since) rather than being stored on a task that
  // still reads In Progress. Moving a Blocked task on to another status still
  // clears it below.
  const newCategory = has('blocker_category') && String(next.blocker_category || '').trim()
    && next.blocker_category !== (task ? task.blocker_category : null);
  const leavingBlocked = statusGiven && status !== 'Blocked' && task && task.status === 'Blocked';
  const impliedBlocked = newCategory && !leavingBlocked && OPENING_STATUSES.includes(status) && status !== 'Blocked';
  if (impliedBlocked) status = 'Blocked';

  if (status !== 'Blocked') {
    const wasBlocked = task && (task.status === 'Blocked' || task.blocked_since);
    if (!wasBlocked) return { patch: {}, cleared: [] };
    // Leaving Blocked clears the active blocker, and the audit trail keeps what
    // it was: the fields are set to blank and recorded as changes.
    return {
      patch: {
        blocker_category: null,
        blocker_description: null,
        blocker_responsible_party: null,
        blocked_since: null,
      },
      cleared: ['blocker category', 'blocker description', 'responsible party', 'blocked since'],
    };
  }

  const category = valueOf('blocker_category');
  const description = valueOf('blocker_description');

  if (!isCreate && (next.blocker_category === null || next.blocker_description === null)) {
    throw fail(
      'A blocked task keeps its blocker category and its description. Clearing them while the task stays Blocked '
        + 'contradicts the status — move the task to In Progress instead, which clears them and keeps the history.',
    );
  }
  if (!BLOCKER_CATEGORIES.includes(String(category || ''))) {
    throw fail(`A blocked task needs a blocker category. Choose one of: ${BLOCKER_CATEGORIES.join(', ')}.`);
  }
  if (!String(description || '').trim()) {
    throw fail('A blocked task needs a description of what is holding the work up.');
  }

  // The date the work was first blocked is set once and kept: editing an
  // already-blocked task never restarts the clock.
  const alreadyBlocked = task && task.status === 'Blocked' && task.blocked_since;
  const patch = { blocked_since: alreadyBlocked ? task.blocked_since : todayIst() };
  if (impliedBlocked) patch.status = 'Blocked';
  return { patch, cleared: [] };
}

/* ----------------------------------------------------------------- the guards */

/**
 * Throws when the caller may not make this change. `entries` are the genuinely
 * changed fields from diffFields, so an unchanged field never blocks a save.
 */
export function guardTaskChanges({ task, entries, rank, user, reason }) {
  const list = entries || [];
  const find = (field) => entryFor(list, field);
  const manager = canManageProject(rank);

  if (find('archived') && !manager) {
    throw fail('Only a Project Manager or an administrator can archive or restore a task.', 403);
  }
  if ((find('project_id') || find('phase_id')) && !manager) {
    throw fail('Only a Project Manager or an administrator can move a task between phases.', 403);
  }

  guardBaseline(task, list);
  guardStatusSequence(task, list);
  guardApproval({ task, entries: list, rank, user });

  const progressEntry = find('progress_percent');
  if (progressEntry && progressEntry.new_value !== null) {
    const value = Number(progressEntry.new_value);
    if (Number.isNaN(value) || value < 0 || value > 100) throw fail('Progress must be between 0 and 100.');
  }

  // A reason must accompany THIS revision — one recorded earlier does not
  // authorise a later date change.
  if (find('current_forecast_finish') && !String(reason || '').trim()) {
    throw fail('A forecast date change needs a date revision reason.');
  }
}

/** A new task may not be born completed, approved or closed. */
export function guardTaskCreation({ changes }) {
  const status = String((changes && changes.status) || 'Not Started');
  guardStatusSequence(null, [{ field_changed: 'status', old_value: null, new_value: status }], { isCreate: true });
  blockedStateFor({ task: null, next: changes || {}, isCreate: true });
}

/* ----------------------------------------------------- who did what, stamped */

/**
 * Who did what, stamped from the session and never from the browser: marking
 * work complete and approving it stay with different people, inspection never
 * replaces who completed the work, and reopening clears the stamps while the
 * history keeps them.
 *
 * `importedCompletion` is set when a source file reported the work done: nobody
 * in the session claims to have done it, so no completion actor is recorded and
 * the completion waits to be verified.
 */
export function deriveTaskEffects({ task, entries, user, importedCompletion = false }) {
  const patch = {};
  const derived = [];
  const statusEntry = entryFor(entries, 'status');
  if (!statusEntry) return { patch, derived };

  const next = statusEntry.new_value;

  if (next === 'Execution Complete') {
    if (importedCompletion) {
      patch.execution_completed_by_id = null;
      patch.execution_completed_by_name = null;
      patch.needs_completion_verification = true;
      derived.push({
        change_type: 'Status Change',
        field_changed: 'execution_completed_by',
        old_value: task.execution_completed_by_name || '',
        new_value: '',
        note: `${COMPLETION_NOTE} — the file reports the work done, so no completion actor is recorded and approval waits for verification`,
      });
    } else {
      patch.execution_completed_by_id = user.id;
      patch.execution_completed_by_name = actorName(user);
      patch.needs_completion_verification = false;
      derived.push({
        change_type: 'Status Change',
        field_changed: 'execution_completed_by',
        old_value: task.execution_completed_by_name || '',
        new_value: actorName(user),
        note: 'Marked Execution Complete',
      });
    }
  } else if (next === 'Under Inspection') {
    // Inspection is a separate step: it never replaces who completed the work.
    if (!task.execution_completed_by_id) {
      if (importedCompletion) {
        patch.needs_completion_verification = true;
        derived.push({
          change_type: 'Status Change',
          field_changed: 'execution_completed_by',
          old_value: '',
          new_value: '',
          note: `${COMPLETION_NOTE} — no completion actor is recorded`,
        });
      } else {
        patch.execution_completed_by_id = user.id;
        patch.execution_completed_by_name = actorName(user);
        derived.push({
          change_type: 'Status Change',
          field_changed: 'execution_completed_by',
          old_value: '',
          new_value: actorName(user),
          note: 'Completion recorded on entering inspection',
        });
      }
    }
  } else if (next === 'Not Started' || next === 'In Progress' || next === 'Blocked') {
    if (task.execution_completed_by_id || task.needs_completion_verification === true) {
      patch.execution_completed_by_id = null;
      patch.execution_completed_by_name = null;
      patch.needs_completion_verification = false;
      patch.completion_verified_by_id = null;
      patch.completion_verified_by_name = null;
      patch.completion_verified_at = null;
      derived.push({
        change_type: 'Status Change',
        field_changed: 'execution_completed_by',
        old_value: task.execution_completed_by_name || '',
        new_value: '',
        note: 'Reopened — the completion stamp and any verification are cleared, and the history keeps them',
      });
    }
    if (task.approved_by_id || task.approved_at) {
      patch.approved_by_id = null;
      patch.approved_by_name = null;
      patch.approved_at = null;
      derived.push({
        change_type: 'Approval',
        field_changed: 'approved_by',
        old_value: task.approved_by_name || '',
        new_value: '',
        note: 'Reopened — the approval stamp is cleared, and the history keeps it',
      });
    }
  } else if (next === 'Approved' || next === 'Closed') {
    patch.approved_by_id = user.id;
    patch.approved_by_name = actorName(user);
    patch.approved_at = new Date().toISOString();
    derived.push({
      change_type: 'Approval',
      field_changed: 'approved_by',
      old_value: task.approved_by_name || '',
      new_value: actorName(user),
      note: next === 'Closed' ? 'Work closed' : 'Work approved',
    });
  }
  // Progress reaching 100% never closes a task: no derived status change here.

  return { patch, derived };
}