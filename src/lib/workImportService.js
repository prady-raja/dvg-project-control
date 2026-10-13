import { todayIst } from '@/lib/format';
import { base44 } from '@/api/base44Client';
import { buildWorkbookFromSheets, buildWorkbookTemplate } from '@/lib/xlsxImport';
import { mergePreviews, mergeResults, restrictToRows, splitIntoChunks } from '@/lib/shared/importChunks.ts';

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
  // Only a revised work list uses this: naming the task a row already is turns it
  // into an agreed update of that task rather than a second copy of the work.
  'Task reference',
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

/** Files go to the server in chunks, so the whole file can be much larger than one call takes. */
export const MAX_FILE_BYTES = 8000000;

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
  const fields = ['row_number', 'sheet', 'classification', 'proposed', 'outcome', 'decision', 'task_ref', 'name', 'villa_code', 'discipline', 'contractor', 'changed', 'missing', 'issues', 'note'];
  const rows = [
    ...(result.created || []),
    ...(result.updated || []),
    ...(result.unchanged || []),
    ...(result.rejected || []),
    ...(result.deferred || []),
    ...(result.linked || []),
    ...(result.failed || []),
  ].sort((a, b) => a.row_number - b.row_number);

  const lines = [fields.join(',')];
  // The first line names the batch, the source file and the worksheet, so a row
  // number in this report can always be found in the workbook it came from.
  lines.push(
    ['#', `batch ${result.batch_ref || ''}`, csvValue(result.batch?.source_file || ''), csvValue(result.batch?.source_sheet || '')].join(','),
  );
  rows.forEach((row) =>
    lines.push(
      fields
        .map((field) =>
          csvValue(
            field === 'sheet'
              ? row.sheet || result.batch?.source_sheet || ''
              : field === 'missing' || field === 'issues'
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
    `import-reconciliation-${result.batch_ref || todayIst()}.csv`,
    reconciliationCsv(result),
    'text/csv;charset=utf-8',
  );

/**
 * The reconciled workbook the server prepared: Works, Proposed_Changes,
 * Review_Only and Import_Summary. Before confirmation it states what would
 * change; after it, what was written. The original upload is never altered.
 */
export async function downloadReconciledWorkbook(result) {
  if (!result?.workbook) throw new Error('There is nothing to download yet.');
  const blob = await buildWorkbookFromSheets(result.workbook);
  const name = result.batch_ref ? `reconciled-work-${result.batch_ref}.xlsx` : 'reconciled-work-proposed.xlsx';
  downloadBlob(name, blob);
}

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

/**
 * Run a preview or a commit over a whole file, a chunk of rows at a time
 * (I-01). Every chunk is a small file of its own with the file's real row numbers;
 * decisions and corrections are keyed by row number, so each chunk only receives
 * its own. A commit keeps one ImportBatch across chunks. If a chunk fails the
 * error names the batch and how many chunks were already written — running the
 * import again recognises those rows as already on the register.
 */
export async function runChunkedImport({ action, file, params = {}, onProgress }) {
  const chunks = splitIntoChunks(file.text, { rowNumbers: file.rowNumbers || [] });
  const total = chunks.length;
  const rowsInFile = chunks.reduce((sum, chunk) => sum + chunk.rowNumbers.length, 0);
  const results = [];
  let batchId = '';
  let batchRef = '';

  for (let index = 0; index < total; index += 1) {
    const chunk = chunks[index];
    onProgress?.({ index, total, rows: Math.min((index + 1) * 250, rowsInFile), rowsInFile });
    const keyed = (map) => restrictToRows(map, chunk.rowNumbers);
    const payload = {
      ...params,
      action,
      file_name: file.name,
      source_sheet: file.sheet || '',
      checksum: file.checksum,
      file_text: chunk.text,
      row_numbers: chunk.rowNumbers,
      overrides: keyed(params.overrides),
      links: keyed(params.links),
      ...(action === 'commit'
        ? {
          decisions: keyed(params.decisions),
          reasons: keyed(params.reasons),
          edits: keyed(params.edits),
          expected: keyed(params.expected),
          batch_id: batchId,
          chunk_index: index,
          chunk_total: total,
          total_rows: rowsInFile,
        }
        : {}),
    };
    try {
      const result = await runWorkImport(payload);
      results.push(result);
      if (action === 'commit') {
        batchId = result.batch_id || batchId;
        batchRef = result.batch_ref || batchRef;
      }
    } catch (error) {
      if (action === 'commit' && index > 0) {
        throw new Error(
          `${error.message} Chunks 1–${index} of ${total} were already written under batch ${batchRef}; run the import again and those rows will show as already on the register.`,
        );
      }
      throw error;
    }
  }
  return action === 'commit' ? mergeResults(results) : mergePreviews(results);
}