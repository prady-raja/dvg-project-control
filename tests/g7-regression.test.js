// G7 — the earlier rule tests, kept in one place so nothing slips back.
import { describe, expect, it } from 'vitest';
import { APP_ADMIN_RANK } from '../base44/shared/enums.ts';
import { diffFields } from '../base44/shared/history.ts';
import { blockedStateFor, guardTaskChanges } from '../base44/shared/taskWriteRules.ts';
import { readImportFile, validateImportRows, looseKey } from '../base44/shared/workImport.ts';
import { buildVillaIndex } from '../base44/shared/villaResolve.ts';
import { entitySchema } from './helpers/jsonc.js';

const admin = { id: 'a1', full_name: 'Admin' };

describe('G7 server rules still hold', () => {
  it('an approved baseline cannot be edited, not even by an administrator', () => {
    const task = { id: 't', status: 'In Progress', baseline_locked: true, baseline_approval_status: 'Approved', baseline_finish: '2026-02-01' };
    const entries = diffFields(task, { baseline_finish: '2026-03-01' });
    expect(() => guardTaskChanges({ task, entries, rank: APP_ADMIN_RANK, user: admin })).toThrow(/baseline/i);
  });

  it('In Progress cannot jump to Approved', () => {
    const task = { id: 't', status: 'In Progress' };
    const entries = diffFields(task, { status: 'Approved' });
    expect(() => guardTaskChanges({ task, entries, rank: APP_ADMIN_RANK, user: admin })).toThrow();
  });

  it('Blocked without a category is refused', () => {
    expect(() => blockedStateFor({ task: { status: 'In Progress' }, next: { status: 'Blocked' } })).toThrow(/blocker/i);
    expect(() => blockedStateFor({ task: { status: 'In Progress' }, next: { status: 'Blocked', blocker_description: 'x' } })).toThrow();
  });

  it('the person who completed the work cannot approve it', () => {
    const task = { id: 't', status: 'Execution Complete', execution_completed_by_id: 'a1' };
    const entries = diffFields(task, { status: 'Approved' });
    expect(() => guardTaskChanges({ task, entries, rank: 2, user: admin })).toThrow(/cannot approve or close work you/);
  });

  it('a Task cannot be deleted from the browser: delete is server-only', () => {
    const rls = entitySchema('Task').rls;
    expect(rls.delete.user_condition.role).toBe('server-only');
    expect(rls.create.user_condition.role).toBe('server-only');
    expect(rls.update.user_condition.role).toBe('server-only');
  });
});

describe('G7 an imported "Completed" row becomes Execution Complete, never Approved', () => {
  const locations = [{ id: 'v1', project_id: 'p', phase_id: 'ph', villa_code: 'B-01', location_type: 'Villa', plot_numbers: 'Plot 1' }];
  const villaIndex = buildVillaIndex(locations);
  const ctx = {
    project: { id: 'p', name: 'Imagine Villas', code: 'IMG' },
    phases: [{ id: 'ph', project_id: 'p', name: 'Phase B', code: 'B' }],
    locations,
    villaIndex,
    index: { byCode: villaIndex.byCode, byLoose: villaIndex.byLoose, plots: villaIndex.plots },
    phaseLabel: () => 'B',
    phaseById: new Map([['ph', { id: 'ph', project_id: 'p', name: 'Phase B', code: 'B' }]]),
    areas: [], floors: [], disciplines: [{ id: 'd', code: 'FIN', name: 'Finishes', active: true }], contractors: [{ id: 'c', name: 'Sharma' }],
    defaults: [], packages: [], tasks: [],
    locationCodeById: new Map([['v1', 'B-01']]),
    dupIndex: { byFileRow: new Map(), bySource: new Map(), byNameDiscipline: new Map(), byNameAreaDiscipline: new Map(), byName: new Map() },
  };
  const csv = 'Phase,Villa/location code,Work category,Discipline,Task description,Contractor,Status\nB,B-01,Villa Work,FIN,Paint the living room,Sharma,Completed\n';

  it('reads the word and maps it to the operational status', () => {
    const file = readImportFile(csv);
    expect(file.rows).toHaveLength(1);
    const out = validateImportRows({ rows: file.rows, ctx, fileName: 'test.csv' });
    const row = out.rows[0];
    expect(row.blocking).toBe(false);
    expect(row.resolved.status_value).toBe('Execution Complete');
    expect(row.resolved.source_status_text).toBe('Completed'); // the file's own word is kept as provenance
    expect(row.task.status).toBe('Execution Complete');
    expect(looseKey(row.task.status)).not.toBe('approved');
    expect(row.task.approved_by_id).toBeUndefined();
  });
});
