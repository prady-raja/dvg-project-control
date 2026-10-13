import { allowedNextStatuses } from '@/lib/shared/enums.ts';

/**
 * The pure parts of the Log update drawer: which statuses to offer, what the
 * progress chips mean, who comes first in the task list, and the unsent draft.
 */

/** Work that has reached inspection or beyond takes no further site reports. */
export const REPORT_BLOCKED_STATUSES = ['Under Inspection', 'Approved', 'Closed'];

/** Status chips: the current status, the legal steps, and Blocked (which opens the Block sheet). */
export function statusChips(task) {
  const current = task?.status || 'Not Started';
  const next = allowedNextStatuses(current).filter((s) => !REPORT_BLOCKED_STATUSES.includes(s));
  const order = ['Not Started', 'In Progress', 'Blocked', 'Execution Complete'];
  const chips = [...new Set([current, ...next, 'Execution Complete'])]
    .filter((s) => !REPORT_BLOCKED_STATUSES.includes(s))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return chips.map((status) => ({ status, current: status === current, opensBlockSheet: status === 'Blocked' && current !== 'Blocked' }));
}

export const PROGRESS_CHIPS = [25, 50, 75, 100];

/** A chip tap sets progress; "+10" adds ten to what is there, never past 100. */
export function nextProgress(current, chip) {
  if (chip === '+10') return Math.min((Number(current) || 0) + 10, 100);
  return Math.min(Math.max(Number(chip) || 0, 0), 100);
}

/** Open work first, mine before others, then the most urgent first. */
export function orderTasks(tasks, me) {
  const mine = (t) => (t.assignee_user_id ? t.assignee_user_id === me.id : false);
  const rank = (t) => ({ Blocked: 0, 'In Progress': 1, 'Not Started': 2, 'Execution Complete': 3 }[t.status] ?? 4);
  return [...tasks].sort((a, b) =>
    Number(mine(b)) - Number(mine(a)) || rank(a) - rank(b) || String(a.current_forecast_finish || a.baseline_finish || '9')
      .localeCompare(String(b.current_forecast_finish || b.baseline_finish || '9')) || String(a.task_ref).localeCompare(String(b.task_ref)));
}

/* ------------------------------------------------------------ recent villas */

const RECENT_KEY = 'dvg.recentVillas';
export const RECENT_VILLAS = 5;

/** Most recent first, no repeats, at most five. */
export const withRecentVilla = (list, id) => [id, ...list.filter((x) => x !== id)].filter(Boolean).slice(0, RECENT_VILLAS);

export const loadRecentVillas = () => {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
};
export const rememberVilla = (id) => {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(withRecentVilla(loadRecentVillas(), id)));
  } catch {
    // Not remembering a villa is harmless.
  }
};

/* ------------------------------------------------------------------- draft */

const DRAFT_KEY = 'dvg.logUpdate.draft';
export const DRAFT_HOURS = 24;

export const draftFrom = (form, now = Date.now()) => ({
  at: now,
  locationId: form.locationId || '',
  taskId: form.taskId || '',
  status: form.status || '',
  progress: form.progress ?? '',
  note: form.note || '',
  siteArea: form.siteArea || '',
  floor_id: form.floor_id || '',
  area_ids: form.area_ids || [],
  photos: (form.photos || []).map((p) => ({ file_uri: p.file_uri, caption: p.caption || '', original_uri: p.original_uri || '' })),
});

/** A draft is worth restoring only when it has a task or something typed, and is recent. */
export const isRestorable = (draft, now = Date.now()) =>
  !!draft && typeof draft.at === 'number' && now - draft.at < DRAFT_HOURS * 3600000
  && !!(draft.taskId || draft.note || (draft.photos || []).length);

export const loadDraft = () => {
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
};
export const saveDraft = (form) => {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draftFrom(form)));
  } catch {
    // The draft is a convenience; losing it must not stop a report.
  }
};
export const clearDraft = () => {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
};
/* --------------------------------------------------------------- day sheet */

/** What the Villa Day Sheet sends: only the rows a person changed, in the shape the batch action takes. */
export function daySheetRows(edits, tasks) {
  return tasks
    .map((task) => ({ task, edit: edits[task.id] }))
    .filter(({ task, edit }) => edit && (
      (edit.status && edit.status !== task.status)
      || (edit.progress !== undefined && edit.progress !== '' && String(edit.progress) !== String(task.progress_percent ?? ''))
      || String(edit.note || '').trim()))
    .map(({ task, edit }) => ({
      client_ref: task.id,
      task_id: task.id,
      status: edit.status || task.status,
      ...(edit.progress === undefined || edit.progress === '' ? {} : { progress_percent: Number(edit.progress) }),
      work_done: String(edit.note || '').trim(),
    }));
}

/** The two maps a report or snag stores beside its photo list: captions, and the original of each marked-up photo. */
export function photoMetaOf(photos = []) {
  const photo_captions = {};
  const photo_originals = {};
  photos.forEach((p) => {
    if (p.caption && p.caption.trim()) photo_captions[p.file_uri] = p.caption.trim();
    if (p.original_uri && p.original_uri !== p.file_uri) photo_originals[p.file_uri] = p.original_uri;
  });
  return { photo_captions, photo_originals };
}
