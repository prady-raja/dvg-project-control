export const TASK_FORM_FIELDS = [
  'project_id', 'phase_id', 'location_id', 'discipline', 'work_package', 'parent_task_id',
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

export const emptyTaskForm = () => ({
  project_id: '', phase_id: '', location_id: '', discipline: '', work_package: '', parent_task_id: '',
  name: '', description: '', priority: 'Medium', status: 'Not Started',
  contractor_id: '', responsible_engineer: '',
  progress_percent: '', planned_quantity: '', completed_quantity: '', measurement_unit: '',
  baseline_start: '', baseline_finish: '', baseline_approval_status: 'Not Submitted',
  current_forecast_finish: '', actual_start: '', actual_finish: '', date_revision_reason: '',
  planned_manpower: '', actual_manpower: '', estimated_manhours: '', actual_manhours: '',
  supplied_by: '', selection_status: 'Not Required', procurement_status: 'Not Required',
  expected_delivery_date: '',
  owner_access_required: 'No', access_status: 'Not Required',
  blocker_category: '', blocker_description: '', blocker_responsible_party: '', blocked_since: '',
  remarks: '', latest_update: '', attachment_ref: '', archived: false,
});

/** Existing task -> editable form values (null stays blank, never 0). */
export const taskToForm = (task) => {
  if (!task) return emptyTaskForm();
  const form = emptyTaskForm();
  TASK_FORM_FIELDS.forEach((key) => {
    if (task[key] !== undefined && task[key] !== null) form[key] = task[key];
  });
  if (task.archived) form.archived = true;
  return form;
};

/** Form values -> the record payload. */
export const formToPayload = (form) => {
  const payload = {};
  TASK_FORM_FIELDS.forEach((key) => {
    payload[key] = form[key];
  });
  return payload;
};