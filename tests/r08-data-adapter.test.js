// R-08 — one data adapter; readAll never cuts a list short silently.
import { describe, expect, it, vi } from 'vitest';
import { makeDb } from '../base44/shared/dbCore.ts';

vi.mock('@/api/base44Client', () => ({ base44: { entities: {} } }));
const { makeData } = await import('@/api/data.js');

function pagedEntity(total, pageSize) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: `r${i}` }));
  return {
    filter: vi.fn(async (_q, { cursor, limit } = {}) => {
      const start = cursor ? Number(cursor) : 0;
      const size = Math.min(limit || pageSize, pageSize);
      const items = rows.slice(start, start + size);
      const next = start + size;
      return { items, has_more: next < total, next_cursor: next < total ? String(next) : undefined };
    }),
    create: vi.fn(async (d) => ({ id: 'new', ...d })),
    update: vi.fn(async (id, d) => ({ id, ...d })),
  };
}

for (const [label, build] of [
  ['server (base44/shared/dbCore.ts)', (entities) => makeDb({ entities })],
  ['browser (src/api/data.js)', (entities) => makeData({ entities })],
]) {
  describe(`R-08 adapter — ${label}`, () => {
    it('readAll follows cursors to the end', async () => {
      const adapter = build({ Task: pagedEntity(12, 5) });
      const { items, truncated } = await adapter.readAll('Task', {}, { page: 5 });
      expect(items).toHaveLength(12);
      expect(truncated).toBe(false);
    });

    it('readAll says when it stopped at max', async () => {
      const adapter = build({ Task: pagedEntity(12, 5) });
      const { items, truncated } = await adapter.readAll('Task', {}, { page: 5, max: 10 });
      expect(items).toHaveLength(10);
      expect(truncated).toBe(true);
    });

    it('upsertByKey creates once, then updates the same row', async () => {
      const store = [];
      const entity = {
        filter: async (q) => store.filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)),
        create: async (d) => { const row = { id: `m${store.length}`, ...d }; store.push(row); return row; },
        update: async (id, d) => Object.assign(store.find((r) => r.id === id), d),
      };
      const adapter = build({ MetricSnapshot: entity });
      const key = ['scope_id', 'snapshot_date'];
      await adapter.upsertByKey('MetricSnapshot', key, { scope_id: 'p1', snapshot_date: '2026-10-10', open: 5 });
      await adapter.upsertByKey('MetricSnapshot', key, { scope_id: 'p1', snapshot_date: '2026-10-10', open: 4 });
      expect(store).toHaveLength(1);
      expect(store[0].open).toBe(4);
    });
  });
}
