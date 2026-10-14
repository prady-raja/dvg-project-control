// Import writes: a rate limit is waited out; a retried bulk create never writes a row twice.
import { describe, expect, it } from 'vitest';
import { bulkCreateOnce, isRateLimit, withBackoff } from '../base44/shared/writeRetry.ts';

const limited = () => Object.assign(new Error('Rate limit exceeded'), { status: 429 });
const noSleep = { sleep: async () => {} };

describe('withBackoff', () => {
  it('retries a rate limit with growing waits, then succeeds', async () => {
    const waits = [];
    let calls = 0;
    const out = await withBackoff(async () => { calls += 1; if (calls < 3) throw limited(); return 'ok'; }, { sleep: async (ms) => { waits.push(ms); } });
    expect(out).toBe('ok');
    expect(waits).toEqual([1500, 3000]);
  });
  it('raises other errors at once and gives up after the limit', async () => {
    let calls = 0;
    await expect(withBackoff(async () => { calls += 1; throw new Error('Validation failed'); }, noSleep)).rejects.toThrow('Validation failed');
    expect(calls).toBe(1);
    calls = 0;
    await expect(withBackoff(async () => { calls += 1; throw limited(); }, { retries: 2, ...noSleep })).rejects.toThrow(/rate limit/i);
    expect(calls).toBe(3);
    expect(isRateLimit({ message: 'Too many requests' })).toBe(true);
  });
});

describe('bulkCreateOnce', () => {
  it('after a rate limit only sends rows not already stored', async () => {
    const stored = [{ import_row_number: 1, id: 'a' }];
    const sent = [];
    let first = true;
    const out = await bulkCreateOnce({
      payloads: [{ import_row_number: 1 }, { import_row_number: 2 }],
      keyOf: (x) => x.import_row_number,
      findStored: async () => stored,
      create: async (rows) => { sent.push(rows.map((r) => r.import_row_number)); if (first) { first = false; throw limited(); } return rows.map((r) => ({ ...r, id: `n${r.import_row_number}` })); },
      retryOptions: noSleep,
    });
    expect(sent).toEqual([[1, 2], [2]]);
    expect(out.map((r) => r.import_row_number).sort()).toEqual([1, 2]);
  });
});
