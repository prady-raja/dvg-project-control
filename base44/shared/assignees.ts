/**
 * Assigning work to real people (T-01). A task points at a project member by user
 * id; the old free-text engineer name is kept as read-only history and is also
 * filled from the member's name so older screens and exports keep working.
 */
import { fail } from './records.ts';

export const normName = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const emailLocal = (email) => normName(String(email || '').split('@')[0]);

/**
 * The one member a typed name clearly means, or null. Exact name, then the part
 * of the email before the @, then a first name that only one member has. An
 * ambiguous name is never guessed: it is left for a person to fix.
 */
export function matchMember(name, members = []) {
  const wanted = normName(name);
  if (!wanted) return null;
  const pool = members.filter((m) => m.user_id);
  const unique = (list) => (list.length === 1 ? list[0] : null);

  const exact = unique(pool.filter((m) => normName(m.name) === wanted || normName(m.email) === wanted));
  if (exact) return exact;
  const local = unique(pool.filter((m) => emailLocal(m.email) === wanted || normName(m.initials) === wanted));
  if (local) return local;
  const first = unique(pool.filter((m) => normName(m.name).split(' ')[0] === wanted));
  if (first) return first;
  // "Rahul S" / "Rahul Sharma" against "Rahul Sharma": same first name and the same initial.
  const [firstWord, ...rest] = wanted.split(' ');
  if (rest.length) {
    return unique(pool.filter((m) => {
      const parts = normName(m.name).split(' ');
      return parts[0] === firstWord && rest.every((word, i) => (parts[i + 1] || '').startsWith(word[0]));
    }));
  }
  return null;
}

/**
 * The assignee fields to write for a task. A requested user must be an active
 * member of the project; with none requested, a new task inherits the villa's
 * engineer. The display name follows the user unless a name was typed.
 */
export function assigneeFor({ requested, members = [], location = null, isCreate = false, typedName = '' }) {
  const byId = new Map(members.map((m) => [m.user_id, m]));
  let userId = requested || '';
  if (userId && !byId.has(userId)) throw fail('The assignee must be an active member of this project.');
  if (!userId && isCreate && location?.assigned_engineer_user_id && byId.has(location.assigned_engineer_user_id)) {
    userId = location.assigned_engineer_user_id;
  }
  if (!userId) return {};
  const member = byId.get(userId);
  return {
    assignee_user_id: userId,
    ...(typedName ? {} : { responsible_engineer: member.name || member.email || null }),
  };
}

/** Watchers must also be members; anyone else is refused rather than dropped silently. */
export function checkWatchers(ids, members = []) {
  const known = new Set(members.map((m) => m.user_id));
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
  if (list.some((id) => !known.has(id))) throw fail('Watchers must be members of this project.');
  return list;
}
