// Partly-finished import: rows this same file already wrote are recognised, nothing else is.
import { describe, expect, it } from 'vitest';
import { reconcileRows } from '../base44/shared/reconcile.ts';

const task = (over = {}) => ({ id: 't17', task_ref: 'IMG-B-0017', name: 'Plaster', project_id: 'p1', import_batch_id: 'b1', import_row_number: 4, ...over });
const prior = (over = {}) => ({ task_id: 't17', batch_id: 'b1', batch_ref: 'IMP-1', ...over });
const ctxFor = (tasks, alreadyImported) => ({
  project: { id: 'p1', name: 'P' }, tasks, locationCodeById: new Map(), contractors: [],
  dupIndex: { byNameDiscipline: new Map(), byName: new Map() }, alreadyImported,
});
const row = (over = {}) => ({
  row_number: 4, values: { name: 'Plaster' }, resolved: { name: 'Plaster' }, issues: [], blocking: false, duplicate: null, ...over,
});
const run = (r, tasks = [task()], map = new Map([[4, prior()]])) => reconcileRows({ rows: [r], ctx: ctxFor(tasks, map) }).rows[0].reconcile;

describe('already imported', () => {
  it('is UNCHANGED with task reference and batch when everything lines up', () => {
    const rec = run(row({ duplicate: { task_id: 't17', task_ref: 'IMG-B-0017', confidence: 'confident', others: [] } }));
    expect(rec.outcome).toBe('unchanged');
    expect(rec.match).toMatchObject({ task_ref: 'IMG-B-0017', batch_id: 'b1', batch_ref: 'IMP-1', via: 'already_imported' });
  });
  it('stays a duplicate when the row repeats another row in the file', () => {
    const issues = [{ severity: 'warning', code: 'duplicate_in_file', message: 'x' }];
    const rec = run(row({ issues, duplicate: { task_id: 't17', task_ref: 'IMG-B-0017', confidence: 'confident', others: [] } }));
    expect(rec.outcome).toBe('duplicate');
  });
  it('stays a duplicate when matched to a different (older) task', () => {
    const rec = run(row({ duplicate: { task_id: 'old', task_ref: 'IMG-A-0001', confidence: 'confident', others: [] } }), [task(), task({ id: 'old', task_ref: 'IMG-A-0001', import_batch_id: 'b0' })]);
    expect(rec.outcome).toBe('duplicate');
  });
  it('is not recognised without a row/batch record, for another row, or when ambiguous', () => {
    expect(run(row(), [task()], new Map()).outcome).not.toBe('unchanged');
    expect(run(row({ row_number: 7 })).outcome).not.toBe('unchanged');
    expect(run(row(), [task()], new Map([[4, prior({ ambiguous: true })]])).outcome).not.toBe('unchanged');
  });
  it('is not recognised when a field differs from the task', () => {
    const r = row({ values: { name: 'Plaster', status: 'Completed' }, resolved: { name: 'Plaster', status_value: 'Completed' } });
    expect(run(r, [task({ status: 'Not Started' })]).outcome).not.toBe('unchanged');
  });
  it('says so when the same row was written earlier but no longer matches exactly', () => {
    const r = row({ values: { name: 'Plaster', status: 'Completed' }, resolved: { name: 'Plaster', status_value: 'Completed' }, duplicate: { task_id: 't17', task_ref: 'IMG-B-0017', confidence: 'confident', others: [] } });
    const rec = run(r, [task({ status: 'Not Started' })]);
    expect(rec.match.written_earlier).toMatchObject({ task_ref: 'IMG-B-0017', batch_ref: 'IMP-1', changed: ['Status'] });
  });
  it('does not flag a similar task from another file', () => {
    const rec = run(row({ duplicate: { task_id: 'old', task_ref: 'IMG-A-0001', confidence: 'possible', others: [] } }), [task(), task({ id: 'old', task_ref: 'IMG-A-0001', import_batch_id: 'b0', import_row_number: 9 })], new Map());
    expect(rec.match.written_earlier).toBeUndefined();
  });
});
