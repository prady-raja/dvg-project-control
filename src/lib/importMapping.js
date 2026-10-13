import { applyHeaderMapping, headerFingerprint, unrecognisedHeadings } from '@/lib/shared/importChunks.ts';

/**
 * A file's own headings can be mapped to the app's columns once and remembered,
 * keyed by a fingerprint of the headings, so the next workbook from the same
 * source (the Imagine lists keep their headings) maps itself. Stored in this
 * browser only; it is a convenience, never the record of what was imported.
 */
const KEY = 'dvg.import.mappings';

const read = () => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

export const savedMappingFor = (text) => read()[headerFingerprint(text)] || {};

export function saveMappingFor(text, mapping) {
  try {
    const all = read();
    all[headerFingerprint(text)] = mapping;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage can be blocked; the mapping then applies to this upload only.
  }
}

/** The file with its saved mapping applied, plus what is still unrecognised afterwards. */
export function prepareHeadings(rawText, mapping = savedMappingFor(rawText)) {
  const text = applyHeaderMapping(rawText, mapping);
  return { text, mapping, unrecognised: unrecognisedHeadings(text) };
}

/* A reviewed import survives navigating away: kept per file fingerprint in sessionStorage. */
const sessionKey = (checksum) => `dvg.import.review.${checksum}`;

export function saveReview(checksum, state) {
  try {
    window.sessionStorage.setItem(sessionKey(checksum), JSON.stringify(state));
  } catch {
    // Too large or blocked — the review simply is not remembered.
  }
}

export function loadReview(checksum) {
  try {
    return JSON.parse(window.sessionStorage.getItem(sessionKey(checksum)) || 'null');
  } catch {
    return null;
  }
}

export function clearReview(checksum) {
  try {
    window.sessionStorage.removeItem(sessionKey(checksum));
  } catch {
    // Nothing to clear.
  }
}