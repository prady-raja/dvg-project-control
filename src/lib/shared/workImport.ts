/**
 * FRONTEND COPY of the work-list reading rules in base44/shared/workImport.ts —
 * the browser may not import from base44/, so the columns a file is read against
 * and the small text helpers live here too. Keep the two in step. The server copy
 * holds the matching, validation and writing rules as well; those stay server-side.
 */

export const IMPORT_COLUMNS = [
  { key: 'project', label: 'Project', aliases: ['project', 'project name', 'development'] },
  { key: 'phase', label: 'Phase', aliases: ['phase', 'phase code', 'phase name'] },
  { key: 'villa_code', label: 'Villa/location code', aliases: ['villa/location code', 'villa code', 'villa', 'location', 'location code', 'villa/location', 'plot', 'plot number'] },
  { key: 'work_category', label: 'Work category', aliases: ['work category', 'category', 'work scope', 'scope'] },
  { key: 'discipline', label: 'Discipline', aliases: ['discipline', 'discipline code', 'trade'] },
  { key: 'work_package', label: 'Work package', aliases: ['work package', 'package', 'sub package'] },
  // Where inside the villa the work is. Optional on every row: the older
  // template has none of these and imports exactly as it did before.
  { key: 'floor', label: 'Floor', aliases: ['floor', 'level', 'storey', 'floor name'] },
  { key: 'area', label: 'Area/Room', aliases: ['area/room', 'area', 'room', 'rooms', 'room/area', 'space', 'location within villa'] },
  { key: 'scope_type', label: 'Scope type', aliases: ['scope type', 'task scope', 'extent', 'coverage'] },
  { key: 'name', label: 'Task description', aliases: ['task description', 'description', 'task', 'task name', 'work description'] },
  { key: 'contractor', label: 'Contractor', aliases: ['contractor', 'contractor name', 'agency'] },
  { key: 'responsible_engineer', label: 'Responsible engineer', aliases: ['responsible engineer', 'engineer', 'site engineer', 'responsible dvg coordinator', 'dvg coordinator', 'coordinator'] },
  { key: 'priority', label: 'Priority', aliases: ['priority'] },
  { key: 'status', label: 'Status', aliases: ['status'] },
  { key: 'baseline_start', label: 'Baseline start', aliases: ['baseline start', 'start date', 'planned start'] },
  { key: 'baseline_finish', label: 'Baseline finish', aliases: ['baseline finish', 'finish date', 'planned finish'] },
  { key: 'current_forecast_finish', label: 'Forecast finish', aliases: ['forecast finish', 'forecast', 'forecast date'] },
  { key: 'progress_percent', label: 'Progress percentage', aliases: ['progress percentage', 'progress %', 'progress', '% complete', 'percent complete', 'completed percentage'] },
  { key: 'planned_quantity', label: 'Quantity', aliases: ['quantity', 'planned quantity', 'qty', 'quantity planned'] },
  { key: 'measurement_unit', label: 'Unit', aliases: ['unit', 'measurement unit', 'units', 'uom'] },
  { key: 'acceptance_criterion', label: 'Acceptance criterion', aliases: ['acceptance criterion', 'acceptance criteria', 'acceptance', 'inspection criterion', 'quality criterion'] },
  { key: 'estimated_manhours', label: 'Estimated man-hours', aliases: ['estimated man-hours', 'estimated manhours', 'man-hours', 'manhours', 'estimated hours'] },
  { key: 'blocker_description', label: 'Blocker description', aliases: ['blocker description', 'blocker', 'blockers', 'blocking issue'] },
  { key: 'remarks', label: 'Remarks', aliases: ['remarks', 'notes', 'remarks/notes'] },
  { key: 'source_reference', label: 'Source reference', aliases: ['source reference', 'source ref', 'reference', 'source row', 'external reference'] },
  // Optional, and only for a revised work list: naming the task this row already
  // is turns the row into an agreed update of that task instead of a new one. A
  // reference that is not on the project is reported, never guessed at.
  { key: 'task_ref', label: 'Task reference', aliases: ['task reference', 'task ref', 'existing task reference', 'existing task ref'] },
  { key: 'exported_at', label: 'Last updated (do not edit)', aliases: ['last updated (do not edit)', 'last updated', 'exported at', 'row last updated'], hidden: true },
];

export const IMPORT_TEMPLATE_HEADERS = IMPORT_COLUMNS.filter((column) => !column.hidden).map((column) => column.label);

export const cleanText = (value) => (value === null || value === undefined ? '' : String(value).trim());

/** Case, spaces and punctuation all ignored — for matching names and codes. */
export const looseKey = (value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');

/** RFC-4180 style reader: quoted fields, embedded commas, CRLF or LF. */
export function parseCsv(text) {
  const rows = [];
  const source = String(text || '').replace(/^\uFEFF/, '');
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cleanText(cell) !== ''));
}