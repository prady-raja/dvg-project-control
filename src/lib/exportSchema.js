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
    note: 'user_id is empty until that person has signed in once; user_email is how a pre-recorded membership is matched. Project Editor is the single operational level used by the staff users; Project Admin / Project Manager / Site Engineer / Supervisor are legacy levels kept so older rows still resolve. This is the table that becomes project_memberships with row level security.',
  },
  {
    name: 'Task',
    label: 'Tasks',
    fields: [
      'id', 'task_ref', 'project_id', 'phase_id', 'location_id', 'floor_id', 'area_ids', 'area_label',
      'scope_type', 'acceptance_criterion', 'source_location_text', 'scope_unresolved',
      'discipline', 'work_package',
      'parent_task_id', 'is_villa_work_parent', 'villa_work_key', 'child_villa_count',
      'name', 'description', 'priority', 'status', 'contractor_id', 'responsible_engineer',
      'progress_percent', 'planned_quantity', 'completed_quantity', 'measurement_unit',
      'baseline_start', 'baseline_finish', 'baseline_approval_status', 'baseline_version_id', 'baseline_locked',
      'current_forecast_finish', 'actual_start', 'actual_finish', 'date_revision_reason',
      'planned_manpower', 'actual_manpower', 'estimated_manhours', 'actual_manhours',
      'supplied_by', 'selection_status', 'procurement_status', 'expected_delivery_date',
      'owner_access_required', 'access_status', 'blocker_category', 'blocker_description',
      'blocker_responsible_party', 'blocked_since', 'remarks', 'latest_update', 'attachment_ref',
      'source_reference', 'import_batch_id', 'import_source_file', 'import_source_sheet', 'import_row_number',
      'execution_completed_by_id', 'execution_completed_by_name', 'approved_by_id', 'approved_by_name', 'approved_at',
      'created_by_name', 'updated_by_name', 'archived', 'is_demo', 'member_ids',
      'created_date', 'updated_date', 'created_by_id',
    ],
    note: 'task_ref is permanent and unique, issued from the RefAllocation ledger and never derived from the tasks that currently exist. floor_id → VillaFloor.id and area_ids → VillaArea.id[] carry the room-level scope; scope_type states which of Specific Room/Area, Multiple Rooms/Areas, Entire Floor, Entire Villa or Site-wide it is, and area_label is the readable form (e.g. "First Floor · Master Bedroom"). source_location_text keeps the floor and room words exactly as the source list wrote them, and scope_unresolved is true when such words were named but never registered — those rows are flagged in Needs Attention and are never read as confirmed whole-villa work. parent_task_id links a villa task to its Villa Work container (is_villa_work_parent true), which holds no work of its own so parent and children are never double counted. import_batch_id / import_source_file / import_source_sheet / import_row_number / source_reference record the workbook or CSV row a task came from — for an Excel import the worksheet and the worksheet row — and are written only by the import operation.',
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
    name: 'ImportBatch',
    label: 'Excel and CSV import batches',
    fields: ['id', 'batch_ref', 'project_id', 'phase_id', 'source_file', 'source_sheet', 'source_checksum', 'row_count', 'created_count', 'skipped_count', 'linked_count', 'failed_count', 'attention_count', 'status', 'imported_by_id', 'imported_by_name', 'imported_at', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'report is a nested list carried in full by the JSON bundle; a CSV holds it as JSON text. source_sheet names the worksheet an Excel import was read from and is empty for a CSV. source_checksum is the fingerprint that recognises a repeated file. Tasks point back through import_batch_id, so import_batches must be loaded before tasks.',
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
    fields: ['id', 'email', 'full_name', 'role', 'designation', 'created_date'],
    note: 'Profile only — passwords, tokens and sessions are never exported because they are not stored in app data. designation is a descriptive job label (Site Engineer, MEP Engineer, Procurement, Planning, Management) and never grants any capability; access comes from the project membership role.',
  },
  {
    name: 'Snag',
    label: 'Snags',
    fields: ['id', 'snag_ref', 'project_id', 'phase_id', 'location_id', 'floor_id', 'area_ids', 'area_label', 'task_id', 'title', 'description', 'discipline', 'work_package', 'contractor_id', 'status', 'severity', 'raised_date', 'raised_by_id', 'raised_by_name', 'target_date', 'reinspection_date', 'closed_date', 'closed_by_name', 'handover_blocker', 'photo_uris', 'notes', 'is_demo', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'Snag references (SN-…) come from the same append-only ledger as task references, so a snag number is never reused either.',
  },
  {
    name: 'MeetingCommitment',
    label: 'Meeting commitments',
    fields: ['id', 'project_id', 'phase_id', 'contractor_id', 'task_id', 'task_ref', 'meeting_date', 'commitment', 'responsible_person', 'promised_date', 'status', 'fulfilled_date', 'remarks', 'recorded_by_id', 'recorded_by_name', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'One row per promise. A later meeting adds rows; the earlier commitment is preserved and only its status changes.',
  },
  {
    name: 'AiSettings',
    label: 'AI settings',
    fields: ['id', 'enabled', 'allowed_roles', 'model', 'daily_request_limit', 'context_item_limit', 'instructions', 'notes', 'updated_by_name', 'created_date', 'updated_date', 'created_by_id'],
    note: 'Configuration only. The provider key is a server-side secret and is never stored in app data.',
  },
  {
    name: 'AiUsage',
    label: 'AI usage log',
    fields: ['id', 'user_id', 'user_name', 'day', 'action', 'project_id', 'model', 'question', 'ok', 'error', 'prompt_tokens', 'completion_tokens', 'asked_at'],
    note: 'Audit of AI requests: who asked, when, which action and model, tokens used, and the outcome. Questions are truncated.',
  },
  {
    name: 'VillaFloor',
    label: 'Villa floors',
    fields: ['id', 'project_id', 'phase_id', 'location_id', 'floor_code', 'floor_name', 'level_order', 'active', 'notes', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'One row per floor of one villa. location_id → Location.id ties the floor to its physical villa, floor_code is what references use, level_order is blank when unknown rather than guessed.',
  },
  {
    name: 'VillaArea',
    label: 'Rooms & areas',
    fields: ['id', 'project_id', 'phase_id', 'location_id', 'floor_id', 'area_code', 'area_name', 'normalized_name', 'aliases', 'source_name', 'area_type', 'sort_order', 'active', 'source', 'notes', 'is_demo', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'The room register: floor_id → VillaFloor.id and location_id → Location.id fix each room to its villa. normalized_name is the matching key used by the importer and the assistant, aliases lists only what has been approved, and source_name preserves the wording used in the uploaded document. Tasks point here through area_ids.',
  },
  {
    name: 'Drawing',
    label: 'Drawing register',
    fields: ['id', 'project_id', 'phase_id', 'location_id', 'floor_id', 'title', 'drawing_type', 'revision', 'revision_date', 'uploaded_date', 'file_uri', 'file_name', 'status', 'superseded_by_id', 'supersedes_id', 'uploaded_by_id', 'uploaded_by_name', 'notes', 'is_demo', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'file_uri is a private storage reference, not a public URL: the drawing files themselves must be copied across separately and their access follows project membership. Each revision is its own row; superseded_by_id / supersedes_id link the chain so a task can always be traced to the revision it was read from.',
  },
  {
    name: 'AiProposal',
    label: 'AI assistant proposals',
    fields: ['id', 'external_id', 'project_id', 'phase_id', 'user_id', 'user_name', 'message', 'intent', 'source', 'model', 'actions', 'questions', 'status', 'results', 'proposed_at', 'confirmed_at', 'error', 'member_ids', 'created_date', 'updated_date', 'created_by_id'],
    note: 'external_id is the idempotency key: a repeated confirmation of the same proposal is recognised from this row instead of being applied twice. actions, questions and results are nested lists carried in full by the JSON bundle; a CSV holds them as JSON text.',
  },
];

export const NOT_EXPORTED_YET = [
  'Inspections are not built yet (a later step). The Task fields planned_manpower, actual_manpower, estimated_manhours and actual_manhours carry the current figures; daily manpower is in DailyUpdate.manpower_total / .manpower_items.',
  'Site photos — DailyUpdate.photo_uris holds the private storage references, which export as text. The image files themselves stay in platform storage and must be copied across separately (see G7).',
];

export const RELATIONSHIPS = [
  'Snag.location_id → Location.id; Snag.task_id → Task.id (optional); Snag.contractor_id → Contractor.id; Snag.project_id → Project.id',
  'MeetingCommitment.project_id → Project.id; MeetingCommitment.task_id → Task.id; MeetingCommitment.contractor_id → Contractor.id',
  'AiUsage.user_id → User.id; AiUsage.project_id → Project.id',
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
  'ImportBatch.project_id → Project.id; Task.import_batch_id → ImportBatch.id — the batch, source file and row number behind an imported task',
  'DailyUpdate.task_id → Task.id, .project_id → Project.id, .location_id → Location.id (empty for site-wide work); DailyUpdate.reported_by_id → User.id',
  'TaskDependency.predecessor_task_id / successor_task_id → Task.id',
];