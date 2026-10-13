import { LEGACY_ROLE_TARGET } from '../enums.ts';

/** X-02: move memberships still on a legacy role to Project Editor (or Viewer where already Viewer). */
export const legacyRoles = {
  id: 'legacy-roles',
  description: 'Move legacy membership roles (Project Admin, Project Manager, Site Engineer, Supervisor) to Project Editor.',
  entities: { ProjectMembership: {} },
  plan({ ProjectMembership: memberships = [] }) {
    return memberships
      .filter((m) => LEGACY_ROLE_TARGET[m.role])
      .map((m) => ({ entity: 'ProjectMembership', id: m.id, data: { role: LEGACY_ROLE_TARGET[m.role] } }));
  },
};
