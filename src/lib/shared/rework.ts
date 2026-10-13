/**
 * FRONTEND COPY of the rework helpers in base44/shared/rework.ts — the browser may not
 * import from base44/. A parity test keeps the two in step.
 */
export const REJECTION_CATEGORIES = ['Workmanship', 'Incomplete', 'Wrong material', 'Not to drawing', 'Other'];
export const REJECTABLE_FROM = ['Execution Complete', 'Under Inspection'];

export const isRework = (task) => (Number(task?.rejection_count) || 0) > 0;
