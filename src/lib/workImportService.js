import { base44 } from '@/api/base44Client';

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
  'Task description',
  'Contractor',
  'Responsible engineer',
  'Priority',
  'Status',
  'Baseline start',
  'Baseline finish',
  'Forecast finish',
  'Progress percentage',
  'Estimated man-hours',
  'Blocker description',
  'Remarks',
  'Source reference',
];

export const IMPORT_TEMPLATE_CSV = `${IMPORT_TEMPLATE_HEADERS.join(',')}\n`;

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