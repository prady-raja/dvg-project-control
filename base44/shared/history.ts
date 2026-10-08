/**
 * Task change history. Rows are produced only from trusted server-side
 * operations: the actor is read from the authenticated session, the previous
 * value from the stored record, and the new value from the validated change
 * set — never from browser-supplied identity or audit data.
 */

export const TASK_FIELDS = [
  'project_id', 'phase_id', 'location_id', 'discipline', 'work_package', 'parent_task_id',
  // Where inside the villa the work is, and what "acceptable" means for it.
  'floor_id', 'area_ids', 'area_label', 'scope_type', 'acceptance_criterion',
  'name', 'description', 'priority', 'status',
  'contractor_id', 'responsible_engineer',
  'progress_percent', 'planned_quantity', 'completed_quantity', 'measurement_unit',
  'baseline_start', 'baseline_finish', 'baseline_approval_status',
  'current_forecast_finish', 'actual_start', 'actual_finish', 'date_revision_reason',
  'planned_manpower', 'actual_manpower', 'estimated_manhours', 'actual_manhours',
  'supplied_by', 'selection_status', 'procurement_status', 'expected_delivery_date',
  'owner_access_required', 'access_status',
  'blocker_category', 'blocker_description', 'blocker_responsible_party', 'blocked_since',
  'remarks', 'latest_update', 'attachment_ref', 'archived',
];

/** Fields a client may never set directly. */
export const SERVER_OWNED_FIELDS = [
  'task_ref', 'member_ids', 'is_villa_work_parent', 'villa_work_key', 'child_villa_count',
  'baseline_locked', 'baseline_version_id', 'execution_completed_by_id', 'execution_completed_by_name',
  'approved_by_id', 'approved_by_name', 'approved_at', 'created_by_name', 'updated_by_name', 'is_demo',
  // Import provenance: written once by the import operation, never by a screen.
  'import_batch_id', 'import_source_file', 'import_row_number',
];

export const BASELINE_FIELDS = ['baseline_start', 'baseline_finish'];

const NUMBER_FIELDS = [
  'progress_percent', 'planned_quantity', 'completed_quantity',
  'planned_manpower', 'actual_manpower', 'estimated_manhours', 'actual_manhours',
];

const BOOLEAN_FIELDS = ['archived'];

const MAX_LEN = 400;

export const trimValue = (value) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN)}…` : text;
};

/** Blank stays blank, numbers stay numbers. */
export function normalizeValue(field, value) {
  if (value === '' || value === undefined) return null;
  if (value === null) return null;
  if (NUMBER_FIELDS.includes(field)) {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  if (BOOLEAN_FIELDS.includes(field)) return value === true || value === 'true';
  return value;
}

const same = (a, b) => {
  if (a === null || a === '') return b === null || b === '';
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
};

/** Only fields that genuinely differ become history rows. */
export function diffFields(before, changes, fields = TASK_FIELDS) {
  const entries = [];
  fields.forEach((field) => {
    if (!changes || !Object.prototype.hasOwnProperty.call(changes, field)) return;
    const next = normalizeValue(field, changes[field]);
    const previous = before ? normalizeValue(field, before[field]) : null;
    if (!same(previous, next)) entries.push({ field_changed: field, old_value: previous, new_value: next });
  });
  return entries;
}

const changeTypeFor = (field) => {
  if (field === 'status') return 'Status Change';
  if (field === 'progress_percent') return 'Progress Update';
  if (field === 'current_forecast_finish') return 'Forecast Revision';
  if (BASELINE_FIELDS.includes(field)) return 'Baseline Change';
  if (field === 'archived') return 'Record Lifecycle';
  return 'Field Change';
};

/**
 * Writes history rows. `entries` come from diffFields; `extra` covers rows the
 * caller needs to state explicitly (creation, approval, baseline freeze).
 */
export async function writeTaskHistory(base44, { task, projectId, memberIds, user, entries, extra, note }) {
  const rows = [];
  const base = {
    task_id: task.id,
    project_id: projectId || task.project_id,
    member_ids: memberIds || task.member_ids || [],
    changed_by_id: user?.id || '',
    changed_by_name: (user?.full_name || user?.email || 'Unknown user'),
    changed_at: new Date().toISOString(),
  };

  (entries || []).forEach((entry) => {
    rows.push({
      ...base,
      change_type: changeTypeFor(entry.field_changed),
      field_changed: entry.field_changed,
      old_value: trimValue(entry.old_value),
      new_value: trimValue(entry.new_value),
      note: entry.note || note || '',
    });
  });

  (extra || []).forEach((row) => rows.push({ ...base, ...row }));

  if (!rows.length) return 0;
  await base44.asServiceRole.entities.TaskHistory.bulkCreate(rows);
  return rows.length;
}

/**
 * The "Task Created" trail rows for one or many tasks, in the same shape
 * `writeTaskHistory` produces. The CSV import creates tasks in blocks, so it
 * needs the rows without a per-task round trip.
 */
export function createdHistoryRows({ tasks, projectId, memberIds, user, note }) {
  const stamp = new Date().toISOString();
  return (tasks || [])
    .filter((task) => task?.id)
    .map((task) => ({
      task_id: task.id,
      project_id: projectId || task.project_id,
      member_ids: memberIds || task.member_ids || [],
      change_type: 'Task Created',
      field_changed: 'task_ref',
      old_value: '',
      new_value: task.task_ref || '',
      changed_by_id: user?.id || '',
      changed_by_name: user?.full_name || user?.email || 'Unknown user',
      changed_at: stamp,
      note: note || 'Task created',
    }));
}