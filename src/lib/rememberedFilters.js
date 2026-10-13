// The filters a person last used on a list, kept on their own phone or computer (MVP gap, step 1).
// Per list and per user, so two people sharing a device do not inherit each other's view.

const keyOf = (list, userId) => `dvg.filters.${list}.${userId || 'anon'}`;

export function loadRemembered(list, userId, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  try {
    const raw = storage?.getItem(keyOf(list, userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRemembered(list, userId, filters, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  try {
    const active = Object.fromEntries(Object.entries(filters || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false));
    if (Object.keys(active).length) storage?.setItem(keyOf(list, userId), JSON.stringify(active));
    else storage?.removeItem(keyOf(list, userId));
  } catch {
    // Not remembering is harmless.
  }
}

export function forgetRemembered(list, userId, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  try { storage?.removeItem(keyOf(list, userId)); } catch { /* nothing to forget */ }
}

/** How many filters are switched on, ignoring blanks. */
export const countActive = (filters, ignore = []) =>
  Object.entries(filters || {}).filter(([k, v]) => !ignore.includes(k) && v !== '' && v !== null && v !== undefined && v !== false).length;
