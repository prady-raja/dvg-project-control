/**
 * FRONTEND COPY of the drawing intake in base44/shared/drawingIntake.ts — the
 * browser may not import from base44/, so reading a drawing number, title and
 * revision from a file name lives here too. Keep the two in step.
 */

const TOKENS = { number: '(?<number>.+?)', title: '(?<title>.+?)', rev: '(?<rev>[A-Za-z]{0,2}\\d{0,3}[A-Za-z]?)' };

export const DEFAULT_PATTERN = '{number} - {title} - {rev}';

/** Patterns tried after the editable one fails, covering how drawing sets are usually named. */
export const FALLBACK_PATTERNS = ['{number}_{title}_{rev}', '{number} - {title}_{rev}', '{number} {title} {rev}', '{number} - {rev}', '{number}_{rev}', '{number} - {title}', '{number}_{title}'];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "{number} - {title} - {rev}" -> a regex with named groups; unknown tokens are rejected. */
export function compilePattern(pattern) {
  const source = String(pattern || '').trim();
  if (!source.includes('{number}')) return null;
  const parts = source.split(/(\{[a-z]+\})/);
  let regex = '';
  for (const part of parts) {
    const token = part.match(/^\{([a-z]+)\}$/);
    if (token) {
      if (!TOKENS[token[1]]) return null;
      regex += TOKENS[token[1]];
    } else {
      regex += escape(part).replace(/\s+/g, '\\s+');
    }
  }
  try {
    return new RegExp(`^${regex}$`, 'i');
  } catch {
    return null;
  }
}

const tidy = (value) => String(value || '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The number, title and revision in a file name, or just the number guess when nothing fits. */
export function parseDrawingName(fileName, pattern = DEFAULT_PATTERN) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  for (const candidate of [pattern, ...FALLBACK_PATTERNS]) {
    const regex = compilePattern(candidate);
    const hit = regex && base.match(regex);
    if (hit?.groups?.number) {
      const g = hit.groups;
      return { number: tidy(g.number), title: tidy(g.title) || tidy(g.number), revision: tidy(g.rev).toUpperCase(), matched: true, base };
    }
  }
  return { number: '', title: tidy(base), revision: '', matched: false, base };
}

/** Natural order for revisions: R1 < R2 < R10, A < B, and a bare number counts as that revision. */
export function revisionRank(revision) {
  const text = String(revision || '').trim().toUpperCase().replace(/^REV\.?\s*/, '').replace(/^R(?=\d)/, '');
  if (!text) return -1;
  const num = text.match(/^(\d+)([A-Z]?)$/);
  if (num) return Number(num[1]) * 100 + (num[2] ? num[2].charCodeAt(0) - 64 : 0);
  const alpha = text.match(/^([A-Z]+)(\d*)$/);
  if (alpha) return alpha[1].split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) * 100 + (Number(alpha[2]) || 0) - 50;
  return -1;
}

export const compareRevisions = (a, b) => revisionRank(a) - revisionRank(b);

/** Where a drawing belongs: one villa, every villa of a type, a floor of a villa, or a common area. */
export const scopeKey = (target = {}) => {
  if (target.villa_type) return `type:${String(target.villa_type).trim().toLowerCase()}`;
  return `loc:${target.location_id || ''}${target.floor_id ? `:${target.floor_id}` : ''}`;
};

export const sameNumber = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * Plan every file against the register (and against each other in the same batch):
 *   new            — nothing with this number in this scope
 *   duplicate      — this number and revision is already there
 *   newer          — a later revision than the current one: supersedes it
 *   older          — an earlier revision: filed as history, the current one stays current
 *   needs_number   — no drawing number could be read
 */
export function planDrawingIntake({ files = [], existing = [] }) {
  const pool = existing.map((d) => ({ number: d.drawing_number, revision: d.revision, status: d.status, key: scopeKey(d), id: d.id }));
  return files.map((file) => {
    if (!String(file.number || '').trim()) return { ...file, state: 'needs_number', note: 'Enter the drawing number.' };
    const key = scopeKey(file.target || {});
    const sameDrawing = pool.filter((d) => d.key === key && sameNumber(d.number, file.number));
    const duplicate = sameDrawing.find((d) => revisionRank(d.revision) === revisionRank(file.revision) && sameNumber(d.revision, file.revision));
    if (duplicate) return { ...file, state: 'duplicate', note: `Already on the register as revision ${file.revision || '—'}.` };
    const current = sameDrawing.filter((d) => d.status !== 'Superseded').sort((a, b) => compareRevisions(b.revision, a.revision))[0];
    let state = 'new';
    let note = 'New drawing.';
    if (current) {
      if (compareRevisions(file.revision, current.revision) > 0) {
        state = 'newer';
        note = `Supersedes revision ${current.revision || '—'}, which stays on the register.`;
      } else {
        state = 'older';
        note = `Older than the current revision ${current.revision || '—'} — filed as history only.`;
      }
    }
    pool.push({ number: file.number, revision: file.revision, status: state === 'older' ? 'Superseded' : 'Current', key });
    return { ...file, state, note };
  });
}