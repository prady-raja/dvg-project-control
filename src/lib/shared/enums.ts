/**
 * FRONTEND COPY of base44/shared/enums.ts — the browser may not import from
 * base44/, so the fixed lists the screens need live here too. Keep the two in
 * step whenever a list changes.
 *
 * Every fixed list the application agrees on, defined once (U-01).
 */

export const TASK_STATUSES = [
  'Not Started', 'In Progress', 'Blocked', 'Execution Complete', 'Under Inspection', 'Approved', 'Closed',
];

export const OPEN_TASK_STATUSES = TASK_STATUSES.filter((status) => status !== 'Closed');

/** The four categories every status falls into, from the worker's point of view. */
export const STATUS_CATEGORIES = ['To do', 'Active', 'Stuck', 'Done'];

export const STATUS_CATEGORY = {
  'Not Started': 'To do',
  'In Progress': 'Active',
  Blocked: 'Stuck',
  'Execution Complete': 'Done',
  'Under Inspection': 'Done',
  Approved: 'Done',
  Closed: 'Done',
};

export const statusCategoryOf = (status) => STATUS_CATEGORY[status] || 'To do';

/** One line per status, shown as a tooltip and in the glossary. */
export const STATUS_HELP = {
  'Not Started': 'Planned, but no work has been reported yet.',
  'In Progress': 'Work is under way on site.',
  Blocked: 'Work cannot continue until a recorded blocker is cleared.',
  'Execution Complete': 'The contractor says the work is finished. It still needs DVG to inspect it.',
  'Under Inspection': 'DVG is inspecting the finished work.',
  Approved: 'DVG has verified the work. It stays open until it is closed after handover checks.',
  Closed: 'Verified and finished. Nothing more to do.',
};

/** Every task starts here. Completion, inspection, approval and closure are recorded on the task. */
export const OPENING_STATUSES = ['Not Started', 'In Progress', 'Blocked'];

/** Work may only be approved from one of these, and closed from these or Approved. */
export const APPROVABLE_FROM = ['Execution Complete', 'Under Inspection'];
export const CLOSABLE_FROM = ['Approved', 'Execution Complete', 'Under Inspection'];

/** Statuses the server accepts as the next status of a task (the same rule as taskWriteRules). */
export function allowedNextStatuses(current) {
  const from = current || 'Not Started';
  return TASK_STATUSES.filter((status) => {
    if (status === from) return true;
    if (status === 'Approved') return APPROVABLE_FROM.includes(from);
    if (status === 'Closed') return CLOSABLE_FROM.includes(from);
    return true;
  });
}

export const BLOCKER_CATEGORIES = [
  'Previous Work Incomplete', 'Materials Pending', 'Client Selection Pending', 'Owner Access Pending',
  'Drawing / Design Clarification', 'Contractor Manpower', 'DVG Approval', 'External Utility / Authority', 'Other',
];

/** Who has to act to clear a blocker (F-02). */
export const CONSTRAINT_OWNER_TYPES = ['Contractor', 'DVG', 'Villa owner', 'Consultant', 'Authority'];

/** Blocker categories whose natural owner is the villa owner. */
export const OWNER_DEFAULT_CATEGORIES = ['Owner Access Pending', 'Client Selection Pending'];

export const defaultOwnerTypeFor = (category) => (OWNER_DEFAULT_CATEGORIES.includes(category) ? 'Villa owner' : 'Contractor');

/** Why a forecast moved, so delay causes can be counted (P-01). */
export const DELAY_CATEGORIES = [
  'Drawing/Design', 'Material', 'Labour', 'Predecessor', 'Client decision', 'Weather', 'Access', 'Rework', 'Other',
];

export const HEALTH_STATES = ['On track', 'At risk', 'Late'];

/**
 * Project roles. Admin / Project Editor / Viewer is the target set; the legacy
 * roles stay valid until the memberships carrying them are migrated.
 */
export const ROLE_RANK = {
  Viewer: 0,
  Supervisor: 1,
  'Site Engineer': 1,
  'Project Editor': 2,
  'Project Manager': 2,
  'Project Admin': 3,
};

export const MEMBERSHIP_ROLES = ['Project Editor', 'Viewer', 'Project Admin', 'Project Manager', 'Site Engineer', 'Supervisor'];

/** The roles an invite or a role change may offer today. */
export const ASSIGNABLE_ROLES = ['Project Editor', 'Viewer'];

export const LEGACY_ROLE_TARGET = {
  'Project Admin': 'Project Editor',
  'Project Manager': 'Project Editor',
  'Site Engineer': 'Project Editor',
  Supervisor: 'Project Editor',
};

export const APP_ADMIN_RANK = 4;