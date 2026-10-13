import { invokeFn } from '@/lib/invokeFn';
import { toast } from '@/components/ui/use-toast';

/**
 * Guarded writes for projects, phases, villas, work packages, contractor
 * defaults, company lists and project membership. The server decides the role
 * needed; the page only decides which button to show.
 */
export async function saveRecord(entity, action, data = {}, id = '') {
  const res = await invokeFn('saveRecord', { entity, action, data, id }, 'The change was refused.');
  toast({ description: action === 'delete' ? 'Removed.' : action === 'create' ? 'Created.' : 'Saved.' });
  return res;
}

export const createRecord = (entity, data) => saveRecord(entity, 'create', data);

export const updateRecord = (entity, id, data) => saveRecord(entity, 'update', data, id);

export const deleteRecord = (entity, id) => saveRecord(entity, 'delete', {}, id);