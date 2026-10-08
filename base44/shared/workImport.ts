/**
 * CSV work import.
 *
 * One module reads the file, maps it onto the Imagine records, validates every
 * row, spots likely duplicates and builds the task records the import writes.
 * Preview and import run this same code, so what the screen reports is exactly
 * what a confirmed import creates.
 *
 * Nothing here invents a value: a blank cell stays blank, an unreadable date is
 * reported instead of guessed, an ambiguous villa is flagged instead of chosen,
 * and a contractor is only ever the one named in the row or the project's own
 * configured default for that discipline and phase.
 */

import { buildVillaIndex, normalizeCode, plotNumbersOf, resolveVillaCode } from './villaResolve.ts';
import { SCOPE_TYPES, areaKeys, describeScope, normalizeAreaName } from './villaAreas.ts';

// Villa and plot resolution lives in one module so that every path meeting a
// villa reference — import, assistant, task creation, reports, snags — reads it
// the same way.
export { normalizeCode, plotNumbersOf };

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
];

export const IMPORT_TEMPLATE_HEADERS = IMPORT_COLUMNS.map((column) => column.label);

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_TEXT = 1500000;
export const TASK_SCAN_LIMIT = 2000;

export const CATEGORY_VILLA = 'Villa Work';
export const CATEGORY_SITE = 'Site-Wide Work';

const STATUS_VALUES = ['Not Started', 'In Progress', 'Blocked', 'Execution Complete', 'Under Inspection', 'Approved', 'Closed'];
const PRIORITY_VALUES = ['Low', 'Medium', 'High', 'Critical'];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export const OVERRIDE_KEYS = [
  'project', 'phase', 'phase_id', 'villa_code', 'location_id', 'work_category', 'discipline',
  'work_package', 'floor', 'area', 'scope_type', 'name', 'contractor', 'contractor_id',
  'responsible_engineer', 'priority', 'status',
  'baseline_start', 'baseline_finish', 'current_forecast_finish', 'progress_percent',
  'planned_quantity', 'measurement_unit', 'acceptance_criterion',
  'estimated_manhours', 'blocker_description', 'remarks', 'source_reference',
];

/**
 * One villa + its floor/room scope. The same wording in two different rooms is
 * not the same work, so the duplicate check keys on the scope as well.
 */
export const scopeKeyOf = (record) => {
  const areas = [...(record?.area_ids || [])].filter(Boolean).sort();
  if (areas.length) return `rooms:${areas.join('+')}`;
  if (record?.floor_id) return `floor:${record.floor_id}`;
  return 'whole';
};

const UNIT_VALUES = ['Nos', 'Sqm', 'Sqft', 'Rmt', 'Cum', 'Kg', 'LS', 'Set', 'Litre'];

/* ------------------------------------------------------------------ helpers */

export const listOf = (res) => (Array.isArray(res) ? res : res?.items || []);

export const cleanText = (value) => (value === null || value === undefined ? '' : String(value).trim());

/** Case, spaces and punctuation all ignored — for matching names and codes. */
export const looseKey = (value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');



export const labelOfLocation = (location) =>
  location ? `${location.villa_code}${location.location_type === 'Villa' ? '' : ` (${location.location_type})`}` : '';

/* ------------------------------------------------------------------ the file */

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

/**
 * Row numbers exactly as the source file holds them: an Excel workbook reports
 * the worksheet row, so a row can be found where the person sees it even when
 * the sheet has empty rows between activities, and a CSV reports the line it sits
 * on. A missing or malformed list is ignored rather than trusted — the position
 * in the file decides then.
 */
function rowNumberMap(provided, count) {
  if (!Array.isArray(provided) || !count || provided.length < count) return null;
  const numbers = provided.slice(0, count).map((value) => Number(value));
  for (let i = 0; i < numbers.length; i += 1) {
    if (!Number.isInteger(numbers[i]) || numbers[i] < 2) return null;
    if (i > 0 && numbers[i] <= numbers[i - 1]) return null;
  }
  return numbers;
}

/**
 * Header row -> column map, then one entry per data row. `row_number` is the
 * spreadsheet row, so row 2 is the first task in the file.
 */
export function readImportFile(text, options = {}) {
  const rows = parseCsv(text);
  if (!rows.length) return { error: 'That file is empty.', columns: [], rows: [], total: 0, unmapped: [] };

  const header = rows[0].map(cleanText);
  const columns = [];
  const taken = new Set();
  const mapped = header.map((raw) => {
    const key = looseKey(raw);
    if (!key) return '';
    const def = IMPORT_COLUMNS.find((column) =>
      [column.label, column.key, ...column.aliases].some((alias) => looseKey(alias) === key),
    );
    if (!def || taken.has(def.key)) return '';
    taken.add(def.key);
    columns.push({ key: def.key, label: def.label, index: header.indexOf(raw) });
    return def.key;
  });

  if (!taken.size) {
    return {
      error: 'No recognised columns. Download the import template and keep its header row.',
      columns: [], rows: [], total: 0, unmapped: header,
    };
  }
  if (!taken.has('name')) {
    return {
      error: 'The file needs a “Task description” column.',
      columns, rows: [], total: 0, unmapped: [],
    };
  }

  const body = rows.slice(1);
  const rowNumbers = rowNumberMap(options.rowNumbers, body.length);
  const dataRows = body.map((cells, index) => {
    const values = {};
    columns.forEach((column) => {
      values[column.key] = cleanText(cells[column.index]);
    });
    return { row_number: rowNumbers ? rowNumbers[index] : index + 2, values };
  });

  return {
    columns,
    rows: dataRows,
    total: dataRows.length,
    unmapped: header.filter((raw, index) => cleanText(raw) && !mapped[index]),
  };
}

/* ------------------------------------------------------------------ values */

const isoFrom = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const twoDigitYear = (value) => {
  const text = String(value);
  const n = Number(text);
  if (text.length <= 2) return n >= 70 ? 1900 + n : 2000 + n;
  return n;
};

/** ISO `YYYY-MM-DD`, `DD-MMM-YY`, or day-first `DD/MM/YYYY`. Blank stays blank. */
export function parseImportDate(raw) {
  const text = cleanText(raw);
  if (!text) return { value: null };

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const iso = isoFrom(match[1], match[2], match[3]);
    return iso ? { value: iso } : { value: null, error: `“${text}” is not a real date.` };
  }

  match = text.match(/^(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.]*(\d{2,4})$/);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (!month) return { value: null, error: `“${text}” has an unrecognised month.` };
    const iso = isoFrom(twoDigitYear(match[3]), month, match[1]);
    return iso ? { value: iso } : { value: null, error: `“${text}” is not a real date.` };
  }

  match = text.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (match) {
    const iso = isoFrom(twoDigitYear(match[3]), match[2], match[1]);
    return iso ? { value: iso } : { value: null, error: `“${text}” is not a real date.` };
  }

  return { value: null, error: `“${text}” is not a readable date — use YYYY-MM-DD or DD-MMM-YY.` };
}

export function parseImportNumber(raw, options = {}) {
  const text = cleanText(raw).replace(/,/g, '');
  if (!text) return { value: null };
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { value: null, error: `“${raw}” is not a number.` };
  const value = Number(text);
  if (options.min !== undefined && value < options.min) {
    return { value: null, error: `“${raw}” is below the allowed minimum of ${options.min}.` };
  }
  if (options.max !== undefined && value > options.max) {
    return { value: null, error: `“${raw}” is above the allowed maximum of ${options.max}.` };
  }
  return { value };
}

const matchEnum = (raw, list, what) => {
  const key = looseKey(raw);
  if (!key) return { value: '' };
  const hit = list.find((item) => looseKey(item) === key);
  if (hit) return { value: hit };
  const partial = list.filter((item) => looseKey(item).startsWith(key));
  if (partial.length === 1) return { value: partial[0] };
  return { value: '', error: `“${raw}” is not a valid ${what}. Use one of: ${list.join(', ')}.` };
};

export const matchCategory = (raw) => {
  const key = looseKey(raw);
  if (!key) return '';
  if (looseKey(CATEGORY_VILLA).startsWith(key) || key.startsWith('villa')) return CATEGORY_VILLA;
  if (looseKey(CATEGORY_SITE).startsWith(key) || key.startsWith('site') || key === 'common' || key === 'infra') return CATEGORY_SITE;
  return '';
};

/* ------------------------------------------------------------------ matching */

export function resolvePhase(raw, ctx) {
  const key = looseKey(raw);
  if (!key) return { value: null };
  const hit = ctx.phases.find((phase) => looseKey(phase.code) === key || looseKey(phase.name) === key);
  if (hit) return { value: hit };
  if (key.length >= 3) {
    const partial = ctx.phases.filter((phase) => {
      const name = looseKey(phase.name);
      return name.includes(key) || key.includes(name);
    });
    if (partial.length === 1) return { value: partial[0], via: 'partial' };
  }
  return { value: null };
}

export function resolveDiscipline(raw, ctx) {
  const key = looseKey(raw);
  if (!key) return { missing: true };
  const hit = ctx.disciplines.find((d) => looseKey(d.code) === key || looseKey(d.name) === key);
  if (hit) return { code: hit.code, name: hit.name };
  const partial = ctx.disciplines.filter((d) => {
    const name = looseKey(d.name);
    const code = looseKey(d.code);
    return name.startsWith(key) || key.startsWith(name) || code.startsWith(key);
  });
  if (partial.length === 1) return { code: partial[0].code, name: partial[0].name, via: 'partial' };
  return { unknown: true, error: `Discipline “${raw}” is not in the discipline list.` };
}

export function resolveContractor(raw, ctx) {
  const key = looseKey(raw);
  if (!key) return { blank: true };
  const hit = ctx.contractors.find((c) => looseKey(c.name) === key);
  if (hit) return { contractor: hit };
  const partial = ctx.contractors.filter((c) => {
    const name = looseKey(c.name);
    return name.startsWith(key) || key.startsWith(name) || name.includes(key);
  });
  if (partial.length === 1) return { contractor: partial[0], via: 'partial' };
  if (partial.length > 1) {
    return { ambiguous: partial, error: `Contractor “${raw}” matches ${partial.map((c) => c.name).join(', ')} — state which one.` };
  }
  return { unknown: true, error: `Contractor “${raw}” was not found.` };
}

export function defaultContractorId(defaults, phaseId, disciplineCode) {
  const forDiscipline = (defaults || []).filter((d) => d.active !== false && d.discipline === disciplineCode);
  const exact = forDiscipline.find((d) => d.phase_id && d.phase_id === phaseId);
  if (exact) return exact.contractor_id;
  const anyPhase = forDiscipline.find((d) => !d.phase_id);
  return anyPhase ? anyPhase.contractor_id : '';
}

/**
 * A villa written as a code, as part of a combined villa (`B-08` for
 * `B-07-08-09`) or as an original plot reference (`Plot 8`). More than one
 * possible villa is reported as ambiguous — never guessed.
 */
export function resolveLocation(raw, ctx, phaseIdHint) {
  // Read by the one villa-mapping authority, so an import, a site message and a
  // task all turn the same written reference into the same villa.
  const found = resolveVillaCode(raw, ctx.villaIndex, phaseIdHint || null);
  if (found.status === 'matched') return { status: 'matched', location: found.location, via: found.via };
  if (found.status === 'ambiguous') return { status: 'ambiguous', candidates: found.candidates };
  if (found.status === 'blank') return { status: 'blank' };
  return { status: 'unknown' };
}

/* ------------------------------------------------------------------ context */

async function loadProjectData(base44, projectId) {
  const svc = base44.asServiceRole.entities;
  const [projectRes, phasesRes, locationsRes, areasRes, floorsRes] = await Promise.all([
    svc.Project.filter({ id: projectId }, { limit: 1 }),
    svc.Phase.filter({ project_id: projectId }, { limit: 100 }),
    svc.Location.filter({ project_id: projectId }, { limit: 500 }),
    svc.VillaArea.filter({ project_id: projectId }, { limit: 500 }),
    svc.VillaFloor.filter({ project_id: projectId }, { limit: 300 }),
  ]);
  const [disciplinesRes, contractorsRes, defaultsRes, packagesRes, tasksRes] = await Promise.all([
    svc.Discipline.filter({}, { limit: 200 }),
    svc.Contractor.filter({}, { limit: 300 }),
    svc.ContractorDefault.filter({ project_id: projectId }, { limit: 500 }),
    svc.WorkPackage.filter({ project_id: projectId }, { limit: 1000 }),
    svc.Task.filter(
      { project_id: projectId },
      {
        limit: TASK_SCAN_LIMIT,
        fields: ['id', 'task_ref', 'name', 'discipline', 'location_id', 'phase_id', 'status', 'archived', 'is_villa_work_parent', 'source_reference', 'import_source_file', 'import_row_number'],
      },
    ),
  ]);

  return {
    project: listOf(projectRes)[0],
    phases: listOf(phasesRes),
    locations: listOf(locationsRes),
    areas: listOf(areasRes),
    floors: listOf(floorsRes),
    disciplines: listOf(disciplinesRes),
    contractors: listOf(contractorsRes),
    defaults: listOf(defaultsRes),
    packages: listOf(packagesRes),
    tasks: listOf(tasksRes),
  };
}

export async function loadImportContext(base44, projectId) {
  const data = await loadProjectData(base44, projectId);
  if (!data.project) throw new Error('That project was not found.');

  const locationCodeById = new Map();
  const villaIndex = buildVillaIndex(data.locations);

  data.locations.forEach((location) => {
    locationCodeById.set(location.id, location.villa_code);
  });

  // Existing work, so a repeat import can be seen before it creates anything.
  const work = data.tasks.filter((task) => task.is_villa_work_parent !== true);
  const dupIndex = {
    byFileRow: new Map(),
    bySource: new Map(),
    byNameDiscipline: new Map(),
    byNameAreaDiscipline: new Map(),
    byName: new Map(),
  };
  work.forEach((task) => {
    if (task.import_source_file) {
      dupIndex.byFileRow.set(`${looseKey(task.import_source_file)}|${task.import_row_number}`, task);
    }
    if (task.source_reference) {
      const ref = looseKey(task.source_reference);
      if (!dupIndex.bySource.has(ref)) dupIndex.bySource.set(ref, task);
    }
    const name = looseKey(task.name);
    if (name) {
      const key = `${name}|${task.discipline}`;
      dupIndex.byNameDiscipline.set(key, [...(dupIndex.byNameDiscipline.get(key) || []), task]);
      dupIndex.byName.set(name, [...(dupIndex.byName.get(name) || []), task]);
    }
  });

  const phaseById = new Map(data.phases.map((phase) => [phase.id, phase]));

  return {
    ...data,
    index: { byCode: villaIndex.byCode, byLoose: villaIndex.byLoose, plots: villaIndex.plots },
    villaIndex,
    dupIndex,
    locationCodeById,
    phaseById,
    phaseLabel: (phaseId) => {
      const phase = phaseById.get(phaseId);
      return phase ? phase.code || phase.name : 'site-wide';
    },
  };
}

/* ------------------------------------------------------------------ duplicate */

function detectDuplicate({ rowNumber, fileName, values, resolved, ctx }) {
  let candidate = null;
  let confidence = '';
  let reason = '';
  const others = [];

  const consider = (task, level, why) => {
    if (!task) return;
    const rank = level === 'confident' ? 2 : 1;
    const best = candidate ? (confidence === 'confident' ? 2 : 1) : 0;
    if (rank > best) {
      if (candidate) others.push(candidate.task_ref);
      candidate = task;
      confidence = level;
      reason = why;
    } else if (task.id !== candidate?.id) {
      others.push(task.task_ref);
    }
  };

  const fileHit = ctx.dupIndex.byFileRow.get(`${looseKey(fileName)}|${rowNumber}`);
  if (fileHit) consider(fileHit, 'confident', `Row ${rowNumber} of this file was imported before`);

  const sourceKey = looseKey(values.source_reference);
  if (sourceKey) {
    const hit = ctx.dupIndex.bySource.get(sourceKey);
    if (hit) consider(hit, 'confident', `Same source reference (${cleanText(values.source_reference)})`);
  }

  const name = looseKey(resolved.name);
  if (name && resolved.discipline) {
    // The same wording in the same villa is only the same work when it is in the
    // same room or floor — otherwise it is offered as a possible duplicate.
    const scopeKey = scopeKeyOf({ area_ids: resolved.area_ids, floor_id: resolved.floor_id });
    const areaKey = `${name}|${resolved.discipline}|${resolved.location_id || 'site'}|${scopeKey}`;
    (ctx.dupIndex.byNameAreaDiscipline.get(areaKey) || []).forEach((task) => {
      consider(task, 'confident', scopeKey === 'whole'
        ? 'Same villa, discipline and description'
        : 'Same villa, discipline, room/area and description');
    });
    (ctx.dupIndex.byNameDiscipline.get(`${name}|${resolved.discipline}`) || []).forEach((task) => {
      const samePlace = (task.location_id || '') === (resolved.location_id || '');
      if (samePlace && scopeKeyOf(task) === scopeKey) return;
      consider(task, 'possible', samePlace
        ? 'Same villa, discipline and description in a different room/area — not the same work unless you decide so'
        : 'Same discipline and description elsewhere on this project');
    });
  }
  if (name && resolved.location_id) {
    (ctx.dupIndex.byName.get(name) || []).forEach((task) => {
      if ((task.location_id || '') === resolved.location_id) {
        consider(task, 'possible', 'Same villa and description under a different discipline');
      }
    });
  }

  if (!candidate) return null;
  return {
    task_id: candidate.id,
    task_ref: candidate.task_ref,
    name: candidate.name,
    status: candidate.status,
    archived: candidate.archived === true,
    location: ctx.locationCodeById.get(candidate.location_id) || 'Site-wide',
    confidence,
    reason,
    can_link: confidence === 'confident',
    others: [...new Set(others)].filter((ref) => ref && ref !== candidate.task_ref).slice(0, 5),
  };
}

/* ------------------------------------------------------------------ validation */

export function buildTaskPayload(result, extra = {}) {
  const r = result.resolved;
  const values = result.values;
  const payload = {
    project_id: r.project_id,
    phase_id: r.phase_id || null,
    location_id: r.location_id || null,
    floor_id: r.floor_id || null,
    area_ids: r.area_ids || [],
    area_label: r.area_label || null,
    scope_type: r.scope_type || (r.location_id ? 'Entire Villa' : 'Site-wide'),
    // The words used in the source list are kept, and a row whose room was named
    // but never registered is flagged: it must never be read as confirmed
    // whole-villa work, and it never takes part in a villa-wide completion.
    source_location_text: [r.floor_text, r.area_text].filter(Boolean).join(' · ') || null,
    scope_unresolved: r.scope_unassigned === true,
    discipline: r.discipline,
    work_package: r.work_package || null,
    name: r.name,
    status: r.status_value || 'Not Started',
    priority: r.priority_value || 'Medium',
    contractor_id: r.contractor_id || null,
    responsible_engineer: cleanText(values.responsible_engineer) || null,
    progress_percent: r.progress_percent,
    planned_quantity: r.planned_quantity,
    measurement_unit: r.measurement_unit || null,
    acceptance_criterion: r.acceptance_criterion,
    estimated_manhours: r.estimated_manhours,
    baseline_start: r.baseline_start,
    baseline_finish: r.baseline_finish,
    current_forecast_finish: r.current_forecast_finish,
    blocker_description: cleanText(values.blocker_description) || null,
    remarks: cleanText(values.remarks) || null,
    source_reference: cleanText(values.source_reference) || null,
    ...extra,
  };
  if (r.baseline_start || r.baseline_finish) payload.baseline_approval_status = 'Not Submitted';
  return payload;
}

function validateOneRow(row, ctx, override) {
  const values = { ...row.values };
  OVERRIDE_KEYS.forEach((key) => {
    if (override && override[key] !== undefined && override[key] !== null) values[key] = cleanText(override[key]);
  });

  const issues = [];
  const add = (severity, code, message) => issues.push({ severity, code, message });

  const resolved = {
    project_id: ctx.project.id,
    project_name: ctx.project.name,
    category: '',
    location_id: '',
    villa_code: '',
    location_label: '',
    location_state: '',
    candidates: [],
    floor_id: '',
    area_ids: [],
    area_label: '',
    scope_type: '',
    scope_hint: '',
    scope_unassigned: false,
    floor_text: '',
    area_text: '',
    planned_quantity: null,
    measurement_unit: '',
    acceptance_criterion: null,
    phase_id: '',
    phase_code: 'GEN',
    phase_label: '',
    discipline: '',
    discipline_name: '',
    work_package: cleanText(values.work_package),
    contractor_id: '',
    contractor_name: '',
    contractor_source: '',
    status_value: 'Not Started',
    priority_value: 'Medium',
    baseline_start: null,
    baseline_finish: null,
    current_forecast_finish: null,
    progress_percent: null,
    estimated_manhours: null,
    name: cleanText(values.name),
  };

  /* project ------------------------------------------------------------- */
  // The import is already scoped to one project, so the column only has to be
  // recognisable as that project — “Imagine” for “Imagine Villas” is fine, a
  // different development is not.
  const projectText = cleanText(values.project);
  if (projectText) {
    const key = looseKey(projectText);
    const nameKey = looseKey(ctx.project.name);
    const codeKey = looseKey(ctx.project.code);
    const matches =
      key === nameKey ||
      (!!codeKey && key === codeKey) ||
      nameKey.startsWith(key) ||
      key.startsWith(nameKey) ||
      (!!codeKey && codeKey.startsWith(key));
    if (!matches) add('error', 'project_mismatch', `Row names project “${projectText}”, but this import is for ${ctx.project.name}.`);
  }

  /* phase --------------------------------------------------------------- */
  let phase = null;
  const phaseText = cleanText(values.phase);
  if (override.phase_id) {
    phase = ctx.phases.find((p) => p.id === cleanText(override.phase_id)) || null;
    if (!phase) add('error', 'phase_unknown', 'The chosen phase no longer exists.');
  } else if (phaseText) {
    const found = resolvePhase(phaseText, ctx);
    if (found.value) phase = found.value;
    else add('error', 'phase_unknown', `Phase “${phaseText}” was not found on ${ctx.project.name}.`);
  }

  /* work category ------------------------------------------------------- */
  const categoryText = cleanText(values.work_category);
  let category = '';
  if (categoryText) {
    category = matchCategory(categoryText);
    if (!category) add('error', 'category_unknown', `Work category “${categoryText}” is not one of: ${CATEGORY_VILLA}, ${CATEGORY_SITE}.`);
  }

  /* location ------------------------------------------------------------ */
  const locationText = cleanText(values.villa_code);
  let location = null;
  if (override.location_id) {
    location = ctx.locations.find((l) => l.id === cleanText(override.location_id)) || null;
    if (!location) {
      resolved.location_state = 'unknown';
      add('error', 'location_unknown', 'The chosen villa or location no longer exists.');
    } else {
      resolved.location_state = 'matched';
      resolved.villa_code = location.villa_code;
      resolved.location_label = labelOfLocation(location);
    }
  } else if (locationText) {
    const found = resolveLocation(locationText, ctx, phase?.id || null);
    if (found.status === 'matched') {
      location = found.location;
      resolved.location_state = 'matched';
      resolved.villa_code = found.location.villa_code;
      resolved.location_label = labelOfLocation(found.location);
      if (found.via !== 'code') {
        add('warning', 'location_matched', `“${locationText}” was matched to ${found.location.villa_code} through its original plot reference — confirm this is the right villa.`);
      }
    } else if (found.status === 'ambiguous') {
      resolved.location_state = 'ambiguous';
      resolved.candidates = found.candidates.map((candidate) => ({
        id: candidate.id,
        code: candidate.villa_code,
        phase: ctx.phaseLabel(candidate.phase_id),
      }));
      add('error', 'location_ambiguous', `“${locationText}” matches more than one villa (${found.candidates.map((c) => c.villa_code).join(', ')}) — choose the right one.`);
    } else {
      resolved.location_state = 'unknown';
      add('error', 'location_unknown', `No villa or location matches “${locationText}”.`);
    }
  } else {
    resolved.location_state = 'blank';
  }
  if (location) resolved.location_id = location.id;

  if (!category && !categoryText) {
    if (location) category = location.location_type === 'Villa' ? CATEGORY_VILLA : CATEGORY_SITE;
    else if (!locationText) add('error', 'category_required', `Set the work category (${CATEGORY_VILLA} or ${CATEGORY_SITE}).`);
  }
  resolved.category = category;

  if (category === CATEGORY_VILLA) {
    if (!locationText && !override.location_id) {
      add('error', 'villa_required', 'Villa work needs a villa code.');
    } else if (location && location.location_type !== 'Villa') {
      add('error', 'villa_type', `“${location.villa_code}” is a ${location.location_type}, not a villa.`);
    }
  }

  /* phase, settled from the villa ---------------------------------------- */
  const villaPhase = location?.phase_id ? ctx.phaseById.get(location.phase_id) || null : null;
  if (villaPhase) {
    if (phase && phase.id !== villaPhase.id) {
      add('warning', 'phase_conflict', `The row says ${phase.code || phase.name}, but ${location.villa_code} belongs to ${villaPhase.code || villaPhase.name}. The villa's phase is used.`);
    }
    resolved.phase_id = villaPhase.id;
    resolved.phase_code = villaPhase.code || 'GEN';
    resolved.phase_label = villaPhase.code || villaPhase.name;
  } else if (phase) {
    resolved.phase_id = phase.id;
    resolved.phase_code = phase.code || 'GEN';
    resolved.phase_label = phase.code || phase.name;
  } else {
    resolved.phase_label = 'site-wide';
  }

  /* discipline ---------------------------------------------------------- */
  const disciplineText = cleanText(values.discipline);
  const discipline = resolveDiscipline(disciplineText, ctx);
  if (discipline.missing) add('error', 'discipline_blank', 'Discipline is required.');
  else if (discipline.unknown) add('error', 'discipline_unknown', discipline.error);
  else {
    resolved.discipline = discipline.code;
    resolved.discipline_name = discipline.name;
    if (discipline.via === 'partial') add('warning', 'discipline_matched', `Discipline “${disciplineText}” was matched to ${discipline.name}.`);
  }

  /* task text ----------------------------------------------------------- */
  if (!cleanText(values.name)) add('error', 'name_blank', 'Task description is required.');
  resolved.name = cleanText(values.name);

  /* work package -------------------------------------------------------- */
  if (cleanText(values.work_package) && resolved.discipline) {
    const packages = ctx.packages.filter((p) => p.discipline === resolved.discipline);
    const key = looseKey(values.work_package);
    const hit = packages.find((p) => looseKey(p.package_name) === key);
    if (hit) resolved.work_package = hit.package_name;
    else {
      add('warning', 'package_nonstandard', `“${values.work_package}” is not a standard ${resolved.discipline_name || resolved.discipline} work package on this project — it is imported as written.`);
    }
  }

  /* floor and room ------------------------------------------------------ */
  // The room register of this villa decides. A floor or room that is not
  // registered is left unassigned and reported — never matched to something with
  // a similar name, and never guessed from the wording of the activity.
  const floorText = cleanText(values.floor);
  const areaText = cleanText(values.area);
  resolved.floor_text = floorText;
  resolved.area_text = areaText;
  const scopeText = cleanText(values.scope_type);
  const villaRooms = location ? ctx.areas.filter((area) => area.location_id === location.id) : [];
  const villaFloors = location ? ctx.floors.filter((floor) => floor.location_id === location.id) : [];

  if (scopeText) {
    const key = looseKey(scopeText);
    const exact = SCOPE_TYPES.find((item) => looseKey(item) === key);
    const loose = key.startsWith('room') || key.startsWith('single') ? 'Specific Room/Area'
      : key.startsWith('multi') ? 'Multiple Rooms/Areas'
        : key.startsWith('floor') ? 'Entire Floor'
          : key.startsWith('villa') || key.startsWith('whole') ? 'Entire Villa'
            : key.startsWith('site') ? 'Site-wide' : '';
    if (exact || loose) resolved.scope_hint = exact || loose;
    else add('warning', 'scope_unknown', `Scope type “${scopeText}” is not one of: ${SCOPE_TYPES.join(', ')} — the floor and room columns decide instead.`);
  }

  if (location && (floorText || areaText)) {
    if (floorText) {
      const key = looseKey(floorText);
      const hit = villaFloors.find((floor) => looseKey(floor.floor_name) === key || looseKey(floor.floor_code) === key);
      if (hit) resolved.floor_id = hit.id;
      else {
        const partial = villaFloors.filter((floor) => looseKey(floor.floor_name).startsWith(key));
        if (partial.length === 1) {
          resolved.floor_id = partial[0].id;
          add('warning', 'floor_matched', `Floor “${floorText}” was matched to ${partial[0].floor_name}.`);
        } else {
          resolved.scope_unassigned = true;
          add('warning', 'floor_unassigned', `Floor “${floorText}” is not registered on ${location.villa_code} — the task imports without it and is listed in Needs Attention.`);
        }
      }
    }

    const unmatched = [];
    areaText.split(/[,;/|]+/).map(cleanText).filter(Boolean).forEach((roomName) => {
      const key = normalizeAreaName(roomName);
      const hits = villaRooms.filter((room) => areaKeys(room).includes(key));
      if (hits.length === 1) {
        if (!resolved.area_ids.includes(hits[0].id)) resolved.area_ids.push(hits[0].id);
        return;
      }
      if (hits.length > 1) {
        add('warning', 'area_ambiguous', `“${roomName}” matches ${hits.length} rooms of ${location.villa_code} (${hits.map((room) => room.area_name).join(', ')}) — that room is left unassigned until someone decides.`);
      }
      unmatched.push(roomName);
    });

    if (unmatched.length) {
      resolved.scope_unassigned = true;
      add('warning', 'area_unassigned', `${unmatched.join(', ')} ${unmatched.length === 1 ? 'is' : 'are'} not in the room register of ${location.villa_code} — imported unassigned and listed in Needs Attention.`);
    }
  }

  if (location) {
    const described = describeScope({
      scope_type: resolved.scope_hint,
      area_ids: resolved.area_ids,
      floor_id: resolved.floor_id,
      location_id: location.id,
      areas: villaRooms,
      floors: villaFloors,
    });
    resolved.area_ids = described.area_ids;
    resolved.floor_id = described.floor_id || resolved.floor_id;
    resolved.area_label = described.area_label;
    resolved.scope_type = described.scope_type;
    // A villa row is never silently site-wide: an unregistered floor or room
    // stays an entire-villa row and is reported instead.
    if (resolved.scope_type === 'Site-wide') resolved.scope_type = 'Entire Villa';
  } else {
    resolved.scope_type = 'Site-wide';
  }

  /* contractor ---------------------------------------------------------- */
  const contractorText = cleanText(values.contractor);
  if (override.contractor_id) {
    const forced = ctx.contractors.find((c) => c.id === cleanText(override.contractor_id)) || null;
    if (!forced) add('error', 'contractor_unknown', 'The chosen contractor no longer exists.');
    else {
      resolved.contractor_id = forced.id;
      resolved.contractor_name = forced.name;
      resolved.contractor_source = 'row';
    }
  } else if (contractorText) {
    const found = resolveContractor(contractorText, ctx);
    if (found.contractor) {
      resolved.contractor_id = found.contractor.id;
      resolved.contractor_name = found.contractor.name;
      resolved.contractor_source = 'row';
      if (found.via === 'partial') add('warning', 'contractor_matched', `Contractor “${contractorText}” was matched to ${found.contractor.name}.`);
      if (found.contractor.active === false) add('warning', 'contractor_inactive', `${found.contractor.name} is marked inactive.`);
    } else if (found.ambiguous) add('error', 'contractor_ambiguous', found.error);
    else add('error', 'contractor_unknown', found.error);
  } else if (resolved.discipline) {
    const defaultId = defaultContractorId(ctx.defaults, resolved.phase_id, resolved.discipline);
    const contractor = defaultId ? ctx.contractors.find((c) => c.id === defaultId) || null : null;
    if (contractor) {
      resolved.contractor_id = contractor.id;
      resolved.contractor_name = contractor.name;
      resolved.contractor_source = 'default';
    } else {
      add('warning', 'contractor_no_default', `No default contractor is configured for ${resolved.discipline_name || resolved.discipline} in ${resolved.phase_label} — left blank.`);
    }
  }

  /* status, priority ---------------------------------------------------- */
  const statusMatch = matchEnum(values.status, STATUS_VALUES, 'status');
  if (statusMatch.error) add('error', 'status_unknown', statusMatch.error);
  else if (statusMatch.value) resolved.status_value = statusMatch.value;

  const priorityMatch = matchEnum(values.priority, PRIORITY_VALUES, 'priority');
  if (priorityMatch.error) add('error', 'priority_unknown', priorityMatch.error);
  else if (priorityMatch.value) resolved.priority_value = priorityMatch.value;

  /* dates --------------------------------------------------------------- */
  const readDate = (field, raw) => {
    const parsed = parseImportDate(raw);
    if (parsed.error) add('error', `${field}_unreadable`, parsed.error);
    return parsed.value;
  };
  resolved.baseline_start = readDate('baseline_start', values.baseline_start);
  resolved.baseline_finish = readDate('baseline_finish', values.baseline_finish);
  resolved.current_forecast_finish = readDate('current_forecast_finish', values.current_forecast_finish);

  if (resolved.baseline_start && resolved.baseline_finish && resolved.baseline_finish < resolved.baseline_start) {
    add('warning', 'dates_order', 'The baseline finish is before the baseline start.');
  }
  if (resolved.baseline_start && resolved.current_forecast_finish && resolved.current_forecast_finish < resolved.baseline_start) {
    add('warning', 'forecast_order', 'The forecast finish is before the baseline start.');
  }

  /* progress, man-hours ------------------------------------------------- */
  const progress = parseImportNumber(values.progress_percent, { min: 0, max: 100 });
  if (progress.error) add('error', 'progress_invalid', `Progress: ${progress.error}`);
  else resolved.progress_percent = progress.value;

  /* quantity, unit, acceptance criterion -------------------------------- */
  const quantity = parseImportNumber(values.planned_quantity, { min: 0 });
  if (quantity.error) add('error', 'quantity_invalid', `Quantity: ${quantity.error}`);
  else if (quantity.value !== null && quantity.value !== undefined) resolved.planned_quantity = quantity.value;

  const unitText = cleanText(values.measurement_unit);
  if (unitText) {
    const hit = UNIT_VALUES.find((unit) => looseKey(unit) === looseKey(unitText));
    if (hit) resolved.measurement_unit = hit;
    else {
      resolved.measurement_unit = unitText;
      add('warning', 'unit_nonstandard', `Unit “${unitText}” is not one of the standard units — it is imported as written.`);
    }
  }
  resolved.acceptance_criterion = cleanText(values.acceptance_criterion) || null;

  const manhours = parseImportNumber(values.estimated_manhours, { min: 0 });
  if (manhours.error) add('error', 'manhours_invalid', `Estimated man-hours: ${manhours.error}`);
  else resolved.estimated_manhours = manhours.value;

  /* site conditions worth flagging -------------------------------------- */
  if (location && location.active_status === 'On Hold') {
    add('warning', 'villa_on_hold', `${location.villa_code} is on hold — confirm work here is intended.`);
  }
  if (cleanText(values.blocker_description) && resolved.status_value !== 'Blocked') {
    add('warning', 'blocker_status', 'A blocker is described but the status is not Blocked.');
  }

  const blocking = issues.some((issue) => issue.severity === 'error');
  const duplicate = blocking ? null : detectDuplicate({ rowNumber: row.row_number, fileName: override.__file_name || '', values, resolved, ctx });
  const status = blocking ? 'invalid' : duplicate ? 'duplicate' : 'valid';

  return {
    row_number: row.row_number,
    values,
    resolved,
    issues,
    blocking,
    duplicate,
    status,
    task: blocking ? null : buildTaskPayload({ values, resolved }),
  };
}

/**
 * The same work listed twice inside one file — the usual consolidation slip.
 * The later row is offered as a duplicate (skip it, or import it deliberately),
 * and the earlier row carries a caution so the pair is visible.
 */
function flagInFileDuplicates(results) {
  const seen = new Map();
  results.forEach((row) => {
    if (row.blocking) return;
    const sourceKey = looseKey(row.values.source_reference);
    const nameKey = looseKey(row.resolved.name);
    const names = [
      sourceKey ? `source:${sourceKey}` : '',
      nameKey && row.resolved.discipline
        ? `work:${row.resolved.location_id || 'site'}|${row.resolved.discipline}|${scopeKeyOf({ area_ids: row.resolved.area_ids, floor_id: row.resolved.floor_id })}|${nameKey}`
        : '',
    ].filter(Boolean);
    if (!names.length) return;

    // Either the same source reference or the same work in the same villa —
    // the later row is the one that needs a decision.
    const first = names.map((name) => seen.get(name)).find(Boolean);
    if (!first) {
      names.forEach((name) => seen.set(name, row));
      return;
    }
    names.forEach((name) => {
      if (!seen.has(name)) seen.set(name, row);
    });

    row.issues.push({
      severity: 'warning',
      code: 'duplicate_in_file',
      message: `Row ${first.row_number} of this file describes the same work.`,
    });
    if (!row.duplicate || row.duplicate.confidence !== 'confident') {
      row.duplicate = {
        task_id: '',
        task_ref: `row ${first.row_number}`,
        name: row.resolved.name,
        status: '',
        archived: false,
        location: row.resolved.villa_code || 'Site-wide',
        confidence: 'confident',
        reason: `The same work as row ${first.row_number} of this file`,
        can_link: false,
        others: [],
        in_file: true,
      };
    }
    first.issues.push({
      severity: 'warning',
      code: 'repeated_in_file',
      message: `Row ${row.row_number} of this file repeats this work.`,
    });
  });
  return results;
}

export function validateImportRows({ rows, ctx, overrides = {}, fileName = '' }) {
  const withFile = {};
  Object.keys(overrides || {}).forEach((key) => {
    withFile[key] = { ...(overrides[key] || {}), __file_name: fileName };
  });
  (rows || []).forEach((row) => {
    if (!withFile[row.row_number]) withFile[row.row_number] = { __file_name: fileName };
  });

  const results = (rows || []).map((row) => validateOneRow(row, ctx, withFile[row.row_number] || {}));
  flagInFileDuplicates(results);
  results.forEach((row) => {
    row.status = row.blocking ? 'invalid' : row.duplicate ? 'duplicate' : 'valid';
  });
  const has = (code) => (row) => row.issues.some((issue) => issue.code === code);

  const summary = {
    total: results.length,
    valid: results.filter((r) => r.status === 'valid').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    ambiguous_locations: results.filter((r) => r.resolved.location_state === 'ambiguous').length,
    unmatched_villas: results.filter((r) => r.resolved.location_state === 'unknown').length,
    unmatched_contractors: results.filter((r) => has('contractor_unknown')(r) || has('contractor_ambiguous')(r)).length,
    missing_disciplines: results.filter((r) => has('discipline_blank')(r)).length,
    unknown_disciplines: results.filter((r) => has('discipline_unknown')(r)).length,
    without_contractor: results.filter((r) => !r.resolved.contractor_id).length,
    warnings: results.filter((r) => r.issues.some((issue) => issue.severity === 'warning')).length,
    blocking: results.filter((r) => r.blocking).length,
  };

  return { rows: results, summary };
}

/** Missing information on a row that will still be imported. */
export function missingInfoFor(result) {
  const missing = [];
  if (!result.resolved.contractor_id) missing.push('Contractor');
  if (!result.resolved.baseline_start) missing.push('Baseline start');
  if (!result.resolved.baseline_finish) missing.push('Baseline finish');
  if (result.resolved.progress_percent === null) missing.push('Progress');
  if (result.resolved.scope_unassigned) missing.push('Room/area not in the register');
  return missing;
}