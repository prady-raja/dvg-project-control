/**
 * Physical villa resolution — the single authority for turning what someone
 * says or types into a physical villa record.
 *
 * The stored Location records are the only source of truth: a villa code, or an
 * original plot reference, is resolved against them. Nothing here invents a
 * villa, and every path that meets a villa reference (the CSV import, the
 * assistant, task creation, site reports and snags) resolves it through this
 * module so the same words always mean the same records.
 *
 * Where a development sells combined plots as one physical villa (plots 7, 8
 * and 9 are villa B-07-08-09), the plot numbers are read from the villa's own
 * record. Several references that map to one villa collapse to that villa once,
 * and a reference that could be more than one villa is reported as ambiguous
 * instead of being chosen.
 */

export const cleanText = (value) => (value === null || value === undefined ? '' : String(value).trim());

/** Case, spaces and punctuation all ignored — for matching names and codes. */
export const looseKey = (value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');

/** `b 05 06`, `B-5-6` and `B-05-06` all become `B-05-06`. */
export function normalizeCode(value) {
  let text = cleanText(value).toUpperCase().replace(/[–—]/g, '-').replace(/[\/_,]+/g, '-').replace(/\s+/g, '');
  text = text.replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (/^[A-Z]+\d/.test(text) && !text.includes('-')) text = text.replace(/^([A-Z]+)(?=\d)/, '$1-');
  const parts = text.split('-');
  if (parts.length > 1 && /^[A-Z]+$/.test(parts[0])) {
    return [parts[0], ...parts.slice(1).map((part) => (/^\d+$/.test(part) ? part.padStart(2, '0') : part))].join('-');
  }
  return text;
}

/** The original plot references a villa carries, as numbers: `Plots 7, 8 & 9` -> [7, 8, 9]. */
export const plotNumbersOf = (location) =>
  [...new Set((cleanText(location?.plot_numbers).match(/\d+/g) || []).map(Number))];

export const isVilla = (location) => location?.location_type === 'Villa';

export const villaLabel = (location) =>
  location ? `${location.villa_code}${isVilla(location) ? '' : ` (${location.location_type})`}` : '';

/**
 * Lookup tables for one project's locations: exact code, loose code, and the
 * plot numbers each villa answers to.
 */
export function buildVillaIndex(locations = []) {
  const byId = new Map();
  const byCode = new Map();
  const byLoose = new Map();
  const plots = new Map();

  locations.forEach((location) => {
    byId.set(location.id, location);
    if (!location?.villa_code) return;
    byCode.set(normalizeCode(location.villa_code), location);
    const loose = looseKey(location.villa_code);
    if (!byLoose.has(loose)) byLoose.set(loose, location);
    plotNumbersOf(location).forEach((number) => {
      plots.set(number, [...(plots.get(number) || []), location]);
    });
  });

  return { byId, byCode, byLoose, plots, locations };
}

const inPhase = (list, phaseIdHint) =>
  phaseIdHint ? list.filter((location) => !location.phase_id || location.phase_id === phaseIdHint) : list;

const uniqueById = (list) => {
  const seen = new Set();
  return list.filter((location) => {
    if (!location || seen.has(location.id)) return false;
    seen.add(location.id);
    return true;
  });
};

/**
 * One written reference — a villa code, a component of a combined villa code
 * (`B-08` inside `B-07-08-09`), or an original plot reference (`Plot 8`).
 */
export function resolveVillaCode(raw, index, phaseIdHint) {
  const text = cleanText(raw);
  if (!text) return { status: 'blank' };

  const direct = index.byCode.get(normalizeCode(text)) || index.byLoose.get(looseKey(text));
  if (direct) return { status: 'matched', location: direct, via: 'code' };

  // A component of a combined villa: B-08 belongs to B-07-08-09.
  const parts = normalizeCode(text).split('-');
  const letter = parts.length > 1 ? parts[0] : '';
  const fromCode = letter
    ? inPhase(
        index.locations.filter((location) => {
          if (!isVilla(location)) return false;
          const lparts = normalizeCode(location.villa_code).split('-');
          if (lparts[0] !== letter) return false;
          const tokens = parts.slice(1).map((part) => part.replace(/[A-Z]+$/, ''));
          const components = lparts.slice(1).map((part) => part.replace(/[A-Z]+$/, ''));
          return tokens.length > 0 && tokens.every((token) => components.includes(token));
        }),
        phaseIdHint,
      )
    : [];

  // An original plot reference: every villa whose record names that plot.
  const fromPlot = [];
  (text.match(/\d+/g) || [])
    .map(Number)
    .forEach((number) => {
      inPhase(index.plots.get(number) || [], phaseIdHint).forEach((location) => {
        if (!fromPlot.some((x) => x.id === location.id)) fromPlot.push(location);
      });
    });

  let pool = uniqueById([...fromCode, ...fromPlot]);

  // A letter on the reference settles a split villa: "Villa 14A" is B-14A even
  // though B-14A and B-14B both carry plot 14. Only used when it narrows the
  // field to one villa — otherwise the reference stays ambiguous.
  const suffix = (text.match(/([a-z])\s*$/i) || [])[1];
  if (suffix && pool.length > 1) {
    const narrowed = pool.filter((location) =>
      normalizeCode(location.villa_code).endsWith(suffix.toUpperCase()),
    );
    if (narrowed.length) pool = narrowed;
  }

  if (pool.length === 1) return { status: 'matched', location: pool[0], via: fromCode.length ? 'component' : 'plot' };
  if (pool.length > 1) return { status: 'ambiguous', candidates: pool };
  return { status: 'unknown' };
}

/**
 * The phase named in the words, when it is named. Used only as a hint: a villa
 * code always wins, and an unstated phase is never assumed.
 */
export function phaseHintFromText(text, phases = []) {
  const raw = cleanText(text);
  if (!raw) return '';
  const hay = looseKey(raw);
  const hits = phases.filter((phase) => {
    const code = cleanText(phase.code);
    const name = cleanText(phase.name);
    // A phase code counts only where it is written as a word of its own: the
    // letter A must not be found inside "villa5". A longer code may also appear
    // joined to its number, e.g. "B05".
    const bare = code.replace(/[^A-Za-z0-9]/g, '');
    const codeHit = bare
      ? new RegExp(`(^|[^A-Za-z0-9])${bare}(?![A-Za-z0-9])`, 'i').test(raw) ||
        (bare.length > 1 && new RegExp(`${looseKey(bare)}\\d`, 'i').test(hay))
      : false;
    const nameHit = looseKey(name).length > 3 && hay.includes(looseKey(name));
    return codeHit || nameHit;
  });
  return hits.length === 1 ? hits[0].id : '';
}

const LIST_SPLIT = /\s*(?:,|and|&|\+|\/)\s*/i;

/**
 * Every villa reference inside one message.
 *
 * Returns the physical villas once each: "plots 5 and 6" is one villa
 * (B-05-06), not two. A reference that matches more than one villa, or a villa
 * number that exists in two phases with no phase stated, comes back as
 * `ambiguous` with the candidates to choose between, and an unknown reference
 * comes back in `unknown` — it never becomes a new villa.
 */
export function resolveVillaReferences(text, index, options = {}) {
  const raw = cleanText(text);
  const hay = looseKey(raw);
  const phaseIdHint = options.phaseId || phaseHintFromText(raw, options.phases || []);
  const resolved = [];
  const ambiguous = [];
  const unknown = [];

  const add = (location, via, reference) => {
    if (!location) return;
    if (!resolved.some((item) => item.location.id === location.id)) resolved.push({ location, via, reference });
  };
  const addAmbiguous = (reference, candidates) => {
    // Two references that offer the same candidates are one question, not two.
    const ids = candidates.map((c) => c.id).join(',');
    if (ambiguous.some((item) => item.candidates.map((c) => c.id).join(',') === ids)) return;
    ambiguous.push({ reference, candidates });
  };

  // 1. Villa codes written as they are stored, e.g. B-07-08-09, A-10.
  index.locations.forEach((location) => {
    const loose = looseKey(location.villa_code);
    if (loose.length < 3 || !hay.includes(loose)) return;
    if (phaseIdHint && location.phase_id && location.phase_id !== phaseIdHint) return;
    add(location, 'code', location.villa_code);
  });

  // 2. "Villa 10", "Villa No. 10", "Plot 14A", "plot 8", "Plots 15 and 16",
  //    "Villas 7, 8 and 9" — with any following list of numbers belonging to the
  //    same phrase ("Villas 5, 6 and 7").
  const pattern = /(villas?|plots?|units?|houses?)\s*(?:no\.?|number|nos\.?|#)?\s*[-#]?\s*(\d{1,3})([a-z])?/gi;
  let match = pattern.exec(raw);
  while (match) {
    const keyword = match[1];
    const numbers = [match[2]];
    const letters = [match[3] || ''];
    const tail = raw.slice(match.index + match[0].length);
    const trailing = tail.match(/^\s*((?:(?:,|and|&|\+|\/)\s*(?:villas?|plots?|units?|houses?)?\s*(?:no\.?|number|nos\.?|#)?\s*[-#]?\s*\d{1,3}[a-z]?\s*)+)/i);
    if (trailing) {
      const more = trailing[1].match(/(\d{1,3})\s*([a-z])?/gi) || [];
      more.forEach((chunk) => {
        const parts = chunk.match(/(\d{1,3})\s*([a-z])?/i);
        if (parts) {
          numbers.push(parts[1]);
          letters.push(parts[2] || '');
        }
      });
      pattern.lastIndex = match.index + match[0].length + trailing[0].length;
    }

    numbers.forEach((number, position) => {
      const letter = letters[position] || '';
      const suffix = letter ? `-${letter.toUpperCase()}` : '';
      const candidateCode = `${letter || ''}${number}`;
      const found = resolveVillaCode(letter ? `${number}${letter}` : number, index, phaseIdHint);
      if (found.status === 'matched') {
        add(found.location, found.via, `${keyword} ${number}${letter || ''}`);
        return;
      }
      if (found.status === 'ambiguous') {
        addAmbiguous(`${keyword} ${number}${letter || ''}`, found.candidates);
        return;
      }
      // Nothing in the records: try the phase letter as a code (Phase B "Villa 7").
      const phaseLetter = options.phaseCode ? normalizeCode(`${options.phaseCode}-${number}${suffix}`) : '';
      const byPhase = phaseLetter ? index.byCode.get(phaseLetter) : null;
      if (byPhase && found.status === 'unknown') add(byPhase, 'phase-code', `${keyword} ${number}${candidateCode ? '' : ''}`);
      else if (!byPhase) unknown.push(`${keyword} ${number}${letter || ''}`);
    });

    if (!trailing) pattern.lastIndex = match.index + match[0].length;
    match = pattern.exec(raw);
  }

  // 3. A bare list after "villas" already handled above; a lonely number is not
  //    a villa reference at all and is deliberately ignored.
  const blank = !resolved.length && !ambiguous.length && !unknown.length;
  return { resolved, ambiguous, unknown, blank, phaseHint: phaseIdHint };
}

/** Reference text for a plot list, used when reporting an ambiguity. */
export const phraseOf = (references) => (references || []).filter(Boolean).join(' ').trim();