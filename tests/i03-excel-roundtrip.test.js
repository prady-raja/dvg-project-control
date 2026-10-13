import { describe, expect, it } from 'vitest';
import { registerRows } from '@/lib/registerExport';
import { IMPORT_COLUMNS, IMPORT_TEMPLATE_HEADERS } from '../base44/shared/workImport.ts';
import { reconcileRows } from '../base44/shared/reconcile.ts';

const cat = {
  projectById: () => ({ name: 'Imagine' }), phaseById: () => ({ name: 'Phase A' }),
  locationById: (id) => (id === 'v1' ? { villa_code: 'B-05' } : null), contractorById: () => ({ name: 'Sharma Tiling' }),
};
const task = { id: 't1', task_ref: 'T-0001', project_id: 'p', phase_id: 'ph', location_id: 'v1', name: 'Tile kitchen', discipline: 'TIL', status: 'In Progress', progress_percent: 40, updated_date: '2026-03-10T10:00:00Z', area_label: 'Ground · Kitchen' };

describe('export in the import template', () => {
  const { headers, rows } = registerRows([task, { ...task, id: 't2', is_villa_work_parent: true }, { ...task, id: 't3', archived: true }], cat);
  it('has the template headers plus the hidden stamp, and only real work', () => {
    expect(headers).toEqual(IMPORT_COLUMNS.map((c) => c.label));
    expect(headers).toContain('Last updated (do not edit)');
    expect(rows).toHaveLength(1);
  });
  it('names the task and when it was last updated', () => {
    const row = Object.fromEntries(headers.map((h, i) => [h, rows[0][i]]));
    expect(row['Task reference']).toBe('T-0001');
    expect(row['Last updated (do not edit)']).toBe('2026-03-10T10:00:00Z');
    expect(row['Villa/location code']).toBe('B-05');
    expect(row['Contractor']).toBe('Sharma Tiling');
  });
  it('leaves floor and room blank so the sheet never proposes a scope change', () => {
    const row = Object.fromEntries(headers.map((h, i) => [h, rows[0][i]]));
    expect(row['Floor']).toBe('');
    expect(row['Area/Room']).toBe('');
  });
  it('the new-work template does not carry the stamp column', () => expect(IMPORT_TEMPLATE_HEADERS).not.toContain('Last updated (do not edit)'));
});

describe('a row changed after the export is held for a decision', () => {
  const mk = (exported_at, updated_date) => {
    const ctx = { tasks: [{ ...task, updated_date }], project: { name: 'Imagine' }, locationCodeById: new Map([['v1', 'B-05']]), contractors: [], dupIndex: { byNameDiscipline: new Map(), byName: new Map() } };
    const row = { row_number: 2, values: { task_ref: 'T-0001', status: 'Execution Complete', exported_at }, resolved: { status: 'Execution Complete', contractor_id: 'c', baseline_start: '2026-01-01', baseline_finish: '2026-02-01', progress_percent: 40 }, issues: [], blocking: false, duplicate: null };
    return reconcileRows({ rows: [row], ctx }).rows[0].reconcile;
  };
  it('unchanged since the export: the edit goes through as an update', () => expect(mk('2026-03-10T10:00:00Z', '2026-03-10T10:00:00Z').outcome).toBe('update'));
  it('changed since the export: it needs a decision', () => {
    const r = mk('2026-03-10T10:00:00Z', '2026-03-11T09:00:00Z');
    expect(r.outcome).toBe('clarify');
    expect(r.clarifications.join(' ')).toMatch(/changed after this sheet was exported/);
  });
  it('a file with no stamp behaves as before', () => expect(mk('', '2026-03-11T09:00:00Z').outcome).toBe('update'));
});
