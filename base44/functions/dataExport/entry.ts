import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isAppAdmin } from '../../shared/access.ts';

const ENTITIES = [
  'Project', 'Phase', 'Location', 'Contractor', 'ContractorDefault', 'WorkPackage', 'Discipline',
  'ProjectMembership', 'Task', 'TaskDependency', 'TaskHistory', 'BaselineVersion',
];

/**
 * One page of raw business records for the migration export. Internal ids and
 * timestamps are returned untouched; the caller stitches the pages together.
 * Application administrators only, and profiles only — never credentials.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAppAdmin(user)) {
      return Response.json({ error: 'Only an application administrator can export data.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const entity = String(body?.entity || '');
    const limit = Math.min(Math.max(Number(body?.limit) || 500, 1), 1000);
    const cursor = body?.cursor ? String(body.cursor) : null;
    const svc = base44.asServiceRole.entities;

    if (entity === 'User') {
      const listed = await svc.User.list();
      const rows = (Array.isArray(listed) ? listed : listed?.items || []).map((record) => ({
        id: record.id,
        email: record.email || '',
        full_name: record.full_name || '',
        role: record.role || 'user',
        created_date: record.created_date || null,
      }));
      return Response.json({ entity, rows, next_cursor: null, has_more: false });
    }

    if (!ENTITIES.includes(entity)) {
      return Response.json({ error: 'Unknown entity' }, { status: 400 });
    }

    const models = {
      Project: svc.Project,
      Phase: svc.Phase,
      Location: svc.Location,
      Contractor: svc.Contractor,
      ContractorDefault: svc.ContractorDefault,
      WorkPackage: svc.WorkPackage,
      Discipline: svc.Discipline,
      ProjectMembership: svc.ProjectMembership,
      Task: svc.Task,
      TaskDependency: svc.TaskDependency,
      TaskHistory: svc.TaskHistory,
      BaselineVersion: svc.BaselineVersion,
    };

    const options = { sort: '-created_date', limit };
    if (cursor) options.cursor = cursor;
    const page = await models[entity].filter({}, options);
    const rows = page?.items || (Array.isArray(page) ? page : []);

    return Response.json({
      entity,
      rows,
      next_cursor: page?.next_cursor || null,
      has_more: !!page?.has_more,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}