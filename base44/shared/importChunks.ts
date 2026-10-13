/**
 * Helpers for big imports (I-01). A full Imagine work list is thousands of rows,
 * far past what one server call can reconcile, so the browser sends it in chunks
 * of at most CHUNK_ROWS rows under one ImportBatch. These helpers are pure — rows
 * in, rows out — and shared by the browser and the tests.
 *
 *  - splitIntoChunks:   a CSV text -> chunks, each with its own header and the
 *                       file's own row numbers, so a chunk reads like a small file.
 *  - header mapping:    rename a file's headings to the app's columns, remembered
 *                       per source by a fingerprint of its headings.
 *  - merge helpers:     add chunk previews and chunk results back together.
 */
import { IMPORT_COLUMNS, cleanText, looseKey, parseCsv } from './workImport.ts';

export const CHUNK_ROWS = 250;

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows) => rows.map((cells) => cells.map(csvCell).join(',')).join('\n');

/**
 * Row numbers as the person sees them: the worksheet row for Excel (passed in),
 * the line number otherwise (row 2 is the first task). Blank lines are not rows.
 */
export function splitIntoChunks(text, { rowNumbers = [], size = CHUNK_ROWS } = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [{ text: String(text || ''), rowNumbers: Array.isArray(rowNumbers) ? rowNumbers : [], offset: 0 }];
  const header = rows[0];
  const body = rows.slice(1);
  const numbers = rowNumbers.length >= body.length ? rowNumbers.slice(0, body.length) : body.map((_, i) => i + 2);
  const chunks = [];
  for (let i = 0; i < body.length; i += size) {
    chunks.push({
      text: toCsv([header, ...body.slice(i, i + size)]),
      rowNumbers: numbers.slice(i, i + size),
      offset: i,
    });
  }
  return chunks;
}

/* --------------------------------------------------------------- header mapping */

const isKnownHeading = (raw) => {
  const key = looseKey(raw);
  return !!key && IMPORT_COLUMNS.some((column) => [column.label, column.key, ...column.aliases].some((alias) => looseKey(alias) === key));
};

/** The headings of the file, in order. */
export const headingsOf = (text) => (parseCsv(text)[0] || []).map(cleanText);

/** A stable id for this arrangement of headings, so a saved mapping is found again for the same source. */
export const headerFingerprint = (text) =>
  headingsOf(text).map(looseKey).filter(Boolean).join('|');

/** Headings the app does not recognise, each with how many rows have something in that column. */
export function unrecognisedHeadings(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map(cleanText);
  return header
    .map((raw, index) => ({ raw, index }))
    .filter(({ raw }) => raw && !isKnownHeading(raw))
    .map(({ raw, index }) => ({
      heading: raw,
      filled: rows.slice(1).filter((cells) => cleanText(cells[index]) !== '').length,
    }));
}

/**
 * Rename headings according to a mapping { "their heading": "column key" }. A
 * column may only be claimed once, and a heading the app already knows is left
 * alone, so a mapping can never override a clean file.
 */
export function applyHeaderMapping(text, mapping = {}) {
  const rows = parseCsv(text);
  if (!rows.length || !Object.keys(mapping).length) return String(text || '');
  const header = rows[0].map(cleanText);
  const claimed = new Set(header.filter(isKnownHeading).map((raw) => {
    const key = looseKey(raw);
    return IMPORT_COLUMNS.find((column) => [column.label, column.key, ...column.aliases].some((alias) => looseKey(alias) === key))?.key;
  }));
  const renamed = header.map((raw) => {
    const target = mapping[raw];
    const column = target && IMPORT_COLUMNS.find((item) => item.key === target);
    if (!column || isKnownHeading(raw) || claimed.has(column.key)) return rows[0][header.indexOf(raw)];
    claimed.add(column.key);
    return column.label;
  });
  return toCsv([renamed, ...rows.slice(1)]);
}

/* -------------------------------------------------------------------- merging */

const SUM_KEYS = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];

/** Add up two count objects ({ total, valid, ... }); non-numbers keep the first value. */
export function addCounts(a = {}, b = {}) {
  const out = {};
  SUM_KEYS(a, b).forEach((key) => {
    const x = a[key];
    const y = b[key];
    out[key] = typeof x === 'number' || typeof y === 'number' ? (Number(x) || 0) + (Number(y) || 0) : (x ?? y);
  });
  return out;
}

/** Chunk previews -> one preview, as if the whole file had been read at once. */
export function mergePreviews(previews) {
  const list = previews.filter(Boolean);
  if (!list.length) return null;
  const first = list[0];
  return {
    ...first,
    file: {
      ...first.file,
      rows: list.reduce((sum, p) => sum + (p.file?.rows || 0), 0),
    },
    summary: list.reduce((acc, p) => addCounts(acc, p.summary), {}),
    reconciliation: list.reduce((acc, p) => addCounts(acc, p.reconciliation), {}),
    rows: list.flatMap((p) => p.rows || []),
    // The workbook of the whole file is rebuilt from the rows by the caller.
    workbook: null,
    prior_batches: first.prior_batches || [],
    chunks: list.length,
  };
}

const OUTCOME_LISTS = ['created', 'updated', 'unchanged', 'rejected', 'deferred', 'linked', 'failed', 'needs_info'];

/** Chunk commit results -> one result for the whole import. */
export function mergeResults(results) {
  const list = results.filter(Boolean);
  if (!list.length) return null;
  const last = list[list.length - 1];
  const merged = { ...last };
  OUTCOME_LISTS.forEach((key) => {
    merged[key] = list.flatMap((r) => r[key] || []);
  });
  merged.counts = list.reduce((acc, r) => addCounts(acc, r.counts), {});
  merged.summary = list.reduce((acc, r) => addCounts(acc, r.summary), {});
  merged.reconciliation = list.reduce((acc, r) => addCounts(acc, r.reconciliation), {});
  const tally = (key) => {
    const counts = new Map();
    list.flatMap((r) => r[key] || []).forEach(({ label, count }) => counts.set(label, (counts.get(label) || 0) + count));
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };
  merged.by_villa = tally('by_villa');
  merged.by_contractor = tally('by_contractor');
  merged.workbook = null;
  return merged;
}

/** Decisions and corrections are keyed by row number; a chunk only needs its own rows. */
export function restrictToRows(map, rowNumbers) {
  const wanted = new Set(rowNumbers.map(String));
  return Object.fromEntries(Object.entries(map || {}).filter(([key]) => wanted.has(String(key))));
}
