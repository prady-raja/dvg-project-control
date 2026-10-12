/**
 * Why a forecast date moved (P-01). The reason is free text for people; the
 * category is a fixed list so delay causes can be counted and ranked.
 */
import { DELAY_CATEGORIES } from './enums.ts';
import { fail } from './records.ts';

const KEYWORDS = [
  ['Drawing/Design', /drawing|design|clarification|detail|rfi|revision of (plan|layout)/i],
  ['Material', /material|stock|supply|delivery|procure|order|shortage/i],
  ['Labour', /labou?r|manpower|workers?|crew|gang|contractor.*(unavailable|delay)/i],
  ['Predecessor', /predecessor|previous work|earlier task|waiting for .* to (finish|complete)/i],
  ['Client decision', /client|selection|owner decision|approval from owner|choice/i],
  ['Weather', /rain|weather|monsoon|storm|flood/i],
  ['Access', /access|key|occupied|owner not available|entry/i],
  ['Rework', /rework|redo|defect|snag|rejected|reinspection/i],
];

/** The category a free-text reason most likely means; 'Other' when nothing matches, '' for no reason. */
export function categoryForReason(reason) {
  const text = String(reason || '').trim();
  if (!text) return '';
  const hit = KEYWORDS.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : 'Other';
}

/**
 * The category to store with a forecast change. A person must choose one;
 * automatic paths (an import, an AI-confirmed site message) pass `infer` and get
 * the category read from their reason instead of being refused.
 */
export function delayCategoryFor({ category, reason, infer = false }) {
  const chosen = String(category || '').trim();
  if (DELAY_CATEGORIES.includes(chosen)) return chosen;
  if (chosen) throw fail(`Choose one of the delay categories: ${DELAY_CATEGORIES.join(', ')}.`);
  if (infer) {
    const guessed = categoryForReason(reason);
    if (guessed) return guessed;
  }
  throw fail('Choose why the date moved (Drawing/Design, Material, Labour, Predecessor, Client decision, Weather, Access, Rework or Other).');
}
