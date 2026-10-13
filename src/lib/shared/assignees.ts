/**
 * FRONTEND COPY of the name matching in base44/shared/assignees.ts — the browser
 * may not import from base44/, so the rule that reads a typed name as a project
 * member lives here too. Keep the two in step.
 */

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