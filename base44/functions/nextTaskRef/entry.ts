import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * Allocates the next permanent task reference for a project + phase,
 * e.g. IMG-A-0001. Project-level common work uses the GEN phase code.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const projectId = typeof body?.project_id === 'string' ? body.project_id : '';
    const phaseId = typeof body?.phase_id === 'string' ? body.phase_id : '';
    if (!projectId) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    const projectRes = await base44.entities.Project.filter({ id: projectId }, { limit: 1 });
    const project = (projectRes?.items || projectRes || [])[0];
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    const projectCode = String(project.code || 'PRJ').toUpperCase().trim();

    let phaseCode = 'GEN';
    if (phaseId) {
      const phaseRes = await base44.entities.Phase.filter({ id: phaseId }, { limit: 1 });
      const phase = (phaseRes?.items || phaseRes || [])[0];
      if (phase && phase.code) phaseCode = String(phase.code).toUpperCase().trim();
    }

    const prefix = `${projectCode}-${phaseCode}-`;
    const existingRes = await base44.entities.Task.filter(
      { task_ref: { $regex: `^${prefix}` } },
      { sort: '-task_ref', limit: 1 },
    );
    const existing = existingRes?.items || existingRes || [];

    let next = 1;
    if (existing.length > 0 && existing[0].task_ref) {
      const match = String(existing[0].task_ref).match(/(\d+)$/);
      if (match) next = parseInt(match[1], 10) + 1;
    }

    return Response.json({ task_ref: `${prefix}${String(next).padStart(4, '0')}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}