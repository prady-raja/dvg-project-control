// N-03 / N-04: the scope and filter state helpers.
import { describe, expect, it } from 'vitest';
import { applyFilters, filtersFromParams, paramsFromFilters } from '@/lib/urlFilters';

describe('URL filters round trip', () => {
  const defaults = { status: '', contractor: '', overdue: false, q: '' };
  it('reads known keys and ignores unknown ones', () => {
    const p = new URLSearchParams('status=Blocked&contractor=c1&overdue=1&junk=x');
    expect(filtersFromParams(p, defaults)).toEqual({ status: 'Blocked', contractor: 'c1', overdue: true, q: '' });
  });
  it('writes only what differs from the default', () => {
    const out = paramsFromFilters({ status: 'Blocked', contractor: '', overdue: false, q: '' }, defaults, new URLSearchParams('project=p1'));
    expect(out.toString()).toBe('project=p1&status=Blocked');
  });
  it('clearing a filter removes its key', () => {
    const out = paramsFromFilters({ ...defaults }, defaults, new URLSearchParams('status=Blocked&project=p1'));
    expect(out.toString()).toBe('project=p1');
  });
  it('applies a preset over the current filters', () => {
    expect(applyFilters(defaults, { overdue: true })).toEqual({ ...defaults, overdue: true });
  });
});
