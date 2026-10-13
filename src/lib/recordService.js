import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';

/**
 * Guarded writes for projects, phases, villas, work packages, contractor
 * defaults, company lists and project membership. The server decides the role
 * needed; the page only decides which button to show.
 */
export async function saveRecord(entity, action, data = {}, id = '') {
  try {
    const res = await base44.functions.invoke('saveRecord', { entity, action, data, id });
    toast({ description: action === 'delete' ? 'Removed.' : action === 'create' ? 'Created.' : 'Saved.' });
    return res?.data || {};
  } catch (error) {
    const message =
      error?.response?.data?.error ||
      error?.data?.error ||
      (typeof error?.message === 'string' && !error.message.includes('SDK Error') ? error.message : '') ||
      'The change was refused.';
    throw new Error(message);
  }
}

export const createRecord = (entity, data) => saveRecord(entity, 'create', data);

export const updateRecord = (entity, id, data) => saveRecord(entity, 'update', data, id);

export const deleteRecord = (entity, id) => saveRecord(entity, 'delete', {}, id);