import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { APP_ADMIN_RANK, can } from '@/lib/accessRules';

const AccessContext = createContext(null);

const EMPTY = { loading: true, appAdmin: false, ranks: {}, roles: {}, user: null, failed: false };

/**
 * The signed-in user's own project roles, read from the server. Used to show
 * the right controls — the server enforces every action independently.
 */
export function AccessProvider({ children }) {
  const [state, setState] = useState(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getMyAccess', {});
      const data = res?.data || {};
      const ranks = {};
      const roles = {};
      (data.memberships || []).forEach((m) => {
        ranks[m.project_id] = m.rank;
        roles[m.project_id] = m.role;
      });
      setState({ loading: false, appAdmin: !!data.app_admin, ranks, roles, user: data.user || null, failed: false });
    } catch (error) {
      setState({ ...EMPTY, loading: false, failed: true, error: error?.message || '' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => {
    const rankFor = (projectId) => {
      if (state.appAdmin) return APP_ADMIN_RANK;
      if (!projectId) return -1;
      const rank = state.ranks[projectId];
      return rank === undefined ? -1 : rank;
    };
    return {
      ...state,
      refresh,
      rankFor,
      roleFor: (projectId) => (state.appAdmin ? 'Application Admin' : state.roles[projectId] || ''),
      can: (projectId, capability) => can(rankFor(projectId), capability),
      /** True when the user may do this on at least one project. */
      canAnywhere: (capability) =>
        state.appAdmin || Object.values(state.ranks).some((rank) => can(rank, capability)),
      projectIds: Object.keys(state.ranks),
      hasAnyProject: state.appAdmin || Object.keys(state.ranks).length > 0,
    };
  }, [state, refresh]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used inside AccessProvider');
  return ctx;
}