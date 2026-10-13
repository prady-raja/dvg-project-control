import { describe, expect, it } from 'vitest';
import { canChangeDiary, diaryInput, headcountOf } from '../base44/shared/siteDiary.ts';
import { shiftDay } from '../base44/shared/dashboardCore.ts';

const ctx = { today: '2026-03-12', backdateLimitDays: 7, shift: shiftDay };
const ok = (extra = {}) => diaryInput({ diary_date: '2026-03-12', labour: [{ contractor_id: 'c1', contractor_name: 'Sharma Tiling', heads: 8 }], ...extra }, ctx);
const bad = (input, pattern) => expect(() => diaryInput({ diary_date: '2026-03-12', ...input }, ctx)).toThrow(pattern);

describe('site diary input', () => {
  it('adds up the crews once', () => {
    const d = ok({ labour: [{ contractor_id: 'c1', contractor_name: 'A', heads: 8 }, { contractor_id: 'c2', contractor_name: 'B', heads: 5 }] });
    expect(d.total_heads).toBe(13);
    expect(headcountOf(d.labour)).toBe(13);
  });
  it('refuses the same crew twice', () => bad({ labour: [{ contractor_id: 'c1', contractor_name: 'A', heads: 3 }, { contractor_id: 'c1', contractor_name: 'A', heads: 2 }] }, /twice/));
  it('refuses a missing or silly headcount', () => {
    bad({ labour: [{ contractor_id: 'c1', contractor_name: 'A', heads: '' }] }, /number of people/);
    bad({ labour: [{ contractor_id: 'c1', contractor_name: 'A', heads: -2 }] }, /number of people/);
  });
  it('a future day is refused', () => expect(() => diaryInput({ diary_date: '2026-03-13' }, ctx)).toThrow(/not happened/));
  it('backdating is limited by the project setting', () => {
    expect(() => diaryInput({ diary_date: '2026-03-01' }, ctx)).toThrow(/7 days back/);
    expect(diaryInput({ diary_date: '2026-03-06' }, ctx).diary_date).toBe('2026-03-06');
  });
  it('hours lost need a reason', () => {
    bad({ work_stopped_hours: 3 }, /why work stopped/);
    expect(ok({ work_stopped_hours: 3, work_stopped_reason: 'Rain' }).work_stopped_hours).toBe(3);
    bad({ work_stopped_hours: 30, work_stopped_reason: 'x' }, /0 and 24/);
  });
  it('a delivery needs a material and may ask to mark its task', () => {
    const d = ok({ deliveries: [{ material: '', quantity: '5' }, { material: 'Tiles', task_id: 't1', mark_delivered: true }] });
    expect(d.deliveries).toHaveLength(1);
    expect(d.deliveries[0].mark_delivered).toBe(true);
  });
  it('weather source is Manual unless it came from the forecast service', () => {
    expect(ok({ weather_source: 'x' }).weather_source).toBe('Manual');
    expect(ok({ weather_source: 'Open-Meteo' }).weather_source).toBe('Open-Meteo');
  });
});

describe('closed days', () => {
  it('an engineer cannot change a closed day, an administrator can', () => {
    expect(canChangeDiary({ closed: true }, { isAdmin: false }).ok).toBe(false);
    expect(canChangeDiary({ closed: true }, { isAdmin: true }).ok).toBe(true);
    expect(canChangeDiary({ closed: false }, { isAdmin: false }).ok).toBe(true);
    expect(canChangeDiary(null, { isAdmin: false }).ok).toBe(true);
  });
});
