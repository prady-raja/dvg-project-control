// C-01: an Open promise past its date reads as Missed; nothing is written.
import { describe, expect, it } from 'vitest';
import { commitmentState, commitmentSummary, withState } from '../base44/shared/commitments.ts';

const c = (status, promised_date, extra = {}) => ({ id: `${status}${promised_date}`, status, promised_date, ...extra });

describe('commitment state', () => {
  it('Open and past its date is Missed', () => expect(commitmentState(c('Open', '2026-03-01'), '2026-03-02')).toBe('Missed'));
  it('Open on its date is still Open', () => expect(commitmentState(c('Open', '2026-03-01'), '2026-03-01')).toBe('Open'));
  it('a confirmed outcome is never overridden', () => {
    expect(commitmentState(c('Fulfilled', '2026-01-01'), '2026-03-02')).toBe('Fulfilled');
    expect(commitmentState(c('Cancelled', '2026-01-01'), '2026-03-02')).toBe('Cancelled');
  });
  it('no promised date cannot be missed', () => expect(commitmentState(c('Open', ''), '2026-03-02')).toBe('Open'));
  it('does not change the stored record', () => {
    const rec = c('Open', '2026-03-01');
    withState(rec, '2026-03-05');
    expect(rec.status).toBe('Open');
  });
});

describe('commitment summary', () => {
  const today = '2026-03-10';
  const list = [c('Open', '2026-03-05'), c('Open', '2026-03-12'), c('Open', '2026-03-30'), c('Fulfilled', '2026-03-01'), c('Cancelled', '2026-03-02')];
  const s = commitmentSummary(list, today);
  it('counts', () => {
    expect(s.missed).toBe(1);
    expect(s.due_this_week).toBe(1);
    expect(s.open).toBe(3);
  });
  it('lists missed first, oldest date first', () => expect(s.next.map((n) => n.state)).toEqual(['Missed', 'Open']));
});
