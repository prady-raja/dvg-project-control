import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fail } from '../../shared/records.ts';
import { heldLocationIds, metricTasks, shiftDay, taskRow, todayIst } from '../../shared/dashboardCore.ts';
import { buildSnapshots, changeSinceLastWeek, isSnapshotTime, snapshotMetricsOf } from '../../shared/snapshots.ts';
import { actionFor } from '../../shared/dashboardCore.ts';
import { contractorBoardView, executiveView, planningView, villaExecutionView } from '../../shared/dashboardViews.ts';
import { blockerBoardView, handoverBoardView, meetingReportView, siteWideView } from '../../shared/dashboardBoards.ts';
import { attentionFor } from '../../shared/attention.ts';
import { countsView, myWorkView } from '../../shared/myWork.ts';
import { villaListView, villaMatrixView, villaStatementView } from '../../shared/villaViews.ts';
import { adoptionView } from '../../shared/adoption.ts';
import { activeMembers } from '../../shared/access.ts';
import { loadProjectData, scopeFor, viewHeader } from '../../shared/projectData.ts';
import { isAppAdmin } from '../../shared/access.ts';
import { makeDb } from '../../shared/dbCore.ts';
import { withLog } from '../../shared/log.ts';
import { commitmentSummary } from '../../shared/commitments.ts';
import { coverageView } from '../../shared/coverage.ts';

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
  updates: ['contractor', 'villa', 'handover', 'attention', 'blockers', 'meeting', 'myWork', 'adoption', 'coverage'].includes(view),
  dependencies: ['blockers', 'meeting', 'villa', 'attention', 'executive', 'planning', 'tasks', 'contractor', 'myWork', 'counts'].includes(view),
  commitments: ['meeting', 'myWork', 'executive'].includes(view),
  snags: ['handover', 'villa', 'myWork', 'counts', 'statement', 'villaList'].includes(view),
  proposals: ['myWork'].includes(view),
  constraints: ['blockers', 'myWork'].includes(view),
  dismissals: ['attention', 'counts'].includes(view),
});

async function handler(req) {
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
      itemLimit: Math.min(Math.max(Number(body?.itemLimit) || 40, 10), 500),
      code: String(body?.code || ''),
      offset: Math.max(Number(body?.offset) || 0, 0),
      meetingDate: DATE.test(String(body?.meetingDate || '')) ? String(body.meetingDate) : '',
    };

    const data = await loadProjectData(base44, user, {
      projectIds: scope.projectIds,
      projectId: scope.projectId,
      asOf,
      ...needsFor(view),
    });
    const ix = data.ix;
    options.locations = data.locations;
    const heldIds = heldLocationIds(data.locations);
    const header = {
      ...viewHeader(asOf, { project_id: scope.projectId, phase_id: phaseId }),
      view,
      projects: data.projects.map((p) => ({ id: p.id, name: p.name, code: p.code || '' })),
      phases: data.phases.map((p) => ({ id: p.id, project_id: p.project_id, name: p.name, code: p.code || '' })),
      // Which collections were read only in part, so a screen can say so instead of showing a short list as whole.
      meta: data.meta,
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
        return Response.json({ ...header, ...blockerBoardView({ ...common, dependencies: data.dependencies, heldIds, constraints: data.constraints }) });
      case 'meeting':
        return Response.json({ ...header, ...meetingReportView({ ...common, dependencies: data.dependencies, commitments: data.commitments }) });
      case 'handover':
        return Response.json({ ...header, ...handoverBoardView({ ...common, snags: data.snags }) });
      case 'adoption': {
        if (!isAppAdmin(user)) throw fail('Administrator access required.', 403);
        const members = scope.projectId
          ? await activeMembers(base44, scope.projectId)
          : [];
        return Response.json({
          ...header,
          ...adoptionView({
            updates: data.updates, members, locations: data.locations.filter((l) => !scope.projectId || l.project_id === scope.projectId),
            settings: ix.settings(scope.projectId || data.projects[0]?.id), asOf,
          }),
        });
      }
      case 'coverage': {
        const db = makeDb({ entities: base44.asServiceRole.entities });
        const projectId = scope.projectId || data.projects[0]?.id || '';
        const members = projectId ? await activeMembers(base44, projectId) : [];
        return Response.json({
          ...header,
          ...coverageView({
            locations: data.locations.filter((l) => !projectId || l.project_id === projectId),
            updates: data.updates, tasks: data.tasks.filter((t) => !projectId || t.project_id === projectId),
            members, settings: ix.settings(projectId), asOf,
            diaries: projectId ? (await db.readAll('SiteDiary', { project_id: projectId, diary_date: { $gte: shiftDay(asOf, -30) } }, { max: 100 })).items : [],
          }),
        });
      }
      case 'villaList':
        return Response.json({ ...header, ...villaListView({ tasks: data.tasks, locations: data.locations, snags: data.snags, ix, asOf, options }) });
      case 'matrix':
        return Response.json({
          ...header,
          ...villaMatrixView({
            tasks: data.tasks, locations: data.locations, ix, asOf,
            options: { ...options, possession: ['Handed Over', 'Not Handed Over'].includes(body?.possession) ? body.possession : '' },
          }),
        });
      case 'statement': {
        const location = data.locations.find((l) => l.id === options.locationId);
        if (!location) throw fail('That villa was not found in your projects.', 404);
        const floors = (await makeDb({ entities: base44.asServiceRole.entities }).readAll('VillaFloor', { location_id: location.id })).items;
        return Response.json({ ...header, ...villaStatementView({ location, tasks: data.tasks, snags: data.snags, floors, ix, asOf, options }) });
      }
      case 'myWork':
        return Response.json({
          ...header,
          ...myWorkView({
            ...common, locations: data.locations, commitments: data.commitments, snags: data.snags, updates: data.updates,
            proposals: data.proposals, user, options: { ...options, allVillas: body?.allVillas === true },
          }),
        });
      case 'counts':
        return Response.json({ ...header, ...countsView({ ...common, snags: data.snags, dependencies: data.dependencies, dismissals: data.dismissals, user }) });
      case 'sitewide':
        return Response.json({ ...header, ...siteWideView(common) });
      case 'attention': {
        // The review view that goes with the register: what is missing, what is
        // contradictory, and what is ready. Read-only by design.
        const db = makeDb({ entities: base44.asServiceRole.entities });
        const registerFilter = scope.projectId ? { project_id: scope.projectId } : { project_id: { $in: scope.projectIds } };
        const [areasRes, floorsRes] = await Promise.all([
          db.readAll('VillaArea', registerFilter),
          db.readAll('VillaFloor', registerFilter),
        ]);
        return Response.json({
          ...header,
          ...attentionFor({
            tasks: data.tasks,
            locations: data.locations,
            areas: areasRes.items,
            floors: floorsRes.items,
            dependencies: data.dependencies,
            updates: data.updates,
            dismissals: data.dismissals,
            asOf,
            ix,
            options,
          }),
        });
      }
      case 'tasks': {
        const metric = String(body?.metric || 'open');
        const list = metricTasks(data.tasks, metric, asOf, {
          locations: data.locations,
          heldIds,
          settingsFor: (projectId) => ix.settings(projectId),
          dependencies: data.dependencies,
          projectId: options.projectId,
          phaseId: options.phaseId,
          includeDemo: options.includeDemo,
        });
        // A matrix cell opens one villa's discipline; other tiles leave these blank.
        const narrowed = list.filter((t) => (!options.locationId || t.location_id === options.locationId)
          && (!options.discipline || t.discipline === options.discipline)
          && (!options.contractorId || t.contractor_id === options.contractorId));
        return Response.json({
          ...header,
          metric,
          total: narrowed.length,
          offset: options.offset,
          rows: narrowed.slice(options.offset, options.offset + options.itemLimit).map((task) => {
            const row = taskRow(task, ix, asOf);
            return { ...row, action: actionFor(row) };
          }),
        });
      }
      default: {
        const view = { ...executiveView(common), commitments: commitmentSummary(data.commitments.filter((c) => (!scope.projectId || c.project_id === scope.projectId) && (!phaseId || c.phase_id === phaseId)), asOf) };
        // History starts being kept now: the day's snapshot is written lazily by the
        // first read after 23:30 IST, and the change since last week is read back.
        const db = makeDb({ entities: base44.asServiceRole.entities });
        try {
          if (asOf === todayIst() && isSnapshotTime()) {
            const have = await db.count('MetricSnapshot', { project_id: { $in: scope.projectIds }, scope_type: 'project', snapshot_date: asOf });
            if (have < data.projects.length) {
              const members = Object.fromEntries(data.projects.map((p) => [p.id, p.member_ids || []]));
              const rows = buildSnapshots({ data, asOf, memberIdsByProject: members });
              for (const row of rows) await db.upsertByKey('MetricSnapshot', ['scope_type', 'scope_id', 'snapshot_date'], row);
            }
          }
          const scopeType = phaseId ? 'phase' : 'project';
          const filter = {
            project_id: { $in: scope.projectId ? [scope.projectId] : scope.projectIds },
            scope_type: scopeType,
            ...(phaseId ? { scope_id: phaseId } : scope.projectId ? { scope_id: scope.projectId } : {}),
            snapshot_date: { $gte: shiftDay(asOf, -8), $lte: shiftDay(asOf, -6) },
          };
          const found = await db.list('MetricSnapshot', filter, { limit: 100 });
          // With no single project in view, add the projects' snapshots of the same day together.
          const byDate = new Map();
          found.forEach((s) => {
            const sum = byDate.get(s.snapshot_date) || { snapshot_date: s.snapshot_date, metrics: {} };
            Object.entries(s.metrics || {}).forEach(([k, v]) => { sum.metrics[k] = (sum.metrics[k] || 0) + (Number(v) || 0); });
            byDate.set(s.snapshot_date, sum);
          });
          view.change_since_last_week = changeSinceLastWeek({
            snapshots: [...byDate.values()],
            current: snapshotMetricsOf(view),
            asOf,
          });
        } catch (error) {
          // History is an extra: a failure here never hides the figures themselves.
          view.change_since_last_week = null;
          view.snapshot_error = String(error?.message || error).slice(0, 200);
        }
        return Response.json({ ...header, ...view });
      }
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('dashboardData', handler);
