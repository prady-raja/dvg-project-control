/** One place for query keys, so a save can refresh exactly the screens it affects. */
export const queryKeys = {
  myWork: (params) => ['myWork', params],
  navCounts: (projectId) => ['navCounts', projectId || 'all'],
  dashboard: (view, params) => ['dashboard', view, params],
  blockers: (params) => ['blockers', params],
};

/** Everything that shows work, refreshed after any write to a task, report or constraint. */
export const WORK_KEYS = ['myWork', 'navCounts', 'dashboard', 'blockers'];
