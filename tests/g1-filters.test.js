import { describe, expect, it } from 'vitest';
import { countActive, forgetRemembered, loadRemembered, saveRemembered } from '@/lib/rememberedFilters';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), size: () => m.size };
};

describe('counting what is switched on', () => {
  it('ignores blanks and false, and anything listed to ignore', () => {
    expect(countActive({ a: '', b: 'x', c: false, d: true, e: null, f: 0 })).toBe(3);
    expect(countActive({ a: 'x', b: 'y' }, ['b'])).toBe(1);
  });
});

describe('remembering the last filters per list and per user (G1)', () => {
  it('comes back as saved, only the filters that were on', () => {
    const s = fakeStorage();
    saveRemembered('work', 'u1', { status: 'Blocked', contractor_id: '', assignee: 'me', search: '' }, s);
    expect(loadRemembered('work', 'u1', s)).toEqual({ status: 'Blocked', assignee: 'me' });
  });
  it('is separate per list and per person', () => {
    const s = fakeStorage();
    saveRemembered('work', 'u1', { status: 'Blocked' }, s);
    expect(loadRemembered('villas', 'u1', s)).toBeNull();
    expect(loadRemembered('work', 'u2', s)).toBeNull();
  });
  it('saving nothing clears it, and reset forgets it', () => {
    const s = fakeStorage();
    saveRemembered('work', 'u1', { status: 'Blocked' }, s);
    saveRemembered('work', 'u1', { status: '' }, s);
    expect(loadRemembered('work', 'u1', s)).toBeNull();
    saveRemembered('work', 'u1', { status: 'Blocked' }, s);
    forgetRemembered('work', 'u1', s);
    expect(s.size()).toBe(0);
  });
  it('unreadable storage is tolerated', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadRemembered('work', 'u1', broken)).toBeNull();
    expect(() => saveRemembered('work', 'u1', { a: 'x' }, broken)).not.toThrow();
  });
  it('a stored value that is not an object is ignored', () => {
    const s = fakeStorage();
    s.setItem('dvg.filters.work.u1', '[1,2]');
    expect(loadRemembered('work', 'u1', s)).toBeNull();
  });
});
