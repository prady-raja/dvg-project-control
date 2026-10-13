import { DELAY_CATEGORIES } from '../enums.ts';
import { categoryForReason } from '../delay.ts';

export { categoryForReason };

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
