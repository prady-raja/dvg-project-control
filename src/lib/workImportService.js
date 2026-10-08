import { base44 } from '@/api/base44Client';
import { buildWorkbookTemplate } from '@/lib/xlsxImport';

/**
 * The client half of the CSV work import: the downloadable template, a file
 * fingerprint for repeated-import warnings, the reconciliation download, and
 * the single call into the server function that validates and writes.
 *
 * The template headers match the server's column list
 * (`base44/shared/workImport.ts`), which is where the matching and validation
 * rules live — the browser never decides what a row means.
 */

export const IMPORT_TEMPLATE_HEADERS = [
  'Project',
  'Phase',
  'Villa/location code',
  'Work category',
  'Discipline',
  'Work package',
  'Floor',
  'Area/Room',
  'Scope type',
  'Task description',
  'Contractor',
  'Responsible engineer',
  'Priority',
  'Status',
  'Baseline start',
  'Baseline finish',
  'Forecast finish',
  'Progress percentage',
  'Quantity',
  'Unit',
  'Acceptance criterion',
  'Estimated man-hours',
  'Blocker description',
  'Remarks',
  'Source reference',
];

export const IMPORT_TEMPLATE_CSV = `${IMPORT_TEMPLATE_HEADERS.join(',')}\n`;

/**
 * The rules shown on the screen and written into the Excel template's
 * Instructions sheet, so the workbook explains itself.
 */
export const IMPORT_RULES = [
  'Project, Discipline and Task description are needed on every row.',
  'Work category is “Villa Work” or “Site-Wide Work”. Leave it blank when the villa column already makes it obvious.',
  'Excel: the work rows go on the worksheet named Works. Instructions, Review_Only and Villa_Mapping are reference sheets and are never imported.',
  'Excel: dates are read as Excel holds them; a formula cell imports the value Excel last saved, so paste values if the workbook has not been recalculated. A completely empty row is ignored and does not disturb the row numbers of the rows after it.',
  'Dates: YYYY-MM-DD or DD-MMM-YY (2026-10-14 or 14-Oct-26). A date that cannot be read is reported, never guessed.',
  'Progress is a whole percentage 0–100. Leave it blank when progress is unknown — it stays blank, not 0%.',
  'Contractor may be left blank: the project default for that discipline and phase is applied. Nothing is invented.',
  'Priority and Status may be left blank: Medium and Not Started are used.',
  'Villa/location column: the villa code as registered (A-01, B-05-06, B-14A) or the plot reference as the source list wrote it (“Plots 5 & 6”). A reference that points to one villa is matched; anything ambiguous is flagged for you to confirm.',
  'Floor and Area/Room are matched against that villa’s own register. A room that is not registered is imported unassigned and listed in Needs Attention — never read as whole-villa work.',
  'The Responsible engineer column also carries the DVG coordinator for the activity.',
];

/** Worked examples, written into the Instructions sheet only — never onto Works. */
export const IMPORT_EXAMPLE_ROWS = [
  ['Imagine', 'B', 'B-01', 'Villa Work', 'FIN', 'Painting', 'Ground Floor', 'Living Room', 'Specific Room/Area', 'Repaint living room walls and ceiling', '', '', 'Medium', 'In Progress', '2026-10-10', '2026-10-20', '', '40', '120', 'Sqm', 'Even finish, no visible joints', '', '', '', 'IMG-EX-001'],
  ['Imagine', 'B', '', 'Site-Wide Work', 'CIVIL', '', '', '', 'Site-wide', 'Repair the common area paver walkway', '', '', 'High', 'Not Started', '2026-11-01', '2026-11-15', '', '', '80', 'Sqm', '', '', 'Material not received', '', 'IMG-EX-002'],
  ['Imagine', 'B', 'Plots 5 & 6', 'Villa Work', 'ELEC', 'Concealed wiring', '', '', 'Entire Villa', 'Concealed electrical wiring through the villa', '', '', 'High', 'Not Started', '', '', '', '', '', '', '', '', '', 'IMG-EX-003'],
];

export const MAX_FILE_BYTES = 1500000;

/** Same file contents in, same fingerprint out — used to warn on a re-upload. */
export function checksumOf(text) {
  let hash = 0x811c9dc5;
  const source = String(text || '');
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}-${source.length}`;
}

const csvValue = (value) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const downloadTemplate = () =>
  download('dvg-work-import-template.csv', IMPORT_TEMPLATE_CSV, 'text/csv;charset=utf-8');

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The standard Excel workbook: a Works sheet carrying the column headings, an
 * Instructions sheet with the rules and worked examples, and the two reference
 * sheets the Imagine workbooks carry. The villas of the chosen project are listed
 * on Villa_Mapping so a code is copied rather than retyped.
 */
export async function downloadExcelTemplate({ villas = [], projectName = '' } = {}) {
  const blob = await buildWorkbookTemplate({
    headers: IMPORT_TEMPLATE_HEADERS,
    rules: IMPORT_RULES,
    examples: IMPORT_EXAMPLE_ROWS,
    villas,
    projectName,
  });
  downloadBlob('dvg-works-import-template.xlsx', blob);
}

/** The per-row reconciliation of an import, as a spreadsheet. */
export function reconciliationCsv(result) {
  const fields = ['row_number', 'outcome', 'decision', 'task_ref', 'name', 'villa_code', 'discipline', 'contractor', 'missing', 'issues', 'note'];
  const rows = [
    ...(result.created || []),
    ...(result.linked || []),
    ...(result.skipped || []),
    ...(result.failed || []),
  ].sort((a, b) => a.row_number - b.row_number);

  const lines = [fields.join(',')];
  lines.push(`#,batch,${csvValue(result.batch_ref || '')},,,,,,,,`);
  rows.forEach((row) =>
    lines.push(
      fields
        .map((field) =>
          csvValue(
            field === 'missing' || field === 'issues'
              ? (row[field] || []).join(' | ')
              : row[field],
          ),
        )
        .join(','),
    ),
  );
  return lines.join('\n');
}

export const downloadReconciliation = (result) =>
  download(
    `import-reconciliation-${result.batch_ref || new Date().toISOString().slice(0, 10)}.csv`,
    reconciliationCsv(result),
    'text/csv;charset=utf-8',
  );

/** One call into the server function; the server decides everything else. */
export async function runWorkImport(payload) {
  try {
    const response = await base44.functions.invoke('workImport', payload);
    return response?.data || {};
  } catch (error) {
    const message =
      error?.response?.data?.error ||
      error?.data?.error ||
      (typeof error?.message === 'string' && !error.message.includes('SDK Error') ? error.message : '') ||
      'The import request was refused.';
    throw new Error(message);
  }
}