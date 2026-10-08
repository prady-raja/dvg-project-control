/** Entity reads through the options form return a page object, not an array. */
export const items = (res) => (Array.isArray(res) ? res : res?.items || []);

/** Aggregate returns { rows: [...] }. */
export const rows = (res) => (Array.isArray(res) ? res : res?.rows || []);

/** Blank optional inputs are stored as null so that "unknown" stays unknown. */
export const nullify = (obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, value === '' || value === undefined ? null : value]),
  );

export const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

export const byId = (list = []) => {
  const map = new Map();
  list.forEach((record) => map.set(record.id, record));
  return map;
};

export const isOnHold = (location) => location?.active_status === 'On Hold';