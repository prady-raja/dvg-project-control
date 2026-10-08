/**
 * The exact shape of a migration export: which entities are exported, the order
 * of their columns, how they relate, and what cannot travel in a CSV.
 *
 * Every row keeps its internal id, its created/updated timestamps and the ids of
 * everything it relates to, so the data can be loaded into another database
 * without remapping names.
 */

export const EXPORT_ENTITIES = [
  {
    name: 'Project',
    label: 'Projects',
    fields: ['id', 'name', 'code', 'location', 'status', 'enabled_disciplines', 'planned_villa_count', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
  },
  {
    name: 'Phase',
    label: 'Phases',
    fields: ['id', 'project_id', 'name', 'code', 'planned_villa_count', 'status', 'sort_order', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
  },
  {
    name: 'Location',
    label: 'Villas & locations',
    fields: ['id', 'project_id', 'phase_id', 'villa_code', 'location_type', 'plot_numbers', 'possession_status', 'possession_date', 'works_stage', 'active_status', 'planned_completion_date', 'assigned_engineer', 'sort_order', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'villa_code is the permanent physical villa id; plot_numbers carries the original plot reference, including combined plots (e.g. B-05-06) and split villas (e.g. B-14A / B-14B), so the pre-merger reference is never lost.',
  },
  {
    name: 'Contractor',
    label: 'Contractors',
    fields: ['id', 'name', 'classification', 'trade', 'contact_person', 'phone', 'email', 'active', 'notes', 'created_date', 'updated_date', 'created_by_id'],
  },
  {
    name: 'ContractorDefault',
    label: 'Contractor defaults',
    fields: ['id', 'project_id', 'phase_id', 'discipline', 'contractor_id', 'active', 'notes', 'created_date', 'updated_date', 'created_by_id'],
  },
  {
    name: 'WorkPackage',
    label: 'Work packages',
    fields: ['id', 'project_id', 'discipline', 'package_name', 'sort_order', 'active', 'notes', 'created_date', 'updated_date', 'created_by_id'],
  },
  {
    name: 'Discipline',
    label: 'Disciplines',
    fields: ['id', 'name', 'code', 'sort_order', 'active', 'notes', 'created_date', 'updated_date', 'created_by_id'],
  },
  {
    name: 'ProjectMembership',
    label: 'Project memberships',
    fields: ['id', 'user_id', 'user_email', 'user_name', 'project_id', 'role', 'active', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'user_id is empty until that person has signed in once; user_email is how a pre-recorded membership is matched. This is the table that becomes project_memberships with row level security.',
  },
  {
    name: 'Task',
    label: 'Tasks',
    fields: [
      'id', 'task_ref', 'project_id', 'phase_id', 'location_id', 'discipline', 'work_package',
      'parent_task_id', 'is_villa_work_parent', 'villa_work_key', 'child_villa_count',
      'name', 'description', 'priority', 'status', 'contractor_id', 'responsible_engineer',
      'progress_percent', 'planned_quantity', 'completed_quantity', 'measurement_unit',
      'baseline_start', 'baseline_finish', 'baseline_approval_status', 'baseline_version_id', 'baseline_locked',
      'current_forecast_finish', 'actual_start', 'actual_finish', 'date_revision_reason',
      'planned_manpower', 'actual_manpower', 'estimated_manhours', 'actual_manhours',
      'supplied_by', 'selection_status', 'procurement_status', 'expected_delivery_date',
      'owner_access_required', 'access_status', 'blocker_category', 'blocker_description',
      'blocker_responsible_party', 'blocked_since', 'remarks', 'latest_update', 'attachment_ref',
      'execution_completed_by_id', 'execution_completed_by_name', 'approved_by_id', 'approved_by_name', 'approved_at',
      'created_by_name', 'updated_by_name', 'archived', 'is_demo', 'member_ids',
      'created_date', 'updated_date', 'created_by_id',
    ],
    note: 'task_ref is permanent and unique, issued from the RefAllocation ledger and never derived from the tasks that currently exist. parent_task_id links a villa task to its Villa Work container (is_villa_work_parent true), which holds no work of its own so parent and children are never double counted.',
  },
  {
    name: 'DailyUpdate',
    label: 'Daily site updates',
    fields: [
      'id', 'project_id', 'phase_id', 'location_id', 'work_scope', 'site_area',
      'task_id', 'task_ref', 'task_name', 'villa_code', 'discipline',
      'update_date', 'reported_at', 'reported_by_id', 'reported_by_name',
      'status', 'progress_percent', 'work_done', 'plan_tomorrow',
      'manpower_total', 'manpower_items',
      'blocker_reported', 'blocker_category', 'blocker_description', 'blocker_responsible_party',
      'expected_resolution_date', 'blocker_cleared',
      'forecast_previous', 'forecast_new', 'date_revision_reason',
      'photo_uris', 'member_ids', 'is_demo', 'created_date', 'updated_date', 'created_by_id',
    ],
    note: 'One row per report; many per task per day, none ever overwritten. task_ref, task_name, villa_code and discipline are snapshots taken when the report was filed, so the day still reads correctly after a task is renamed or a villa reassigned. location_id is empty for site-wide work (work_scope = Site-wide). photo_uris holds private storage paths, not the image files.',
  },
  {
    name: 'TaskDependency',
    label: 'Task dependencies',
    fields: ['id', 'project_id', 'predecessor_task_id', 'successor_task_id', 'dependency_type', 'lag_days', 'active', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'Structure only — dependency logic is scheduled for a later step.',
  },
  {
    name: 'RefAllocation',
    label: 'Task reference ledger',
    fields: ['id', 'external_id', 'prefix', 'sequence', 'task_ref', 'project_id', 'phase_id', 'location_id', 'task_id', 'claim_id', 'allocated_at', 'allocated_by_id', 'allocated_by_name', 'source', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'Append-only: one row per reference ever issued, never deleted, so a number stays consumed after its task is deleted. Import it after tasks and set each prefix counter from max(sequence). A row with an empty task_id is a claim that was not used — a simultaneous writer won that number.',
  },
  {
    name: 'TaskHistory',
    label: 'Task change history',
    fields: ['id', 'task_id', 'project_id', 'change_type', 'field_changed', 'old_value', 'new_value', 'changed_by_id', 'changed_by_name', 'changed_at', 'note', 'member_ids', 'created_date'],
    note: 'Append-only audit trail written by the server. Keep it read-only after migration.',
  },
  {
    name: 'BaselineVersion',
    label: 'Baseline versions',
    fields: ['id', 'project_id', 'phase_id', 'version_number', 'name', 'status', 'approved_by_id', 'approved_by_name', 'approved_date', 'approved_at', 'created_by_id', 'created_by_name', 'reason', 'previous_baseline_version_id', 'task_count', 'notes', 'member_ids', 'created_date', 'updated_date'],
    note: 'snapshot and changes are nested lists carried in full by the JSON bundle; a CSV holds them as JSON text.',
  },
  {
    name: 'User',
    label: 'User profiles (no credentials)',
    fields: ['id', 'email', 'full_name', 'role', 'created_date'],
    note: 'Profile only — passwords, tokens and sessions are never exported because they are not stored in app data.',
  },
];

export const NOT_EXPORTED_YET = [
  'Inspections are not built yet (a later step). The Task fields planned_manpower, actual_manpower, estimated_manhours and actual_manhours carry the current figures; daily manpower is in DailyUpdate.manpower_total / .manpower_items.',
  'Site photos — DailyUpdate.photo_uris holds the private storage references, which export as text. The image files themselves stay in platform storage and must be copied across separately (see G7).',
];

export const RELATIONSHIPS = [
  'Project 1—* Phase (Phase.project_id)',
  'Project 1—* Location (Location.project_id); Phase 1—* Location (Location.phase_id)',
  'Project 1—* ProjectMembership (ProjectMembership.project_id) — User *—* Project',
  'Project 1—* WorkPackage (WorkPackage.project_id); Discipline.code is referenced by WorkPackage.discipline and Task.discipline',
  'Project 1—* ContractorDefault (ContractorDefault.project_id); ContractorDefault.contractor_id → Contractor.id',
  'Task.location_id → Location.id; Task.phase_id → Phase.id; Task.project_id → Project.id',
  'Task.parent_task_id → Task.id (Villa Work container → one child task per villa)',
  'Task.contractor_id → Contractor.id; Task.baseline_version_id → BaselineVersion.id',
  'TaskHistory.task_id → Task.id; BaselineVersion.phase_id → Phase.id',
  'RefAllocation.task_id → Task.id (empty while a claim is unused, or after its task is deleted); RefAllocation.task_ref matches Task.task_ref — one ledger row per reference, including references whose task no longer exists',
  'DailyUpdate.task_id → Task.id, .project_id → Project.id, .location_id → Location.id (empty for site-wide work); DailyUpdate.reported_by_id → User.id',
  'TaskDependency.predecessor_task_id / successor_task_id → Task.id',
];