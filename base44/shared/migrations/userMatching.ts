import { matchMember } from '../assignees.ts';

/**
 * T-01: map the free-text names already on tasks, villas and commitments to the
 * project's real members. Only a clear single match is applied; ambiguous or
 * unknown names are left for the fix-up screen, and the old text is never erased.
 */
export const userMatching = {
  id: 'user-matching',
  description: 'Set assignee_user_id, assigned_engineer_user_id and responsible_user_id from the names already recorded.',
  entities: {
    ProjectMembership: { active: true },
    Task: { archived: { $ne: true } },
    Location: {},
    MeetingCommitment: {},
  },
  plan({ ProjectMembership: memberships = [], Task: tasks = [], Location: locations = [], MeetingCommitment: commitments = [] }) {
    const membersOf = new Map();
    memberships.forEach((m) => {
      if (!m.user_id) return;
      if (!membersOf.has(m.project_id)) membersOf.set(m.project_id, []);
      membersOf.get(m.project_id).push({ user_id: m.user_id, name: m.user_name, email: m.user_email, initials: m.initials });
    });
    const find = (projectId, name) => matchMember(name, membersOf.get(projectId) || [])?.user_id || '';
    const patches = [];
    tasks.forEach((t) => {
      if (t.assignee_user_id || !t.responsible_engineer) return;
      const id = find(t.project_id, t.responsible_engineer);
      if (id) patches.push({ entity: 'Task', id: t.id, data: { assignee_user_id: id } });
    });
    locations.forEach((l) => {
      if (l.assigned_engineer_user_id || !l.assigned_engineer) return;
      const id = find(l.project_id, l.assigned_engineer);
      if (id) patches.push({ entity: 'Location', id: l.id, data: { assigned_engineer_user_id: id } });
    });
    commitments.forEach((c) => {
      if (c.responsible_user_id || !c.responsible_person) return;
      const id = find(c.project_id, c.responsible_person);
      if (id) patches.push({ entity: 'MeetingCommitment', id: c.id, data: { responsible_user_id: id } });
    });
    return patches;
  },
};

/**
 * The fix-up screen's hand-made mapping, as a one-off migration: every task,
 * villa and commitment of the project carrying exactly this typed name gets the
 * chosen member.
 */
export function assignNamesMigration({ projectId, mapping }) {
  const wanted = new Map(Object.entries(mapping || {}).filter(([name, userId]) => name && userId));
  return {
    id: `assign-names:${projectId}`,
    description: `Assign ${wanted.size} typed name(s) to project members.`,
    entities: {
      Task: { project_id: projectId, archived: { $ne: true } },
      Location: { project_id: projectId },
      MeetingCommitment: { project_id: projectId },
    },
    plan({ Task: tasks = [], Location: locations = [], MeetingCommitment: commitments = [] }) {
      const patches = [];
      tasks.forEach((t) => {
        const userId = wanted.get(t.responsible_engineer);
        if (userId && !t.assignee_user_id) patches.push({ entity: 'Task', id: t.id, data: { assignee_user_id: userId } });
      });
      locations.forEach((l) => {
        const userId = wanted.get(l.assigned_engineer);
        if (userId && !l.assigned_engineer_user_id) patches.push({ entity: 'Location', id: l.id, data: { assigned_engineer_user_id: userId } });
      });
      commitments.forEach((c) => {
        const userId = wanted.get(c.responsible_person);
        if (userId && !c.responsible_user_id) patches.push({ entity: 'MeetingCommitment', id: c.id, data: { responsible_user_id: userId } });
      });
      return patches;
    },
  };
}
