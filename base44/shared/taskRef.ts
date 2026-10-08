/**
 * Permanent task references, e.g. IMG-A-0001. A project-wide common-work task
 * uses the GEN phase code.
 */

const nextFrom = (refs, prefix) => {
  let next = 1;
  const latest = refs && refs[0] && refs[0].task_ref;
  if (latest) {
    const match = String(latest).match(/(\d+)$/);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return next;
};

/** Allocates `count` consecutive references for a project + phase. */
export async function allocateTaskRefs(client, projectId, phaseId, count = 1) {
  const projectRes = await client.entities.Project.filter({ id: projectId }, { limit: 1 });
  const project = (projectRes?.items || projectRes || [])[0];
  if (!project) throw new Error('Project not found');
  const projectCode = String(project.code || 'PRJ').toUpperCase().trim();

  let phaseCode = 'GEN';
  if (phaseId) {
    const phaseRes = await client.entities.Phase.filter({ id: phaseId }, { limit: 1 });
    const phase = (phaseRes?.items || phaseRes || [])[0];
    if (phase && phase.code) phaseCode = String(phase.code).toUpperCase().trim();
  }

  const prefix = `${projectCode}-${phaseCode}-`;
  const existingRes = await client.entities.Task.filter(
    { task_ref: { $regex: `^${prefix}` } },
    { sort: '-task_ref', limit: 1 },
  );
  const start = nextFrom(existingRes?.items || existingRes || [], prefix);

  return Array.from({ length: count }, (_, i) => `${prefix}${String(start + i).padStart(4, '0')}`);
}

export const allocateTaskRef = async (client, projectId, phaseId) =>
  (await allocateTaskRefs(client, projectId, phaseId, 1))[0];