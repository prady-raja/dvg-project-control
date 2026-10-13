import { data } from '@/api/data';

/** Every change to an owner access visit goes through the server, which sets access on the linked tasks. */
export const requestAccess = (payload) => data.invoke('ownerAccess', { action: 'request', ...payload });
export const confirmVisit = (visitId, payload) => data.invoke('ownerAccess', { action: 'confirm', visit_id: visitId, ...payload });
export const finishVisit = (visitId) => data.invoke('ownerAccess', { action: 'done', visit_id: visitId });
export const noShowVisit = (visitId, notes = '') => data.invoke('ownerAccess', { action: 'no_show', visit_id: visitId, notes });
export const cancelVisit = (visitId) => data.invoke('ownerAccess', { action: 'cancel', visit_id: visitId });
