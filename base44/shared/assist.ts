/**
 * The AI site assistant's understanding, without a model.
 *
 * Everything here is deterministic: the message is read by rule, the villa is
 * resolved against the stored Location records, the rooms against the room
 * register, and the tasks against the register — then the result is presented as
 * a proposal for a human to review. Nothing in this module writes to a record.
 *
 * The model, when it is configured and permitted, only ever refines this
 * reading: it may choose between candidates that this module produced and tidy
 * the wording. It can never introduce a villa, a task, a status or a number that
 * the rules did not already allow, so the assistant behaves identically when the
 * provider is unavailable — and a missing key or an exhausted quota never
 * produces a fabricated answer.
 */

import { isOutstanding, toDay } from './dashboardCore.ts';
import { lifecycleOf, readinessOf } from './attention.ts';
import { buildVillaIndex, cleanText, looseKey, resolveVillaReferences } from './villaResolve.ts';
import { describeScope, matchAreas, scopeSummary } from './villaAreas.ts';

export const ASSIST_INTENTS = [
  'update_progress', 'create_tasks', 'raise_snag', 'link_dependency', 'query', 'daily_brief', 'meeting_brief', 'unknown',
];

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
};

const STATUS_WORDS = [
  { match: /\b(not started|yet to start|not yet started)\b/i, value: 'Not Started' },
  { match: /\b(in progress|under progress|ongoing|started|working on)\b/i, value: 'In Progress' },
  { match: /\b(execution complete|completed|complete|done|finished|painted|installed|cast|casted|plastered|tiled|laid|wired|fixed)\b/i, value: 'Execution Complete' },
  { match: /\b(under inspection|for inspection|inspection pending|awaiting inspection)\b/i, value: 'Under Inspection' },
  { match: /\b(approved|verified)\b/i, value: 'Approved' },
  { match: /\b(closed|handed over|handover done)\b/i, value: 'Closed' },
  { match: /\b(blocked|stopped|stuck|held up|not available|not cooling|not working|leaking)\b/i, value: 'Blocked' },
];

const SITE_AREAS = ['main gate', 'stp', 'internal road', 'compound wall', 'clubhouse', 'common area', 'infrastructure', 'landscape', 'site office'];

/* ------------------------------------------------------------------- language */

export const parseManpower = (text) => {
  const match = String(text).match(
    /(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\s*(?:nos\.?|no\.?|numbers?)?\s*(?:of\s*)?(workers?|worker|men|man|persons?|person|people|labour|labourers?|masons?|helpers?|carpenters?|painters?|electricians?|plumbers?)/i,
  );
  if (!match) return null;
  const value = WORD_NUMBERS[String(match[1]).toLowerCase()] ?? Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value > 5000) return null;
  return { total: Math.round(value), group: String(match[2] || '').toLowerCase() };
};

export const parsePercent = (text) => {
  const match = String(text).match(/(\d{1,3}(?:\.\d)?)\s*(?:%|per cent|percent)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value * 10) / 10 : null;
};

export const parseStatusWord = (text) => {
  const hit = STATUS_WORDS.find((entry) => entry.match.test(String(text)));
  return hit ? hit.value : '';
};

export const parseQuantity = (text) => {
  const match = String(text).match(/(\d{1,7}(?:\.\d+)?)\s*(sqm|sq\.?m|sqft|sq\.?ft|rmt|r\.?m|nos|cum|kg|litre|litres|ltr)/i);
  if (!match) return null;
  const unit = String(match[2]).toLowerCase().replace(/[.\s]/g, '');
  const map = { sqm: 'Sqm', sqft: 'Sqft', rmt: 'Rmt', nos: 'Nos', cum: 'Cum', kg: 'Kg', litre: 'Litre', litres: 'Litre', ltr: 'Litre' };
  return { value: Number(match[1]), unit: map[unit] || '' };
};

/** A date the message states: "today", "yesterday", "12-Oct-26". Never invented for a blank message. */
export const parseDates = (text, asOf) => {
  const raw = String(text);
  if (/\btoday\b|\bthis evening\b|\bthis morning\b/i.test(raw)) return { update_date: asOf, via: 'stated as today' };
  if (/\byesterday\b/i.test(raw)) {
    const base = Date.parse(`${asOf}T00:00:00Z`);
    return { update_date: new Date(base - 86400000).toISOString().slice(0, 10), via: 'stated as yesterday' };
  }
  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return { update_date: iso[1], via: 'stated date' };
  const forecast = raw.match(/\b(?:finish|complete|by|target|forecast)\s*(?:on|by)?\s*(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.]*(\d{2,4})/i);
  if (forecast) {
    const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const month = months[String(forecast[2]).slice(0, 3).toLowerCase()];
    if (month) {
      const year = String(forecast[3]).length <= 2 ? 2000 + Number(forecast[3]) : Number(forecast[3]);
      const iso2 = `${year}-${String(month).padStart(2, '0')}-${String(forecast[1]).padStart(2, '0')}`;
      return { forecast_finish: iso2, via: 'stated forecast finish' };
    }
  }
  return { update_date: asOf, via: 'no date stated — the work date defaults to today' };
};

export function detectIntent(text) {
  const raw = String(text || '');
  const has = (pattern) => pattern.test(raw);

  if (has(/\b(daily brief|daily summary|morning brief|end of day summary)\b/i)) return { intent: 'daily_brief', evidence: 'asked for the daily brief' };
  if (has(/\b(meeting brief|meeting report|prepare.*meeting|meeting with)\b/i)) return { intent: 'meeting_brief', evidence: 'asked for a meeting brief' };

  const writeVerb = has(/\b(create|add|raise|open|make|set up|new)\b/i);
  const taskNoun = has(/\b(tasks?|work items?|inspection|check|activity|activities)\b/i);
  if (writeVerb && taskNoun) return { intent: 'create_tasks', evidence: 'asked to create work' };

  if (has(/\b(blocking|blocks|blocked by|is holding up|holding up|held up by|depends on|dependency|waiting on|waiting for|prerequisite)\b/i)) {
    return { intent: 'link_dependency', evidence: 'recorded as a dependency between two works' };
  }
  if (has(/\b(snag|defect|damage|broken|crack(?:ed|s|ing)?|leak(?:ing|s)?|not cooling|not working|not functioning|rework|rectif\w*|repair|seepage|damp)\b/i)) {
    return { intent: 'raise_snag', evidence: 'described a defect to be rectified' };
  }
  if (has(/^\s*(show|list|what|which|how many|tell me|give me|where|who|summar\w*|report on|status of)\b/i) || has(/\b(pending|outstanding|overdue|due today)\b/i)) {
    return { intent: 'query', evidence: 'asked a question about the register' };
  }
  if (has(/\b(completed|complete|done|finished|painted|installed|cast|plastered|tiled|laid|wired|started|in progress|progress|manpower|workers?|labour|masons?|handed over)\b/i)) {
    return { intent: 'update_progress', evidence: 'reported progress on site' };
  }
  return { intent: 'unknown', evidence: 'no site action was recognised in the words' };
}

/** The work itself, with the villa phrases, verbs and dates taken out. */
export function cleanSubject(text) {
  let out = String(text || '')
    .replace(/\b(create|add|raise|open|make|set up|new)\b/gi, ' ')
    .replace(/\b(tasks?|work items?|activities|activity)\b/gi, ' ')
    .replace(/\b(for|to|in|at|on|the|please|kindly)\b/gi, ' ')
    .replace(/\b(villas?|plots?|units?|houses?)\s*(?:no\.?|number|#)?\s*[-#]?\s*\d{1,3}[a-z]?\s*((?:,|and|&|\+|\/)\s*(?:villas?|plots?|units?|houses?)?\s*(?:no\.?|number|#)?\s*[-#]?\s*\d{1,3}[a-z]?\s*)*/gi, ' ')
    .replace(/\b(phase|ph)\s*[-\s]?[ab]\b/gi, ' ')
    .replace(/\b(today|yesterday|this morning|this evening|tomorrow)\b/gi, ' ')
    .replace(/\b\d{1,3}\s*(?:%|per cent|percent)\b/gi, ' ')
    .replace(/\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\s*(?:nos\.?|no\.?|numbers?)?\s*(?:of\s*)?(workers?|men|man|persons?|person|people|labour|labourers?|masons?|helpers?)\b/gi, ' ')
    .replace(/[.]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  out = out.replace(/^\W+|\W+$/g, '');
  if (!out) out = 'Work reported from site';
  const sentence = out.split(/[.;]/)[0].trim();
  const capped = sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

/** The discipline the words name, matched against the company list. */
export function matchDiscipline(text, disciplines = []) {
  const hay = looseKey(text);
  if (!hay) return { code: '', name: '' };
  const hits = (disciplines || []).filter((discipline) => {
    const code = looseKey(discipline.code);
    const name = looseKey(discipline.name);
    return (name.length >= 4 && hay.includes(name)) || (code.length >= 3 && new RegExp(`\\b${code}\\b`, 'i').test(hay));
  });
  if (hits.length === 1) return { code: hits[0].code, name: hits[0].name };
  if (hits.length > 1) return { code: '', name: '', ambiguous: hits };
  return { code: '', name: '' };
}

export const matchWorkPackage = (text, packages = []) => {
  const hay = looseKey(text);
  const hit = (packages || []).find((item) => {
    const name = looseKey(item.package_name);
    return name.length >= 4 && hay.includes(name);
  });
  return hit ? hit.package_name : '';
};

/** A person named in the words, matched against contractors and recorded engineers. */
export function matchPerson(text, { contractors = [], tasks = [] } = {}) {
  const hay = looseKey(text);
  if (!hay) return null;
  const people = [];
  (contractors || []).forEach((contractor) => {
    const words = String(contractor.name || '').split(/\s+/).filter((word) => word.length >= 3);
    words.forEach((word) => {
      if (hay.includes(looseKey(word))) people.push({ type: 'contractor', id: contractor.id, name: contractor.name, via: word });
    });
  });
  const engineers = new Set((tasks || []).map((task) => cleanText(task.responsible_engineer)).filter(Boolean));
  engineers.forEach((name) => {
    const words = String(name).split(/\s+/).filter((word) => word.length >= 3);
    words.forEach((word) => {
      if (hay.includes(looseKey(word))) people.push({ type: 'engineer', id: '', name, via: word });
    });
  });
  return people[0] || null;
}

/* ------------------------------------------------------------------ the work */

const taskMatchesWords = (task, text) => {
  const hay = looseKey(text);
  if (!hay) return false;
  const parts = [task.name, task.work_package, task.discipline, task.description]
    .map((value) => looseKey(value))
    .filter((value) => value && value.length >= 3);
  return parts.some((value) => hay.includes(value) || value.split(/(?=[a-z])/).filter((word) => word.length >= 4).some((word) => hay.includes(word)));
};

const taskRowFor = (task, { ix, asOf, dependencies, tasksById }) => ({
  task_id: task.id,
  ref: task.task_ref || '',
  name: task.name || '',
  villa: task.location_id ? ix.villaCode(task.location_id) : 'Site-wide',
  scope: task.scope_type || (task.location_id ? 'Entire Villa' : 'Site-wide'),
  area_label: task.area_label || '',
  discipline: task.discipline || '',
  discipline_name: ix.disciplineName(task.discipline),
  contractor: ix.contractorName(task.contractor_id) || '',
  engineer: task.responsible_engineer || '',
  status: task.status || '',
  stage: lifecycleOf(task).stage,
  readiness: readinessOf(task, { dependencies, tasksById }).state,
  progress: typeof task.progress_percent === 'number' ? task.progress_percent : null,
  finish: toDay(task.current_forecast_finish) || toDay(task.baseline_finish),
  finish_source: task.current_forecast_finish ? 'Forecast' : task.baseline_finish ? 'Baseline' : '',
});

const previousOf = (task, ix) => [
  { label: 'Status', value: task.status || 'Not Started' },
  { label: 'Progress', value: typeof task.progress_percent === 'number' ? `${task.progress_percent}%` : 'Not measured' },
  { label: 'Forecast finish', value: toDay(task.current_forecast_finish) || 'Not set' },
  { label: 'Manpower last reported', value: task.actual_manpower ?? 'Not reported' },
  { label: 'Contractor', value: ix.contractorName(task.contractor_id) || 'Unassigned' },
  { label: 'Responsible engineer', value: task.responsible_engineer || 'Not recorded' },
];

const reviewBase = ({ project, phase, villa, ix, areaContext, task, proposed, extra = {}, dependencies = [], tasksById = new Map() }) => ({
  project: project?.name || '',
  phase: phase?.name || (phase ? '' : 'All phases'),
  villa: villa ? villa.villa_code : 'Site-wide',
  villa_id: villa?.id || '',
  villa_type: villa?.location_type || '',
  floor: areaContext?.floor?.floor_name || '',
  area: (areaContext?.areas || []).map((area) => area.area_name).join(', '),
  scope_type: areaContext?.scope_type || '',
  scope_label: areaContext?.scope_label || '',
  task_id: task?.id || '',
  task_ref: task?.task_ref || '',
  task_name: task?.name || '',
  task_status: task?.status || '',
  is_new: !task,
  discipline: proposed.discipline || task?.discipline || '',
  discipline_name: ix.disciplineName(proposed.discipline || task?.discipline || ''),
  contractor: proposed.contractor || ix.contractorName(task?.contractor_id) || 'Unassigned',
  engineer: proposed.engineer || task?.responsible_engineer || 'Not recorded',
  previous: task ? previousOf(task, ix) : [],
  proposed: proposed.rows || [],
  dates: proposed.dates || [],
  progress: proposed.progress ?? null,
  manpower: proposed.manpower ?? null,
  blocker: proposed.blocker || '',
  dependency: proposed.dependency || '',
  readiness: task ? readinessOf(task, { dependencies, tasksById }).state : '',
  note: proposed.note || '',
  ...extra,
});

/**
 * The proposal for one message. `data` is the permission-scoped project data
 * the caller already loaded; nothing else is read.
 */
export function buildProposal({ text, data, scope, asOf, options = {} }) {
  const message = cleanText(text).slice(0, 1200);
  const { intent, evidence } = detectIntent(message);
  const ix = data.ix;
  const tasksById = new Map((data.tasks || []).map((task) => [task.id, task]));
  const project = (data.projects || []).find((item) => item.id === scope.projectId) || null;
  const phases = (data.phases || []).filter((phase) => phase.project_id === scope.projectId);
  const phase = phases.find((item) => item.id === scope.phaseId) || null;
  const locations = (data.locations || []).filter((location) => location.project_id === scope.projectId);
  const index = buildVillaIndex(locations);
  const areaContext = { areas: data.areas || [], floors: data.floors || [] };

  const tasksInScope = (data.tasks || []).filter((task) => {
    if (task.project_id !== scope.projectId || task.archived === true || task.is_villa_work_parent === true) return false;
    if (scope.phaseId && task.phase_id !== scope.phaseId) return false;
    if (options.includeDemo !== true && task.is_demo === true) return false;
    return true;
  });

  const resolved = resolveVillaReferences(message, index, {
    phaseId: scope.phaseId || '',
    phases,
    phaseCode: phase?.code || '',
  });

  const notes = [];
  const questions = [];
  const actions = [];
  // Tasks offered for selection when the words are not specific enough to
  // choose between them — the choice is the user's, never a guess.
  const candidateRows = [];

  if (resolved.phaseHint && !scope.phaseId && phase?.id !== resolved.phaseHint) {
    const hinted = phases.find((item) => item.id === resolved.phaseHint);
    if (hinted) notes.push(`The words name ${hinted.name}, so that phase was used to read the villa references.`);
  }
  if (!scope.phaseId && !resolved.phaseHint && resolved.resolved.length) {
    notes.push('No phase was selected, so each villa reference was read against the whole project. Select a phase to be asked less often.');
  }

  resolved.ambiguous.forEach((item) => {
    questions.push(
      `${item.reference} could be ${item.candidates.map((candidate) => candidate.villa_code).join(' or ')} — state which physical villa is meant.`,
    );
  });
  resolved.unknown.forEach((reference) => {
    questions.push(`${reference} is not in the register. Add the villa before work is written against it.`);
  });

  if (intent === 'daily_brief' || intent === 'meeting_brief') {
    const person = matchPerson(message, { contractors: data.contractors, tasks: tasksInScope });
    const contractorId = person?.type === 'contractor' ? person.id : '';
    return {
      intent,
      source: 'deterministic',
      evidence,
      route: intent,
      contractor_id: contractorId,
      contractor_name: person?.name || '',
      actions: [],
      questions: intent === 'meeting_brief' && !contractorId ? ['Name the contractor for the meeting brief.'] : [],
      notes: ['This is handed to the brief generator, which reads the same records as the dashboards.'],
      villas: [],
      data_date: asOf,
    };
  }

  /* ---------------------------------------------------------------- queries */
  if (intent === 'query') {
    const person = matchPerson(message, { contractors: data.contractors, tasks: tasksInScope });
    const discipline = matchDiscipline(message, data.disciplines);
    const villaIds = new Set(resolved.resolved.map((item) => item.location.id));
    const wantsPending = /\b(pending|outstanding|open|overdue|not closed|remaining)\b/i.test(message);

    let rows = tasksInScope.filter((task) => (wantsPending ? isOutstanding(task) : true));
    if (person) {
      rows = rows.filter((task) =>
        (person.type === 'contractor' ? task.contractor_id === person.id : looseKey(task.responsible_engineer).includes(looseKey(person.name))));
    }
    if (discipline.code) rows = rows.filter((task) => task.discipline === discipline.code);
    if (villaIds.size) rows = rows.filter((task) => villaIds.has(task.location_id));

    const limit = Math.min(Math.max(Number(options.itemLimit) || 40, 5), 200);
    const filters = [
      wantsPending ? 'open work only' : 'all work',
      person ? `${person.type === 'contractor' ? 'contractor' : 'engineer'} ${person.name}` : '',
      discipline.code ? `discipline ${discipline.name || discipline.code}` : '',
      villaIds.size ? `villa ${[...villaIds].map((id) => ix.villaCode(id)).join(', ')}` : '',
    ].filter(Boolean);

    return {
      intent,
      source: 'deterministic',
      evidence,
      result: {
        title: `${rows.length} record${rows.length === 1 ? '' : 's'} — ${filters.join(' · ')}`,
        note: 'Read from the register by rule. This is a record lookup, not a model interpretation; ask DVG AI for an explanation of the figures.',
        rows: rows.slice(0, limit).map((task) => taskRowFor(task, { ix, asOf, dependencies: data.dependencies, tasksById })),
        truncated: rows.length > limit,
      },
      actions: [],
      questions: rows.length ? [] : ['No record in this scope matches that question. Widen the phase, or check the name.'],
      notes: [],
      villas: resolved.resolved.map((item) => ({ id: item.location.id, code: item.location.villa_code, via: item.via })),
      data_date: asOf,
    };
  }

  const villas = resolved.resolved.map((item) => item.location);

  /* ------------------------------------------------------- villa-level scope */
  const scopeFor = (villa) => {
    const areas = (data.areas || []).filter((area) => area.location_id === villa.id && area.active !== false);
    const floors = (data.floors || []).filter((floor) => floor.location_id === villa.id && floor.active !== false);
    const match = matchAreas({ text: message, areas, floors });
    if (match.floorAmbiguous) {
      questions.push(`Two floors match in ${villa.villa_code} (${match.floorAmbiguous.map((floor) => floor.floor_name).join(', ')}) — state which one.`);
    }
    if (match.ambiguous) {
      questions.push(`${villa.villa_code} has more than one area called “${match.ambiguous.name}” — state which one.`);
    }
    const unresolved = areas.length ? match.unresolved : [];
    if (!areas.length && match.unresolved.length) {
      questions.push(`${villa.villa_code} has no rooms registered yet, so “${match.unresolved[0]}” cannot be matched. Register the room, or record the work against the whole villa.`);
    } else if (unresolved.length) {
      questions.push(`“${unresolved[0]}” is not a registered room of ${villa.villa_code} — register it or state the correct room.`);
    }
    const described = describeScope({
      area_ids: match.areas.map((area) => area.id),
      floor_id: match.floor?.id || '',
      location_id: villa.id,
      areas,
      floors,
    });
    return {
      villa,
      areas,
      floors,
      match,
      unresolvedRoom: match.unresolved.length > 0,
      described,
      scope_type: described.scope_type,
      scope_label: scopeSummary({
        scope_type: described.scope_type,
        area_label: described.area_label,
        areas: described.areas,
        floor: described.floor,
        villa: villa.villa_code,
      }),
    };
  };

  const taskPool = (villaScope) => {
    const pool = tasksInScope.filter((task) => task.location_id === villaScope.villa.id && isOutstanding(task));
    const areaIds = (villaScope.described.area_ids || []);
    if (!areaIds.length) return pool;
    const byArea = pool.filter((task) => (task.area_ids || []).some((id) => areaIds.includes(id)));
    return byArea.length ? byArea : pool;
  };

  const rank = Number.isFinite(options.rank) ? options.rank : 0;
  const mayCreate = rank >= 1;

  /* -------------------------------------------------- progress / task update */
  if (intent === 'update_progress' || (intent === 'unknown' && villas.length)) {
    const status = parseStatusWord(message);
    const percent = parsePercent(message);
    const manpower = parseManpower(message);
    const quantity = parseQuantity(message);
    const dates = parseDates(message, asOf);
    const forecastGiven = /\b(finish|complete|by|target|forecast|hand over|handover)\b/i.test(message) && dates.forecast_finish;

    villas.forEach((villa) => {
      const villaScope = scopeFor(villa);
      const pool = taskPool(villaScope);
      const named = pool.filter((task) => taskMatchesWords(task, message));
      // A task whose room was named in its source list but never registered is
      // not confirmed whole-villa work: it is never read as one.
      const wholeVilla = pool.filter(
        (task) => task.scope_type === 'Entire Villa' && task.scope_unresolved !== true && taskMatchesWords(task, message),
      );

      let chosen = [];
      let mode = '';
      if (villaScope.unresolvedRoom) {
        // A room was named that the register does not hold. The wording cannot
        // choose the work, so no action is proposed for this villa at all.
        mode = '';
      } else if (villaScope.described.area_ids.length) {
        if (pool.length === 1) {
          chosen = pool;
          mode = 'single';
        } else if (pool.length > 1) {
          chosen = pool;
          mode = 'bulk';
          questions.push(`${villaScope.scope_label} holds ${pool.length} open tasks. Confirm which of them the update covers before anything is written.`);
        }
      } else if (named.length === 1) {
        chosen = named;
        mode = 'single';
      } else if (wholeVilla.length === 1) {
        chosen = wholeVilla;
        mode = 'single';
        notes.push(`Read as the whole-villa task ${wholeVilla[0].task_ref}${wholeVilla[0].task_ref ? '' : ''} — no room was named.`);
      } else if (named.length > 1) {
        questions.push(`More than one open task matches that wording in ${villa.villa_code} — state which one, or name the area.`);
      } else if (pool.length > 1) {
        questions.push(`Which area of ${villa.villa_code} was this about? ${pool.length} open tasks are on the villa and no room was named.`);
      } else if (pool.length === 0) {
        questions.push(`No open task matches that work in ${villa.villa_code}${mayCreate ? ' — create one, or choose the right task.' : '.'}`);
      }

      if (!chosen.length) {
        // Offer the tasks that are on this villa so the right one can be picked,
        // and — when the role allows it — offer to create the work that is not
        // there yet. Neither is written without confirmation.
        pool.slice(0, 8).forEach((task) => {
          if (!candidateRows.some((row) => row.task_id === task.id)) {
            candidateRows.push(taskRowFor(task, { ix, asOf, dependencies: data.dependencies, tasksById }));
          }
        });
        const subject = cleanSubject(message);
        const discipline = matchDiscipline(message, data.disciplines);
        if (mayCreate && discipline.code && !pool.length) {
          actions.push(createTaskAction({
            subject, discipline, villaScope, message, data, ix, project, phase, asOf, notes,
          }));
        }
        return;
      }

      if (mode === 'bulk') {
        notes.push(`${chosen.length} separate tasks in ${villaScope.scope_label} are proposed for the same update — each is confirmed on its own.`);
      }

      const values = {};
      if (status) values.status = status;
      if (percent !== null) values.progress_percent = percent;
      if (forecastGiven) {
        values.current_forecast_finish = dates.forecast_finish;
        values.date_revision_reason = `Site message: ${message.slice(0, 300)}`;
      }
      if (blockerCategoryFor(message)) {
        values.blocker_reported = true;
        values.blocker_category = blockerCategoryFor(message);
        values.blocker_description = message.slice(0, 800);
      }
      if (quantity) values.completed_quantity = quantity.value;

      chosen.forEach((task, position) => {
        const actionId = `a${actions.length + 1}`;
        const payload = {
          task_id: task.id,
          update_date: dates.update_date,
          work_done: message.slice(0, 800),
          ...(status ? { status } : {}),
          ...(percent !== null ? { progress_percent: percent } : {}),
          ...(manpower ? { manpower_items: [{ discipline: ix.disciplineName(task.discipline) || 'Site work', count: manpower.total }] } : {}),
          ...(forecastGiven ? { current_forecast_finish: dates.forecast_finish, date_revision_reason: `Site message: ${message.slice(0, 300)}` } : {}),
          ...(blockerCategoryFor(message)
            ? { blocker_reported: true, blocker_category: blockerCategoryFor(message), blocker_description: message.slice(0, 800) }
            : {}),
        };
        actions.push({
          action_id: actionId,
          type: 'record_progress',
          service: 'dailyUpdate',
          summary: `Record a site report on ${task.task_ref} — ${task.name}`,
          payload,
          guard: { task_id: task.id, updated_date: task.updated_date || '', snapshot: taskRefSnapshot(task) },
          review: reviewBase({
            project,
            phase,
            villa,
            ix,
            areaContext: villaScope.described,
            task,
            proposed: {
              discipline: task.discipline,
              rows: [
                { label: 'Action', value: 'Record a daily site report and move the task' },
                { label: 'Work done', value: message.slice(0, 300) },
                status ? { label: 'Status', value: status } : null,
                percent !== null ? { label: 'Progress', value: `${percent}%` } : null,
                manpower ? { label: 'Manpower', value: `${manpower.total} ${manpower.group || 'persons'}` } : null,
                villaScope.described.area_ids.length ? { label: 'Scope', value: villaScope.scope_label } : null,
              ].filter(Boolean),
              dates: forecastGiven ? [{ label: 'Forecast finish', value: `${toDay(task.current_forecast_finish) || 'Not set'} → ${dates.forecast_finish}`, reason: values.date_revision_reason }] : [],
              progress: percent,
              manpower: manpower?.total ?? null,
              blocker: blockerCategoryFor(message) ? `${blockerCategoryFor(message)} — ${message.slice(0, 200)}` : '',
              note: mode === 'bulk' ? `One of ${chosen.length} tasks proposed for the same update.` : '',
            },
            extra: { bulk: mode === 'bulk', position_in_bulk: position + 1, bulk_size: chosen.length },
          }),
        });
      });
    });
  }

  /* ------------------------------------------------------------ new work */
  if (intent === 'create_tasks') {
    const subject = cleanSubject(message);
    const discipline = matchDiscipline(message, data.disciplines);
    const workPackage = matchWorkPackage(message, data.workPackages);
    const dates = parseDates(message, asOf);

    if (discipline.ambiguous?.length) {
      questions.push(`More than one discipline matches: ${discipline.ambiguous.map((item) => item.name).join(', ')} — state which one.`);
    }
    if (!discipline.code) {
      questions.push(`No discipline is named. State the discipline for “${subject}” before the tasks are created.`);
    }
    if (!villas.length) {
      questions.push('No villa was identified, so no task can be created. State the villa or plot.');
    }

    if (discipline.code && villas.length) {
      villas.forEach((villa) => {
        const villaScope = scopeFor(villa);
        const contract = defaultContractorFor(data.defaults, villaScope.villa.phase_id || phase?.id || '', discipline.code);
        const datesRows = dates.forecast_finish ? [{ label: 'Forecast finish', value: dates.forecast_finish }] : [];
        actions.push({
          action_id: `a${actions.length + 1}`,
          type: 'create_task',
          service: 'taskWrite',
          summary: `Create ${subject} in ${villa.villa_code}${villaScope.described.area_label ? ` — ${villaScope.described.area_label}` : ''}`,
          payload: {
            action: 'create',
            changes: {
              project_id: scope.projectId,
              phase_id: villaScope.villa.phase_id || phase?.id || null,
              location_id: villaScope.villa.id,
              floor_id: villaScope.described.floor_id || null,
              area_ids: villaScope.described.area_ids,
              scope_type: villaScope.described.scope_type,
              discipline: discipline.code,
              work_package: workPackage || null,
              name: subject,
              status: 'Not Started',
              priority: /urgent|critical|immediately/i.test(message) ? 'High' : 'Medium',
              ...(contract ? { contractor_id: contract.id } : {}),
              ...(dates.forecast_finish ? { current_forecast_finish: dates.forecast_finish } : {}),
              remarks: `Raised from a site message: ${message.slice(0, 300)}`,
            },
          },
          guard: { task_id: '', updated_date: '' },
          review: reviewBase({
            project,
            phase: phase || phases.find((item) => item.id === villaScope.villa.phase_id) || null,
            villa,
            ix,
            areaContext: villaScope.described,
            task: null,
            proposed: {
              discipline: discipline.code,
              contractor: contract?.name || '',
              rows: [
                { label: 'Action', value: 'Create a new task' },
                { label: 'Task', value: subject },
                { label: 'Work package', value: workPackage || 'Not stated' },
                { label: 'Priority', value: /urgent|critical|immediately/i.test(message) ? 'High' : 'Medium' },
                { label: 'Contractor', value: contract ? `${contract.name} (project default)` : 'Unassigned — set it on the task' },
                villaScope.described.area_ids.length || villaScope.described.floor_id
                  ? { label: 'Scope', value: villaScope.scope_label }
                  : { label: 'Scope', value: `${villaScope.scope_type} — no floor or room stated` },
              ],
              dates: datesRows,
              note: contract ? 'The contractor is the project default for this discipline and phase; change it if that is wrong.' : 'No default contractor is configured for this discipline, so the task is created unassigned.',
            },
          }),
        });
      });
    }
  }

  /* ------------------------------------------------------------ snagging */
  if (intent === 'raise_snag') {
    const discipline = matchDiscipline(message, data.disciplines);
    const severity = /\bcritical\b/i.test(message) ? 'Critical' : /\bmajor\b|\bserious\b/i.test(message) ? 'Major' : 'Minor';
    const person = matchPerson(message, { contractors: data.contractors, tasks: tasksInScope });

    if (!villas.length && !SITE_AREAS.some((area) => looseKey(message).includes(looseKey(area)))) {
      questions.push('No villa was identified for this defect. State the villa, or say that it is site-wide work.');
    }

    const targets = villas.length ? villas : [null];
    targets.forEach((villa) => {
      const villaScope = villa ? scopeFor(villa) : null;
      const pool = villa ? taskPool(villaScope) : [];
      const linked = pool.filter((task) => taskMatchesWords(task, message));
      const link = linked.length === 1 ? linked[0] : null;
      const siteArea = SITE_AREAS.find((area) => looseKey(message).includes(looseKey(area))) || '';
      const title = cleanSubject(message);
      actions.push({
        action_id: `a${actions.length + 1}`,
        type: 'raise_snag',
        service: 'snagWrite',
        summary: `Raise a snag${villa ? ` in ${villa.villa_code}` : ''}${villaScope?.described.area_label ? ` — ${villaScope.described.area_label}` : ''}: ${title}`,
        payload: {
          action: 'create',
          snag: {
            project_id: scope.projectId,
            phase_id: villa?.phase_id || phase?.id || null,
            location_id: villa?.id || null,
            floor_id: villaScope?.described.floor_id || null,
            area_ids: villaScope?.described.area_ids || [],
            task_id: link?.id || null,
            title,
            description: message.slice(0, 2000),
            discipline: discipline.code || link?.discipline || null,
            severity,
            status: 'Open',
            raised_date: asOf,
            handover_blocker: /\bhandover\b|\bhand over\b/i.test(message),
            notes: [
              siteArea ? `Site area: ${siteArea}` : '',
              person ? `${person.name} is named in the message${person.type === 'contractor' ? ' (contractor on record)' : ' (engineer on record)'} — assign the responsible party.` : '',
            ].filter(Boolean).join(' · '),
          },
        },
        guard: { task_id: '', updated_date: '' },
        review: reviewBase({
          project,
          phase: phase || (villa ? phases.find((item) => item.id === villa.phase_id) : null),
          villa,
          ix,
          areaContext: villaScope?.described || null,
          task: link,
          proposed: {
            discipline: discipline.code || link?.discipline || '',
            rows: [
              { label: 'Action', value: 'Raise a snag (a separate defect record — it never changes a task status)' },
              { label: 'Snag', value: title },
              { label: 'Severity', value: severity },
              { label: 'Linked task', value: link ? `${link.task_ref} — ${link.name}` : 'Not linked: no single open task matches' },
              siteArea ? { label: 'Site area', value: siteArea } : null,
              person ? { label: 'Named in the message', value: person.name } : null,
            ].filter(Boolean),
          },
          extra: { area_label_preview: villaScope?.described.area_label || '' },
        }),
      });
    });
  }

  /* -------------------------------------------------------- dependencies */
  if (intent === 'link_dependency') {
    const split = message.split(/\b(?:is\s+)?(?:blocking|blocks|blocked by|is holding up|holding up|held up by|depends on|waiting on|waiting for)\b/i);
    const left = split[0] || '';
    const right = split.slice(1).join(' ') || '';
    const villa = villas[0] || null;
    const villaScope = villa ? scopeFor(villa) : null;
    const pool = villa ? taskPool(villaScope) : tasksInScope.filter(isOutstanding);

    const before = pool.filter((task) => taskMatchesWords(task, left));
    const after = pool.filter((task) => taskMatchesWords(task, right));

    if (before.length !== 1 || after.length !== 1) {
      if (before.length === 0) questions.push(`No open task in ${villa ? villa.villa_code : 'this scope'} matches the work named as blocking.`);
      if (before.length > 1) questions.push(`${before.length} tasks match the blocking work (${before.map((task) => task.task_ref).join(', ')}) — state which one.`);
      if (after.length === 0) questions.push('No open task matches the work being blocked.');
      if (after.length > 1) questions.push(`${after.length} tasks match the work being blocked (${after.map((task) => task.task_ref).join(', ')}) — state which one.`);
    } else {
      const [predecessor] = before;
      const [successor] = after;
      actions.push({
        action_id: `a${actions.length + 1}`,
        type: 'link_dependency',
        service: 'saveRecord',
        summary: `Record ${predecessor.task_ref} blocking ${successor.task_ref} (Finish to Start)`,
        payload: {
          action: 'create',
          entity: 'TaskDependency',
          data: {
            project_id: scope.projectId,
            predecessor_task_id: predecessor.id,
            successor_task_id: successor.id,
            dependency_type: 'Finish to Start',
            lag_days: 0,
            active: true,
            notes: `Recorded from a site message: ${message.slice(0, 300)}`,
          },
        },
        guard: { task_id: successor.id, updated_date: successor.updated_date || '' },
        review: reviewBase({
          project,
          phase,
          villa,
          ix,
          areaContext: villaScope?.described || null,
          task: successor,
          proposed: {
            discipline: successor.discipline,
            rows: [
              { label: 'Action', value: 'Record a dependency link' },
              { label: 'Predecessor', value: `${predecessor.task_ref} — ${predecessor.name} (${predecessor.status})` },
              { label: 'Successor', value: `${successor.task_ref} — ${successor.name} (${successor.status})` },
              { label: 'Type', value: 'Finish to Start, no lag' },
            ],
            dependency: `${predecessor.task_ref} → ${successor.task_ref}`,
            note: 'Only recorded links change what the blocker board reports. Nothing is inferred from wording alone.',
          },
        }),
      });
    }
  }

  if (!actions.length && !questions.length) {
    questions.push('Nothing in that message could be turned into a record. Say what happened, where, and whether work finished — or ask a question about the register.');
  }

  const readyActions = actions.map((action) =>
    action.review?.task_id && !action.review.readiness
      ? {
          ...action,
          review: {
            ...action.review,
            readiness: readinessOf(tasksById.get(action.review.task_id), { dependencies: data.dependencies, tasksById }).state,
          },
        }
      : action);

  return {
    intent,
    source: 'deterministic',
    evidence,
    actions: readyActions,
    questions,
    notes,
    villas: villas.map((villa) => ({ id: villa.id, code: villa.villa_code, phase: ix.phaseName(villa.phase_id), via: 'records' })),
    candidates: candidateRows,
    data_date: asOf,
  };
}

function createTaskAction({ subject, discipline, villaScope, message, data, ix, project, phase, asOf, notes }) {
  const contract = defaultContractorFor(data.defaults, villaScope.villa.phase_id || phase?.id || '', discipline.code);
  notes.push('No existing task matched, so a new task is proposed. Confirm the wording before it is created.');
  return {
    action_id: 'a1',
    type: 'create_task',
    service: 'taskWrite',
    summary: `Create ${subject} in ${villaScope.villa.villa_code}`,
    payload: {
      action: 'create',
      changes: {
        project_id: project?.id,
        phase_id: villaScope.villa.phase_id || phase?.id || null,
        location_id: villaScope.villa.id,
        floor_id: villaScope.described.floor_id || null,
        area_ids: villaScope.described.area_ids,
        scope_type: villaScope.described.scope_type,
        discipline: discipline.code,
        work_package: matchWorkPackage(message, data.workPackages) || null,
        name: subject,
        status: 'Not Started',
        priority: 'Medium',
        ...(contract ? { contractor_id: contract.id } : {}),
        remarks: `Raised from a site message: ${message.slice(0, 300)}`,
      },
    },
    guard: { task_id: '', updated_date: '' },
    review: reviewBase({
      project,
      phase: phase || null,
      villa: villaScope.villa,
      ix,
      areaContext: villaScope.described,
      task: null,
      proposed: {
        discipline: discipline.code,
        contractor: contract?.name || '',
        rows: [
          { label: 'Action', value: 'Create a new task (no existing task matched the words)' },
          { label: 'Task', value: subject },
          { label: 'Discipline', value: ix.disciplineName(discipline.code) },
          { label: 'Contractor', value: contract ? `${contract.name} (project default)` : 'Unassigned — set it on the task' },
        ],
        note: 'Created through the normal guarded task path, so it gets its permanent reference and its change trail.',
      },
    }),
  };
}

const BLOCKER_RULES = [
  { category: 'Materials Pending', match: /\b(material|cement|steel|tiles?|paint|not available|short of|stock)\b/i },
  { category: 'Owner Access Pending', match: /\b(access|lock(?:ed)?|key|owner not|permission to enter)\b/i },
  { category: 'Drawing / Design Clarification', match: /\b(drawing|design|detail|clarif|revis|architect|consultant)\b/i },
  { category: 'Client Selection Pending', match: /\b(selection|not selected|client to (?:choose|select)|approve the sample)\b/i },
  { category: 'Contractor Manpower', match: /\b(manpower|labour|workers? short|no workers?|crew)\b/i },
  { category: 'Previous Work Incomplete', match: /\b(previous work|before this|not ready|incomplete|finish the .* first)\b/i },
  { category: 'External Utility / Authority', match: /\b(eb|electricity board|utility|water connection|authority|municipal)\b/i },
];

export const blockerCategoryFor = (text) => {
  const hit = BLOCKER_RULES.find((rule) => rule.match.test(String(text)));
  return hit ? hit.category : '';
};

export function defaultContractorFor(defaults, phaseId, disciplineCode) {
  const forDiscipline = (defaults || []).filter((item) => item.active !== false && item.discipline === disciplineCode);
  const exact = forDiscipline.find((item) => item.phase_id && item.phase_id === phaseId);
  if (exact) return { id: exact.contractor_id, via: 'phase default' };
  const anyPhase = forDiscipline.find((item) => !item.phase_id);
  return anyPhase ? { id: anyPhase.contractor_id, via: 'project default' } : null;
}

/** The values rechecked when a proposal is confirmed, so a stale review cannot overwrite a newer edit. */
export const taskRefSnapshot = (task) => ({
  status: task.status || '',
  progress: typeof task.progress_percent === 'number' ? task.progress_percent : null,
  forecast: toDay(task.current_forecast_finish),
  updated_date: task.updated_date || '',
});

/**
 * Sanitises a model refinement against the deterministic proposal. The model may
 * only choose a candidate the rules produced, restate values that are already
 * allowed, and rewrite the description of the work — nothing else survives.
 */
export function mergeModelRefinement(proposal, raw, statusValues) {
  const out = { ...proposal, actions: [...proposal.actions], notes: [...proposal.notes] };
  if (!raw || typeof raw !== 'object') return out;

  const chosenRef = cleanText(raw.task_ref);
  if (chosenRef && out.actions.length > 1) {
    const only = out.actions.filter((action) => action.review.task_ref === chosenRef);
    if (only.length) {
      out.actions = only;
      out.notes.push(`The model narrowed the proposal to ${chosenRef}; the records it may choose from were resolved by the rules.`);
    }
  }
  const workDone = cleanText(raw.work_done).slice(0, 800);
  out.actions = out.actions.map((action) => {
    if (action.type !== 'record_progress' || !workDone) return action;
    return { ...action, payload: { ...action.payload, work_done: workDone } };
  });
  const status = statusValues.includes(raw.status) ? raw.status : '';
  if (status) {
    out.actions = out.actions.map((action) =>
      action.type === 'record_progress' ? { ...action, payload: { ...action.payload, status } } : action);
    out.notes.push(`The model proposed the status “${status}”, which the review shows before anything is written.`);
  }
  if (Array.isArray(raw.needs_clarification)) {
    out.questions = [...out.questions, ...raw.needs_clarification.slice(0, 3).map((item) => String(item).slice(0, 160))];
  }
  return out;
}