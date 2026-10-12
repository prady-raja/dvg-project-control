import { useEffect, useState } from 'react';
import { data } from '@/api/data';

const cache = new Map();

/**
 * The people who can be given work on a project: its active members who have
 * signed in (they have a user id). Members can already read these rows, so no
 * extra permission is needed; the list is kept per project for the session.
 */
export function useProjectMembers(projectId) {
  const [members, setMembers] = useState(() => cache.get(projectId) || []);
  const [loading, setLoading] = useState(!!projectId && !cache.has(projectId));

  useEffect(() => {
    if (!projectId) {
      setMembers([]);
      setLoading(false);
      return undefined;
    }
    if (cache.has(projectId)) {
      setMembers(cache.get(projectId));
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    data
      .list('ProjectMembership', { project_id: projectId, active: true }, { limit: 200 })
      .then((rows) => {
        const list = rows
          .filter((m) => m.user_id)
          .map((m) => ({
            user_id: m.user_id,
            name: m.user_name || m.user_email,
            email: m.user_email,
            phone: m.phone || '',
            initials: m.initials || '',
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        cache.set(projectId, list);
        if (alive) setMembers(list);
      })
      .catch(() => {
        if (alive) setMembers([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return { members, loading };
}

/** Forget the cached list after membership changes. */
export const forgetProjectMembers = (projectId) => (projectId ? cache.delete(projectId) : cache.clear());
