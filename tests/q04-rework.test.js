import { describe, expect, it } from 'vitest';
import { REJECTION_CATEGORIES, isRework, reworkInput, reworkPatch } from '../base44/shared/rework.ts';

describe('reject for rework', () => {
  it('needs a known category and a note', () => {
    expect(() => reworkInput({ category: 'Bad vibes', note: 'x' })).toThrow(/Say why/);
    expect(() => reworkInput({ category: REJECTION_CATEGORIES[0], note: '  ' })).toThrow(/redone/);
    expect(reworkInput({ category: 'Workmanship', note: ' Redo the joints ' })).toEqual({ category: 'Workmanship', note: 'Redo the joints' });
  });
  it('counts each rejection and keeps the latest reason', () => {
    const first = reworkPatch({}, { category: 'Incomplete', note: 'Skirting missing' });
    expect(first).toEqual({ rejection_count: 1, last_rejection_category: 'Incomplete', last_rejection_reason: 'Skirting missing' });
    expect(reworkPatch({ rejection_count: 1 }, { category: 'Other', note: 'n' }).rejection_count).toBe(2);
    expect(isRework({})).toBe(false);
    expect(isRework({ rejection_count: 1 })).toBe(true);
  });
});
