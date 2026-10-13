import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadDashboard } from '@/lib/dashboardService';
import { WORK_KEYS } from '@/lib/queries/keys';

/** A dashboard view read through react-query: cached, shared between screens, and refreshed by invalidateWork(). */
export function useDashboardQuery(view, params, { key, enabled = true, staleTime = 60000 } = {}) {
  return useQuery({
    queryKey: key || ['dashboard', view, params],
    queryFn: () => loadDashboard(view, params),
    enabled,
    staleTime,
  });
}

/** Call after saving a report, a status change or a constraint so Today and the menu counts catch up. */
export function useInvalidateWork() {
  const client = useQueryClient();
  return () => Promise.all(WORK_KEYS.map((key) => client.invalidateQueries({ queryKey: [key] })));
}
