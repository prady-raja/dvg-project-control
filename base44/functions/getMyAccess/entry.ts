import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  isAppAdmin,
  linkPendingMemberships,
  rankForRole,
  syncProjectMemberIds,
} from '../../shared/access.ts';
import { withLog } from '../../shared/log.ts';

/**
 * The signed-in user's own access: their application role and the project roles
 * they actually hold. The page uses this only to show or hide controls — every
 * action is re-checked on the server.
 *
 * Also claims any membership recorded against the user's email before they had
 * signed in, and mirrors the project's member list onto its records.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const appAdmin = isAppAdmin(user);
    const svc = base44.asServiceRole.entities;

    if (body?.action === 'sync_all') {
      if (!appAdmin) return Response.json({ error: 'Administrator access required' }, { status: 403 });
      const projects = (await svc.Project.filter({}, { limit: 200 })).items || [];
      const memberships = (await svc.ProjectMembership.filter({}, { limit: 500 })).items || [];
      for (const project of projects) await syncProjectMemberIds(base44, project.id, undefined, { force: true });
      return Response.json({ ok: true, projects: projects.length, memberships: memberships.length });
    }

    const claim = await linkPendingMemberships(base44, user);
    for (const projectId of [...new Set(claim.projectIds)]) {
      await syncProjectMemberIds(base44, projectId);
    }

    const res = await svc.ProjectMembership.filter({ user_id: user.id, active: true }, { limit: 200 });
    const memberships = (res?.items || res || []).map((m) => ({
      project_id: m.project_id,
      role: m.role,
      rank: rankForRole(m.role),
    }));

    return Response.json({
      app_admin: appAdmin,
      user: { id: user.id, email: user.email, full_name: user.full_name || '', role: user.role || 'user' },
      memberships,
      claimed: claim.linked,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('getMyAccess', handler);
