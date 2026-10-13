import { invokeFn } from '@/lib/invokeFn';

/**
 * A daily report is written by the server, which decides permission from the
 * signed-in session, moves the task from the same validated report and records
 * both in the change history. The interface never writes a report record itself.
 */
export const submitDailyUpdate = (payload) => invokeFn('dailyUpdate', payload, 'The update was refused.');

/** Take back your own report of today. The server puts the task back as it was, if nothing else has changed it since. */
export async function voidDailyUpdate(reportId) {
  return submitDailyUpdate({ action: 'void', report_id: reportId });
}

/** Up to 25 tasks of one villa and day in one call. A result comes back for each row, so one refusal never blocks the rest. */
export async function submitDailyBatch({ updateDate, siteArea, rows }) {
  return submitDailyUpdate({ action: 'batch', update_date: updateDate, site_area: siteArea, rows });
}
