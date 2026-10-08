/**
 * The rules that decide whether a change set may be applied to a task, and the
 * server-owned stamps that travel with it.
 *
 * They live here once because there is more than one way into a task: the full
 * editor and the daily site report. Both run through this module, so the
 * baseline lock and the separation of duties cannot drift apart between screens.
 */

import { canApproveWork, canManageProject } from './access.ts';
import { BASELINE_FIELDS } from './history.ts';
import { actorName, fail } from './records.ts';

/**
 * Throws when the caller may not make this change. `entries` are the genuinely
 * changed fields from diffFields, so an unchanged field never blocks a save.
 */
export function guardTaskChanges({ task, entries, rank, user, reason }) {
  const list = entries || [];
  const find = (field) => list.find((entry) => entry.field_changed === field);
  const manager = canManageProject(rank);

  if (find('archived') && !manager) {
    throw fail('Only a Project Manager or an administrator can archive or restore a task.', 403);
  }
  if ((find('project_id') || find('phase_id')) && !manager) {
    throw fail('Only a Project Manager or an administrator can move a task between phases.', 403);
  }

  const baselineEntry = list.find((entry) => BASELINE_FIELDS.includes(entry.field_changed));
  if (baselineEntry && !manager) {
    if (task.baseline_locked === true || task.baseline_approval_status === 'Approved') {
      throw fail(
        'This task is covered by an approved baseline. Only a Project Manager or an administrator can change baseline dates.',
        403,
      );
    }
  }

  const statusEntry = find('status');
  if (statusEntry) {
    const next = statusEntry.new_value;
    if (next === 'Approved' || next === 'Closed') {
      if (!canApproveWork(rank)) {
        throw fail('Only a Project Manager or an administrator can approve or close work.', 403);
      }
      if (task.execution_completed_by_id && task.execution_completed_by_id === user.id) {
        throw fail('You cannot approve or close work you marked Execution Complete yourself.', 403);
      }
    }
  }

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

/**
 * Who did what, stamped from the session and never from the browser: marking
 * work complete and approving it stay with different people.
 */
export function deriveTaskEffects({ task, entries, user }) {
  const patch = {};
  const derived = [];
  const statusEntry = (entries || []).find((entry) => entry.field_changed === 'status');
  if (!statusEntry) return { patch, derived };

  const next = statusEntry.new_value;
  if (next === 'Execution Complete' || next === 'Under Inspection') {
    patch.execution_completed_by_id = user.id;
    patch.execution_completed_by_name = actorName(user);
    derived.push({
      change_type: 'Status Change',
      field_changed: 'execution_completed_by',
      old_value: task.execution_completed_by_name || '',
      new_value: actorName(user),
      note: 'Marked Execution Complete',
    });
  } else if (next === 'Not Started' || next === 'In Progress' || next === 'Blocked') {
    if (task.execution_completed_by_id) {
      patch.execution_completed_by_id = null;
      patch.execution_completed_by_name = null;
      derived.push({
        change_type: 'Status Change',
        field_changed: 'execution_completed_by',
        old_value: task.execution_completed_by_name || '',
        new_value: '',
        note: 'Reopened — previous Execution Complete stamp cleared',
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