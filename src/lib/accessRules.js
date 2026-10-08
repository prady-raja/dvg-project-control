/**
 * The permissions the interface shows. These mirror the server's rules so
 * buttons match what the server will allow — they never replace it. Every
 * action is re-checked on the server from the signed-in session.
 */

export const ROLE_RANK = {
  Viewer: 0,
  Supervisor: 1,
  'Site Engineer': 1,
  'Project Manager': 2,
  'Project Admin': 3,
};

export const APP_ADMIN_RANK = 4;

export const rankForRole = (role) =>
  Object.prototype.hasOwnProperty.call(ROLE_RANK, role) ? ROLE_RANK[role] : -1;

/** Minimum rank each capability needs. */
export const CAPABILITY_RANK = {
  view: 0,
  edit_tasks: 1,
  manage_project: 2,
  approve: 2,
  baselines: 2,
  members: 2,
  lifecycle: 2,
  projects: APP_ADMIN_RANK,
};

export const can = (rank, capability) => rank >= (CAPABILITY_RANK[capability] ?? 0);

export const NO_ACCESS_MESSAGE = 'You do not have access to this project yet.';

export const ROLE_GUIDE = [
  { role: 'Project Admin', detail: 'Full control of the project, including who else is on it.' },
  { role: 'Project Manager', detail: 'Schedules, forecast dates, approvals, baselines, membership and archiving.' },
  { role: 'Site Engineer', detail: 'Creates and updates permitted tasks. Cannot approve, close, change an approved baseline, manage users or archive.' },
  { role: 'Supervisor', detail: 'Same as Site Engineer for task entry.' },
  { role: 'Viewer', detail: 'Read-only.' },
];

export const DISABLED_ROLE_NOTE =
  'The Contractor role stays disabled: contractors are never given a sign-in to this application.';

export const APP_ADMIN_NOTE =
  'The application administrator is appointed by the app owner on the App Users page. No screen in this app can grant that role, so nobody can promote themselves.';