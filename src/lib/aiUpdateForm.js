/**
 * The review form for a site update read from words. The task the server
 * matched is pre-selected and the status starts from that task's own status,
 * so confirming without edits never moves the task backwards.
 */
export function aiUpdateForm(payload, text) {
  const proposed = payload?.proposed || {};
  const candidates = payload?.candidates || [];
  const match = candidates.find((c) => proposed.task_ref && c.ref === proposed.task_ref)
    || (!payload?.ambiguous ? candidates[0] : null)
    || null;
  return {
    task_ref: match?.ref || proposed.task_ref || '',
    task_id: match?.task_id || '',
    status: proposed.status || match?.status || '',
    progress_percent: proposed.progress_percent ?? '',
    manpower_total: proposed.manpower_total ?? '',
    manpower_discipline: match?.discipline_code || '',
    work_done: proposed.work_done || text || '',
    blocker_category: proposed.blocker_category || '',
    blocker_description: proposed.blocker_description || '',
    forecast: '',
    date_revision_reason: '',
  };
}

/** The daily-update payload; blanks mean "not reported", never "clear". */
export function aiUpdatePayload(form, date) {
  const payload = { task_id: form.task_id, update_date: date };
  if (form.status) payload.status = form.status;
  if (form.progress_percent !== '' && form.progress_percent !== null) payload.progress_percent = Number(form.progress_percent);
  if (String(form.work_done || '').trim()) payload.work_done = form.work_done.trim();
  const count = Number(form.manpower_total);
  if (count > 0) payload.manpower_items = [{ discipline: String(form.manpower_discipline || '').trim(), count }];
  if (form.blocker_category) {
    payload.blocker_reported = true;
    payload.blocker_category = form.blocker_category;
    payload.blocker_description = String(form.blocker_description || '').trim();
  }
  if (form.forecast) {
    payload.current_forecast_finish = form.forecast;
    payload.date_revision_reason = String(form.date_revision_reason || '').trim();
    payload.source = 'ai';
  }
  return payload;
}
