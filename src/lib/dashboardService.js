import { base44 } from '@/api/base44Client';

/**
 * One client entry point for every management dashboard. The server owns the
 * calculation and the permission boundary; this only passes the filters the
 * user chose and returns what came back.
 */
export async function loadDashboard(view, params = {}) {
  const res = await base44.functions.invoke('dashboardData', { view, ...params });
  return res?.data || {};
}

export const DASHBOARD_VIEWS = [
  'executive',
  'villa',
  'contractor',
  'planning',
  'blockers',
  'meeting',
  'handover',
  'sitewide',
  'attention',
  'myWork',
  'counts',
  'matrix',
  'statement',
  'adoption',
  'tasks',
];