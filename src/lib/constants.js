import { BLOCKER_CATEGORIES, MEMBERSHIP_ROLES, OPEN_TASK_STATUSES, TASK_STATUSES } from '@shared/enums.ts';

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

export const SEED_WORK_PACKAGES = {
  CIVIL: ['Masonry', 'Plastering', 'Waterproofing', 'Concrete Repairs', 'Structural Repairs', 'Compound Walls'],
  ELEC: ['Wiring & DBs', 'Switches & Sockets', 'Light Fixtures', 'Decorative Lighting & Chandeliers', 'External Lighting', 'Testing'],
  PLUMB: ['Water Supply', 'Drainage', 'Sanitary Fittings', 'Sump Works', 'Leak Rectification', 'Testing'],
  HVAC: ['AC Installation', 'Piping & Ducting', 'Indoor/Outdoor Units', 'Testing & Commissioning'],
  AUTO: ['Lighting Control', 'Controllers', 'Integration', 'Programming', 'Testing'],
  FIN: [
    'Flooring & Tiles', 'Stone', 'False Ceiling', 'Painting', 'Doors', 'Windows', 'Railings',
    'Polishing', 'Wardrobes', 'Kitchens', 'Cabinetry', 'Loose Furniture', 'Cushions & Soft Furnishings',
  ],
  POOL: ['Pool Structure', 'Waterproofing', 'Pool Tiling', 'Filtration', 'Equipment', 'Testing'],
  IRR: ['Drip Irrigation', 'Sprinklers', 'Valves', 'Controllers', 'Irrigation Lines', 'Testing'],
  EXT: ['Villa Landscaping', 'Pathways', 'Garden Lighting', 'Rooftop Vegetable Patches'],
  SNAG: ['Inspections', 'Defect Rectification', 'Reinspection', 'Final Acceptance'],
  INFRA: ['Roads', 'Common Drainage', 'Transformers', 'Main Gate', 'Street Lighting', 'Common Landscaping'],
  APPR: ['Power Feeder', 'Water Connections', 'Utility Coordination', 'Statutory Approvals'],
};

export const SEED_CONTRACTORS = [
  { name: 'Hariom', classification: 'External Contractor', trade: 'Finishes' },
  { name: 'AWICON', classification: 'External Contractor', trade: 'Automation' },
  { name: 'Jagdish', classification: 'External Contractor', trade: 'Electrical' },
  { name: 'Sunil', classification: 'External Contractor', trade: 'Plumbing' },
  { name: 'SK', classification: 'External Contractor', trade: 'HVAC' },
  { name: 'Oasis', classification: 'External Contractor', trade: 'Swimming Pool & Irrigation' },
  { name: 'DVG In-house Team', classification: 'Internal Execution Team', trade: 'Civil' },
  { name: 'SLN', classification: 'External Contractor', trade: 'Civil' },
];

/** phaseCode '' means: applies to every phase of the project */
export const SEED_CONTRACTOR_DEFAULTS = [
  { disciplineCode: 'CIVIL', contractorName: 'DVG In-house Team', phaseCode: 'A' },
  { disciplineCode: 'CIVIL', contractorName: 'SLN', phaseCode: 'B' },
  { disciplineCode: 'FIN', contractorName: 'Hariom', phaseCode: '' },
  { disciplineCode: 'AUTO', contractorName: 'AWICON', phaseCode: '' },
  { disciplineCode: 'ELEC', contractorName: 'Jagdish', phaseCode: '' },
  { disciplineCode: 'PLUMB', contractorName: 'Sunil', phaseCode: '' },
  { disciplineCode: 'HVAC', contractorName: 'SK', phaseCode: '' },
  { disciplineCode: 'POOL', contractorName: 'Oasis', phaseCode: '' },
  { disciplineCode: 'IRR', contractorName: 'Oasis', phaseCode: '' },
];

const handedOverA = ['A-01', 'A-02', 'A-03', 'A-05', 'A-06', 'A-08', 'A-09', 'A-11', 'A-14'];
const underConstructionA = ['A-07', 'A-10', 'A-12'];

export const SEED_PHASE_A_VILLAS = [
  ...handedOverA.map((code, i) => ({
    villa_code: code,
    plot_numbers: `Plot ${Number(code.split('-')[1])}`,
    possession_status: 'Handed Over',
    works_stage: 'Works Pending',
    active_status: 'Active',
    sort_order: i + 1,
    notes: 'Handed over — construction and finishing works pending.',
  })),
  ...underConstructionA.map((code, i) => ({
    villa_code: code,
    plot_numbers: `Plot ${Number(code.split('-')[1])}`,
    possession_status: 'Not Handed Over',
    works_stage: 'Under Construction',
    active_status: 'Active',
    sort_order: handedOverA.length + i + 1,
    notes: 'Under construction — not handed over.',
  })),
  {
    villa_code: 'A-04',
    plot_numbers: 'Plot 4',
    possession_status: 'Not Handed Over',
    works_stage: 'Not Started',
    active_status: 'On Hold',
    sort_order: 13,
    notes: 'On hold — construction not started. Retained in total inventory, excluded from active-work performance.',
  },
];

export const SEED_PHASE_B_VILLAS = [
  { villa_code: 'B-01', plot_numbers: 'Plot 1' },
  { villa_code: 'B-02', plot_numbers: 'Plot 2' },
  { villa_code: 'B-03', plot_numbers: 'Plot 3' },
  { villa_code: 'B-04', plot_numbers: 'Plot 4' },
  { villa_code: 'B-05-06', plot_numbers: 'Plots 5 & 6' },
  { villa_code: 'B-07-08-09', plot_numbers: 'Plots 7, 8 & 9' },
  { villa_code: 'B-10', plot_numbers: 'Plot 10' },
  { villa_code: 'B-11', plot_numbers: 'Plot 11' },
  { villa_code: 'B-12', plot_numbers: 'Plot 12' },
  { villa_code: 'B-14A', plot_numbers: 'Plot 14 — Villa A' },
  { villa_code: 'B-14B', plot_numbers: 'Plot 14 — Villa B' },
  { villa_code: 'B-15-16', plot_numbers: 'Plots 15 & 16' },
  { villa_code: 'B-17', plot_numbers: 'Plot 17' },
].map((v, i) => ({
  ...v,
  possession_status: 'Not Handed Over',
  works_stage: 'Not Started',
  active_status: 'Active',
  sort_order: i + 1,
  notes: '',
}));

export const SEED_COMMON_LOCATIONS = [
  {
    villa_code: 'Imagine Common Area',
    location_type: 'Common Area',
    plot_numbers: '',
    possession_status: 'Not Handed Over',
    works_stage: 'Works Pending',
    active_status: 'Active',
    sort_order: 1,
    notes: 'Site-wide common work — applies to the overall Imagine development.',
  },
  {
    villa_code: 'Imagine Infrastructure',
    location_type: 'Infrastructure',
    plot_numbers: '',
    possession_status: 'Not Handed Over',
    works_stage: 'Works Pending',
    active_status: 'Active',
    sort_order: 2,
    notes: 'Infrastructure and site-wide services for Imagine.',
  },
];