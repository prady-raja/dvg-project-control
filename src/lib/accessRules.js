/**
 * The permissions the interface shows. These mirror the server's rules so
 * buttons match what the server will allow — they never replace it. Every
 * action is re-checked on the server from the signed-in session.
 */

import { APP_ADMIN_RANK, ROLE_RANK } from '@/lib/shared/enums.ts';

export { APP_ADMIN_RANK, ROLE_RANK };

export const rankForRole = (role) =>
  Object.prototype.hasOwnProperty.call(ROLE_RANK, role) ? ROLE_RANK[role] : -1;

/** Minimum rank each capability needs. */
export const CAPABILITY_RANK = {
  view: 0,
  edit_tasks: 1,
  manage_project: 2,
  approve: 2,
  baselines: 2,
  lifecycle: 2,
  // Only the application administrator manages people and permissions.
  members: APP_ADMIN_RANK,
  projects: APP_ADMIN_RANK,
};

export const can = (rank, capability) => rank >= (CAPABILITY_RANK[capability] ?? 0);

export const NO_ACCESS_MESSAGE = 'You do not have access to this project yet.';

export const ROLE_GUIDE = [
  { role: 'Project Editor', detail: 'The operational level used by every staff user: tasks, daily reports, imports and exports, snags, drawings, meeting commitments, forecast revisions, approvals of other people’s work, dashboards and the AI assistant.' },
  { role: 'Project Admin', detail: 'Legacy level. Same operational rights as a Project Editor; managing users and permissions is reserved for the application administrator.' },
  { role: 'Project Manager', detail: 'Legacy level, kept for records written before Project Editor. Same operational rights as a Project Editor.' },
  { role: 'Site Engineer', detail: 'Legacy read-and-update level. Creates and updates permitted tasks; cannot approve, close, change an approved baseline or archive.' },
  { role: 'Supervisor', detail: 'Legacy level, same as Site Engineer for task entry.' },
  { role: 'Viewer', detail: 'Read-only.' },
];

export const DISABLED_ROLE_NOTE =
  'The Contractor role stays disabled: contractors are never given a sign-in to this application.';

export const APP_ADMIN_NOTE =
  'The application administrator is appointed by the app owner on the App Users page. No screen in this app can grant that role, so nobody can promote themselves.';