import React from 'react';
import { base44 } from '@/api/base44Client';
import { nullify } from '@/lib/dataHelpers';

export async function allocateTaskRef(projectId, phaseId) {
  const res = await base44.functions.invoke('nextTaskRef', {
    project_id: projectId,
    phase_id: phaseId || '',
  });
  const ref = res?.data?.task_ref;
  if (!ref) throw new Error('Could not allocate a task reference.');
  return ref;
}

const actorName = (user) => user?.full_name || user?.email || '';

export async function createTask(payload, user) {
  const task_ref = await allocateTaskRef(payload.project_id, payload.phase_id);
  return base44.entities.Task.create(
    nullify({
      ...payload,
      task_ref,
      created_by_name: actorName(user),
      is_demo: false,
      archived: false,
    }),
  );
}

export async function updateTask(id, payload, user) {
  return base44.entities.Task.update(
    id,
    nullify({
      ...payload,
      updated_by_name: actorName(user),
    }),
  );
}

/** Quick on-site update used from the register and the task view. */
export async function quickUpdateTask(id, changes, user) {
  return updateTask(id, changes, user);
}

export const archiveTask = (id) => base44.entities.Task.update(id, { archived: true });
export const restoreTask = (id) => base44.entities.Task.update(id, { archived: false });