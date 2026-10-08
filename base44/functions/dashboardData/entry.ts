import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fail } from '../../shared/records.ts';
import { heldLocationIds, metricTasks, taskRow, todayIst } from '../../shared/dashboardCore.ts';
import { actionFor } from '../../shared/dashboardCore.ts';
import { contractorBoardView, executiveView, planningView, villaExecutionView } from '../../shared/dashboardViews.ts';
import { blockerBoardView, handoverBoardView, meetingReportView, siteWideView } from '../../shared/dashboardBoards.ts';
import { loadProjectData, scopeFor, viewHeader } from '../../shared/projectData.ts';
import { isAppAdmin } from '../../shared/access.ts';

/**
 * One guarded read path for every management dashboard.
 *
 * The permitted project list is derived from the signed-in user's own
 * membership before anything is read, so a filter sent by the browser can never
 * widen the scope. Every figure is computed here from records; the screens only
 * render it.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const needsFor = (view) => ({
  updates: ['contractor', 'villa', 'handover'].includes(view),
  dependencies: ['blockers', 'meeting', 'villa'].includes(view),
  commitments: ['meeting'].includes(view),
  snags: ['handover', 'villa'].includes(view),
});

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const view = String(body?.view || 'executive');
    const projectId = String(body?.projectId || '');
    const phaseId = String(body?.phaseId || '');
    const asOf = DATE.test(String(body?.date || '')) ? String(body.date) : todayIst();

    const scope = await scopeFor(base44, user, projectId);
    if (!scope.allowed) throw fail('You are not a member of this project.', 403);
    if (!scope.projectIds.length) {
      return Response.json({ ...viewHeader(asOf, { project_id: '', phase_id: '' }), view, empty: true, reason: 'You are not a member of any project yet.' });
    }

    const options = {
      projectId: scope.projectId,
      phaseId,
      locationId: String(body?.locationId || ''),
      contractorId: String(body?.contractorId || ''),
      discipline: String(body?.discipline || ''),
      includeDemo: isAppAdmin(user) && body?.includeDemo === true,
      itemLimit: Math.min(Math.max(Number(body?.itemLimit) || 40, 10), 200),
    };

    const data = await loadProjectData(base44, user, {
      projectIds: scope.projectIds,
      projectId: scope.projectId,
      asOf,
      ...needsFor(view),
    });
    const ix = data.ix;
    const heldIds = heldLocationIds(data.locations);
    const header = {
      ...viewHeader(asOf, { project_id: scope.projectId, phase_id: phaseId }),
      view,
      projects: data.projects.map((p) => ({ id: p.id, name: p.name, code: p.code || '' })),
      phases: data.phases.map((p) => ({ id: p.id, project_id: p.project_id, name: p.name, code: p.code || '' })),
    };
    const common = { tasks: data.tasks, locations: data.locations, phases: data.phases, projects: data.projects, ix, options, asOf };

    switch (view) {
      case 'villa': {
        const location = data.locations.find((l) => l.id === options.locationId);
        if (!location) throw fail('That villa or location was not found in your projects.', 404);
        return Response.json({ ...header, ...villaExecutionView({ ...common, location, snags: data.snags, dependencies: data.dependencies }) });
      }
      case 'contractor':
        return Response.json({ ...header, ...contractorBoardView({ ...common, contractors: data.contractors, updates: data.updates }) });
      case 'planning':
        return Response.json({ ...header, ...planningView(common) });
      case 'blockers':
        return Response.json({ ...header, ...blockerBoardView({ ...common, dependencies: data.dependencies, heldIds }) });
      case 'meeting':
        return Response.json({ ...header, ...meetingReportView({ ...common, dependencies: data.dependencies, commitments: data.commitments }) });
      case 'handover':
        return Response.json({ ...header, ...handoverBoardView({ ...common, snags: data.snags }) });
      case 'sitewide':
        return Response.json({ ...header, ...siteWideView(common) });
      case 'tasks': {
        const metric = String(body?.metric || 'open');
        const list = metricTasks(data.tasks, metric, asOf, { locations: data.locations, heldIds });
        return Response.json({
          ...header,
          metric,
          total: list.length,
          rows: list.slice(0, options.itemLimit).map((task) => {
            const row = taskRow(task, ix, asOf);
            return { ...row, action: actionFor(row) };
          }),
        });
      }
      default:
        return Response.json({ ...header, ...executiveView(common) });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}