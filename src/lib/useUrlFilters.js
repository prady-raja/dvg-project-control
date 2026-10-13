import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { applyFilters, filtersFromParams, paramsFromFilters } from '@/lib/urlFilters';

/**
 * Filters kept in the address (N-04). `set` changes some of them, `reset` clears
 * them all, and the project/phase scope in the same address is left alone.
 */
export default function useUrlFilters(defaults) {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params, defaults), [params, defaults]);
  const set = useCallback((patch) => {
    setParams((prev) => paramsFromFilters(applyFilters(filtersFromParams(prev, defaults), patch), defaults, prev), { replace: true });
  }, [setParams, defaults]);
  const reset = useCallback(() => set(defaults), [set, defaults]);
  return { filters, set, reset };
}

/** One value kept in the address, as a drop-in for useState(default). */
export function useUrlState(key, fallback) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = raw === null ? fallback : raw;
  const setValue = useCallback((next) => {
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      const text = next === null || next === undefined ? '' : String(next);
      if (text === '' || text === String(fallback)) out.delete(key);
      else out.set(key, text);
      return out;
    }, { replace: true });
  }, [setParams, key, fallback]);
  return [value, setValue];
}
