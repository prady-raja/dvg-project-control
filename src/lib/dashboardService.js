import { base44 } from '@/api/base44Client';

/**
 * One client entry point for every management dashboard. The server owns the
 * calculation and the permission boundary; this only passes the filters the
 * user chose and returns what came back.
 */
export async function loadDashboard(view, params = {}) {
  const res = await base44.functions.invoke('dashboardData', { view, ...params });
  const data = res?.data || {};
  // A collection that was read only in part is said so on the screen, never shown as whole.
  const cut = data.meta?.truncated || [];
  if (cut.length) {
    data.warnings = [...(data.warnings || []), `These figures are incomplete: ${cut.join(', ')} were larger than one safe read. Narrow the project or phase.`];
  }
  return data;
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