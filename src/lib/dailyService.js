import { base44 } from '@/api/base44Client';

/**
 * A daily report is written by the server, which decides permission from the
 * signed-in session, moves the task from the same validated report and records
 * both in the change history. The interface never writes a report record itself.
 */
export async function submitDailyUpdate(payload) {
  try {
    const res = await base44.functions.invoke('dailyUpdate', payload);
    return res?.data || {};
  } catch (error) {
    const message =
      error?.response?.data?.error ||
      error?.data?.error ||
      (typeof error?.message === 'string' && !error.message.includes('SDK Error') ? error.message : '') ||
      'The update was refused.';
    throw new Error(message);
  }
}

/** Take back your own report of today. The server puts the task back as it was, if nothing else has changed it since. */
export async function voidDailyUpdate(reportId) {
  return submitDailyUpdate({ action: 'void', report_id: reportId });
}

/** Up to 25 tasks of one villa and day in one call. A result comes back for each row, so one refusal never blocks the rest. */
export async function submitDailyBatch({ updateDate, siteArea, rows }) {
  return submitDailyUpdate({ action: 'batch', update_date: updateDate, site_area: siteArea, rows });
}
