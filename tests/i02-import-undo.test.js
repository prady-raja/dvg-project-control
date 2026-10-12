// I-02 — import history and one-click undo.
import { describe, expect, it } from 'vitest';
import { planUndo, undoSummary } from '../base44/shared/importUndo.ts';

const batch = (over = {}) => ({
  status: 'Completed', imported_at: '2026-10-12T10:00:00Z', updated_date: '2026-10-12T10:05:00Z',
  report: [
    { row_number: 2, outcome: 'created', task_id: 'c1', task_ref: 'IMG-0001', name: 'New work' },
    { row_number: 3, outcome: 'created', task_id: 'c2', task_ref: 'IMG-0002', name: 'Edited later' },
    { row_number: 4, outcome: 'updated', task_id: 'u1', task_ref: 'IMG-0003', changed: [
      { field: 'status', from: 'Not Started', to: 'In Progress' },
      { field: 'progress_percent', from: null, to: 40 },
      { field: 'actual_start', from: null, to: '2026-10-12', derived: true },
    ] },
    { row_number: 5, outcome: 'updated', task_id: 'u2', task_ref: 'IMG-0004', changed: [{ field: 'baseline_finish', from: '2026-10-01', to: '2026-10-09' }] },
    { row_number: 6, outcome: 'rejected', name: 'Not written' },
    { row_number: 7, outcome: 'unchanged', task_id: 'x1' },
  ],
  ...over,
});
const task = (id, over = {}) => ({ id, updated_date: '2026-10-12T10:04:00Z', ...over });
const tasks = (list) => new Map(list.map((t) => [t.id, t]));

describe('I-02 undo plan', () => {
  it('archives what the batch created and puts back what it changed', () => {
    const plan = planUndo({ batch: batch(), tasksById: tasks([task('c1'), task('c2'), task('u1'), task('u2')]) });
    expect(plan.archive.map((a) => a.task_id)).toEqual(['c1', 'c2']);
    const revert = plan.revert.find((r) => r.task_id === 'u1');
    expect(revert.patch).toEqual({ actual_start: null, progress_percent: null, status: 'Not Started' });
    expect(plan.nothing).toBe(2); // rejected + unchanged rows wrote nothing
  });

  it('leaves alone any task edited since the import, and says so', () => {
    const plan = planUndo({ batch: batch(), tasksById: tasks([task('c1'), task('c2', { updated_date: '2026-10-13T08:00:00Z' }), task('u1', { updated_date: '2026-10-14T00:00:00Z' }), task('u2')]) });
    expect(plan.archive.map((a) => a.task_id)).toEqual(['c1']);
    expect(plan.skipped.map((s) => s.task_id).sort()).toEqual(['c2', 'u1']);
    expect(plan.skipped.every((s) => /since/i.test(s.reason))).toBe(true);
  });

  it('never reverts baseline dates frozen under an approved baseline', () => {
    const plan = planUndo({ batch: batch(), tasksById: tasks([task('c1'), task('c2'), task('u1'), task('u2', { baseline_locked: true })]) });
    expect(plan.revert.find((r) => r.task_id === 'u2')).toBeUndefined();
    expect(plan.skipped.find((s) => s.task_id === 'u2').reason).toMatch(/frozen/i);
  });

  it('skips tasks that are gone or already archived', () => {
    const plan = planUndo({ batch: batch(), tasksById: tasks([task('c1', { archived: true }), task('u1'), task('u2')]) });
    expect(plan.skipped.find((s) => s.task_id === 'c1').reason).toMatch(/archived/i);
    expect(plan.skipped.find((s) => s.task_id === 'c2').reason).toMatch(/no longer exists/i);
  });

  it('refuses a batch that is running, already undone or missing', () => {
    expect(planUndo({ batch: batch({ status: 'Undone' }), tasksById: tasks([]) }).error).toMatch(/already been undone/);
    expect(planUndo({ batch: batch({ status: 'Importing' }), tasksById: tasks([]) }).error).toMatch(/still running/);
    expect(planUndo({ batch: null, tasksById: tasks([]) }).error).toMatch(/not found/);
  });

  it('summarises for the confirmation screen', () => {
    const plan = planUndo({ batch: batch(), tasksById: tasks([task('c1'), task('c2'), task('u1'), task('u2')]) });
    expect(undoSummary(plan)).toEqual({ archive: 2, revert: 2, skipped: 0, nothing_to_undo: 2 });
  });
});
