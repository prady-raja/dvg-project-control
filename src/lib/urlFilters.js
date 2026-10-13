// Pure helpers behind useUrlFilters (N-04): filters live in the address, so a link
// carries them. Only values that differ from the default are written.

const isBool = (v) => typeof v === 'boolean';

export function filtersFromParams(params, defaults) {
  const out = {};
  Object.keys(defaults).forEach((key) => {
    const raw = params.get(key);
    if (raw === null) out[key] = defaults[key];
    else if (isBool(defaults[key])) out[key] = raw === '1' || raw === 'true';
    else out[key] = raw;
  });
  return out;
}

export function paramsFromFilters(filters, defaults, base = new URLSearchParams()) {
  const out = new URLSearchParams(base);
  Object.keys(defaults).forEach((key) => {
    const value = filters[key];
    const same = value === defaults[key] || value === undefined || value === null;
    if (same) out.delete(key);
    else if (isBool(defaults[key])) out.set(key, value ? '1' : '0');
    else out.set(key, String(value));
  });
  return out;
}

export const applyFilters = (current, patch) => ({ ...current, ...patch });
