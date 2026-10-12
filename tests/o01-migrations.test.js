// O-01 — backfills are pure, previewable and safe to run twice.
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../base44/shared/migrations/index.ts';
import { runMigration, effectivePatch } from '../base44/shared/migrations/runner.ts';
import { makeDb } from '../base44/shared/dbCore.ts';
import { categoryForReason } from '../base44/shared/migrations/delayCategories.ts';

/** An in-memory entity store behind the real data adapter. */
function memoryDb(seed) {
  const tables = Object.fromEntries(Object.entries(seed).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));
  const entities = new Proxy({}, {
    get(_, name) {
      tables[name] = tables[name] || [];
      return {
        filter: async () => ({ items: tables[name].map((r) => ({ ...r })), has_more: false }),
        update: async (id, data) => { Object.assign(tables[name].find((r) => r.id === id), data); },
        create: async (data) => { tables[name].push({ id: `new${tables[name].length}`, ...data }); },
      };
    },
  });
  return { tables, db: makeDb({ entities }) };
}

const seed = () => ({
  ProjectMembership: [
    { id: 'm1', role: 'Site Engineer' }, { id: 'm2', role: 'Project Editor' }, { id: 'm3', role: 'Viewer' },
  ],
  Task: [
    { id: 't1', status: 'Execution Complete', date_revision_reason: 'Waiting for material delivery' },
    { id: 't2', status: 'In Progress' },
  ],
  DailyUpdate: [
    { task_id: 't1', update_date: '2026-10-01' }, { task_id: 't1', update_date: '2026-10-05' },
  ],
  TaskHistory: [
    { task_id: 't1', field_changed: 'status', new_value: 'In Progress', changed_at: '2026-09-20T05:00:00Z' },
    { task_id: 't1', field_changed: 'status', new_value: 'Execution Complete', changed_at: '2026-10-05T05:00:00Z' },
  ],
});

describe('O-01 migration runner', () => {
  it('a dry run reports counts and samples and writes nothing', async () => {
    const { db, tables } = memoryDb(seed());
    const result = await runMigration(db, MIGRATIONS.find((m) => m.id === 'legacy-roles'));
    expect(result.dry_run).toBe(true);
    expect(result.total).toBe(1);
    expect(result.samples[0].changes.role).toEqual({ from: 'Site Engineer', to: 'Project Editor' });
    expect(tables.ProjectMembership[0].role).toBe('Site Engineer');
    expect(tables.MigrationRun || []).toHaveLength(0);
  });

  for (const migration of MIGRATIONS) {
    it(`${migration.id} can be run twice safely`, async () => {
      const { db } = memoryDb(seed());
      const first = await runMigration(db, migration, { dryRun: false });
      expect(first.failed).toBe(0);
      const second = await runMigration(db, migration, { dryRun: false });
      expect(second.total).toBe(0);
    });
  }

  it('applies the intended changes', async () => {
    const { db, tables } = memoryDb(seed());
    for (const migration of MIGRATIONS) await runMigration(db, migration, { dryRun: false });
    expect(tables.ProjectMembership.map((m) => m.role)).toEqual(['Project Editor', 'Project Editor', 'Viewer']);
    const t1 = tables.Task.find((t) => t.id === 't1');
    expect(t1.latest_report_date).toBe('2026-10-05');
    expect(t1.actual_start).toBe('2026-09-20');
    expect(t1.actual_finish).toBe('2026-10-05');
    expect(t1.date_revision_category).toBe('Material');
    expect(tables.MigrationRun.length).toBe(MIGRATIONS.length);
  });

  it('only counts a patch that changes something', () => {
    expect(effectivePatch({ a: 1 }, { a: 1, b: 2 })).toEqual({ b: 2 });
  });

  it('puts unclear reasons under Other', () => {
    expect(categoryForReason('because')).toBe('Other');
    expect(categoryForReason('')).toBe('');
  });
});
