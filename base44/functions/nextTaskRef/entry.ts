import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { canEditTasks, resolveRank } from '../../shared/access.ts';
import { allocateTaskRef } from '../../shared/taskRef.ts';

/**
 * Allocates the next permanent task reference for a project + phase,
 * e.g. IMG-A-0001. Project-level common work uses the GEN phase code.
 * Only a user who may create tasks on that project can obtain one.
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

    const rank = await resolveRank(base44, projectId, user);
    if (!canEditTasks(rank)) {
      return Response.json(
        { error: 'You do not have permission to create tasks on this project.' },
        { status: 403 },
      );
    }

    const task_ref = await allocateTaskRef(base44.asServiceRole, projectId, phaseId);
    return Response.json({ task_ref });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}