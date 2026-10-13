// Forgiving search for a villa by its code or plot reference (L-04): "b5", "B-05"
// and "b 05" all find villa B-05; "plot 12" finds the villa whose plots include 12.

const squash = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/(^|[a-z])0+(\d)/g, '$1$2');

export function normaliseRef(text) {
  return squash(text);
}

/** True when every typed word matches the villa's code or its plot references. */
export function matchesPlotRef(query, row) {
  const words = String(query || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [squash(row.villa), ...String(row.plot_numbers || '').split(/[,;/]+/).map(squash)].filter(Boolean);
  const raw = `${row.villa || ''} ${row.plot_numbers || ''}`.toLowerCase();
  return words.every((w) => {
    const q = squash(w.replace(/^plot$/i, ''));
    if (!q) return true;
    return haystack.some((h) => h.includes(q)) || raw.includes(w.toLowerCase());
  });
}
