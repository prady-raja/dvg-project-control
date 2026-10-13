import { BLOCKER_CATEGORIES, MEMBERSHIP_ROLES, OPEN_TASK_STATUSES, TASK_STATUSES } from '@/lib/shared/enums.ts';

export { BLOCKER_CATEGORIES, MEMBERSHIP_ROLES, OPEN_TASK_STATUSES, TASK_STATUSES };

/** A report holds at most this many photos; the server refuses more (dailyReportRules MAX_REPORT_PHOTOS). */
export const MAX_PHOTOS = 10;

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const BASELINE_APPROVAL_STATUSES = ['Not Submitted', 'Submitted', 'Approved', 'Rejected'];
export const SELECTION_STATUSES = ['Not Required', 'Pending Selection', 'Selected'];
export const PROCUREMENT_STATUSES = ['Not Required', 'To Order', 'Ordered', 'Delivered', 'Installed'];
export const ACCESS_STATUSES = ['Not Required', 'Pending', 'Confirmed', 'Denied'];
export const OWNER_ACCESS_OPTIONS = ['No', 'Yes'];
export const SUPPLIED_BY_OPTIONS = ['DVG', 'Contractor', 'Client'];

export const MEASUREMENT_UNITS = ['Nos', 'Sqm', 'Sqft', 'Rmt', 'Cum', 'Kg', 'LS', 'Set', 'Litre'];

export const PROJECT_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Archived'];
export const PHASE_STATUSES = ['Not Started', 'Active', 'On Hold', 'Completed'];
export const LOCATION_TYPES = ['Villa', 'Common Area', 'Infrastructure', 'Project-wide'];
export const POSSESSION_STATUSES = ['Handed Over', 'Not Handed Over'];
export const WORKS_STAGES = ['Not Started', 'Under Construction', 'Works Pending', 'Completed'];
export const ACTIVE_STATUSES = ['Active', 'On Hold'];
export const CONTRACTOR_CLASSIFICATIONS = ['Internal Execution Team', 'External Contractor'];

export const WORK_PACKAGE_REQUIRED_DISCIPLINES = ['Finishes'];

/* ---------------------------------------------------------------- seed data */

export const SEED_DISCIPLINES = [
  { name: 'Civil', code: 'CIVIL' },
  { name: 'Electrical', code: 'ELEC' },
  { name: 'Plumbing', code: 'PLUMB' },
  { name: 'HVAC', code: 'HVAC' },
  { name: 'Automation', code: 'AUTO' },
  { name: 'Finishes', code: 'FIN' },
  { name: 'Swimming Pool', code: 'POOL' },
  { name: 'Irrigation', code: 'IRR' },
  { name: 'External Works', code: 'EXT' },
  { name: 'Testing & Snagging', code: 'SNAG' },
  { name: 'Infrastructure', code: 'INFRA' },
  { name: 'Approvals & Liaison', code: 'APPR' },
].map((d, i) => ({ ...d, sort_order: i + 1, active: true }));
