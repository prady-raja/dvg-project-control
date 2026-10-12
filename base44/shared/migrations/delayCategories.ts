import { DELAY_CATEGORIES } from '../enums.ts';

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

export const categoryForReason = (reason) => {
  const text = String(reason || '').trim();
  if (!text) return '';
  const hit = KEYWORDS.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : 'Other';
};

/** P-01: put each free-text forecast reason into a countable category. */
export const delayCategories = {
  id: 'delay-categories',
  description: 'Set Task.date_revision_category from the keywords in date_revision_reason.',
  entities: { Task: { archived: { $ne: true } } },
  plan({ Task: tasks = [] }) {
    return tasks
      .filter((t) => t.date_revision_reason && !t.date_revision_category)
      .map((t) => ({ entity: 'Task', id: t.id, data: { date_revision_category: categoryForReason(t.date_revision_reason) } }))
      .filter((patch) => DELAY_CATEGORIES.includes(patch.data.date_revision_category));
  },
};
