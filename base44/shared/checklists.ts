/**
 * Inspection checklists, lite (MVP gap, step 4). A short list of things to look at,
 * with Pass / Fail / N/A against each. It is a record of what was looked at: it
 * never moves a task or a snag between statuses, and it never decides who may
 * approve. Templates are a plain list per discipline that an administrator edits.
 */
import { fail } from './records.ts';

export const RESULTS = ['Pass', 'Fail', 'N/A'];

export const GENERIC_ITEMS = [
  'Work matches the drawing or the agreed scope',
  'Finish and workmanship are acceptable',
  'Area is clean and free of debris',
  'Nothing damaged during the work',
];

/** A short starting list for each discipline in use. An administrator can replace any of them. */
export const DEFAULT_ITEMS = {
  CIVIL: ['Levels and lines are true', 'Joints and edges are neat', 'No cracks or hollow sounds', 'Waterproofing and curing are complete', 'Clean-up done'],
  ELEC: ['Points are at the drawn positions', 'Switches and sockets are fixed and plumb', 'Circuits are labelled in the DB', 'Earthing is complete', 'All fittings tested and working'],
  PLUMB: ['Fixtures are fixed and level', 'No leaks under pressure test', 'Drainage flows freely', 'Hot and cold are the right way round', 'Traps and covers are fitted'],
  HVAC: ['Units and diffusers are at the drawn positions', 'Condensate drains flow', 'Insulation and cladding are complete', 'Cooling is tested', 'Remote and settings are handed over'],
  AUTO: ['Devices are at the drawn positions', 'Every scene works', 'App and panel control the same loads', 'Labels and as-built are updated'],
  FIN: ['Surface is smooth and even', 'Colour and finish match the sample', 'Edges, corners and skirting are neat', 'No stains, cracks or chips', 'Touch-up and clean-up done'],
  POOL: ['Tiles and coping are aligned', 'No leakage on the water test', 'Pumps and filters run', 'Lights and controls work', 'Safety features are fitted'],
  IRR: ['Coverage matches the plan', 'Heads and drippers all work', 'Controller zones run in order', 'No leaks at joints'],
  EXT: ['Levels and falls drain correctly', 'Finish matches the sample', 'Edges and joints are neat', 'Clean-up done'],
  SNAG: ['The reported defect is fixed', 'Surrounding finish is undisturbed', 'Area is clean'],
  INFRA: ['Work matches the approved drawing', 'Test or certificate is on file', 'Site is restored and safe'],
  APPR: ['Approval or permit is on file', 'Conditions are noted', 'Copy given to the project team'],
};

const cleanLine = (value, max = 200) => String(value === null || value === undefined ? '' : value).trim().slice(0, max);

/** The list to use for a discipline: the administrator's own when they have written one, else the starting list. */
export function templateFor(disciplineCode, stored) {
  const own = (Array.isArray(stored) ? stored : []).map((line) => cleanLine(line)).filter(Boolean);
  if (own.length) return own.slice(0, 40);
  return DEFAULT_ITEMS[String(disciplineCode || '').toUpperCase()] || GENERIC_ITEMS;
}

/** A template typed one item per line, tidied. */
export function parseTemplateText(text) {
  const seen = new Set();
  return String(text || '').split(/\r?\n/).map((line) => cleanLine(line.replace(/^[-•*\d.)\s]+/, ''))).filter((line) => {
    const key = line.toLowerCase();
    if (!line || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

/** What a person filled in, checked: every item has a result, a Fail says what was wrong. */
export function checklistInput(items) {
  if (!Array.isArray(items) || !items.length) throw fail('The checklist has no items.');
  if (items.length > 40) throw fail('A checklist holds at most 40 items.');
  const clean = items.map((item, index) => {
    const text = cleanLine(item?.text);
    if (!text) throw fail(`Item ${index + 1} has no wording.`);
    if (!RESULTS.includes(item?.result)) throw fail(`Mark "${text}" as Pass, Fail or N/A.`);
    const comment = cleanLine(item?.comment, 500);
    if (item.result === 'Fail' && !comment) throw fail(`Say what is wrong with "${text}".`);
    return { text, result: item.result, comment, photo_uri: cleanLine(item?.photo_uri, 500) };
  });
  return clean;
}

export const overallOf = (items = []) => (items.some((i) => i.result === 'Fail') ? 'Fail' : 'Pass');
export const failedItems = (items = []) => items.filter((i) => i.result === 'Fail');

/** A task can be inspected once the work is reported done; a snag until it is closed. This changes no status. */
export const INSPECTABLE_TASK_STATUSES = ['Execution Complete', 'Under Inspection'];
export function inspectableProblem(subjectType, subject) {
  if (subjectType === 'Task') {
    return INSPECTABLE_TASK_STATUSES.includes(subject?.status) ? '' : 'A checklist can be attached once the work is Execution Complete or Under Inspection.';
  }
  if (subjectType === 'Snag') return subject?.status === 'Closed' ? 'This snag is already closed.' : '';
  return 'Unknown subject.';
}

/** What Raise snag is prefilled with for a failed item. */
export function snagFromFailure({ item, subject, subjectType, location }) {
  return {
    title: item.text.slice(0, 120),
    description: item.comment,
    discipline: subject?.discipline || '',
    contractor_id: subject?.contractor_id || '',
    photo_uris: item.photo_uri ? [item.photo_uri] : [],
    floor_id: subject?.floor_id || '',
    area_ids: subject?.area_ids || [],
    locationId: subject?.location_id || location?.id || '',
    from: `${subjectType === 'Task' ? subject?.task_ref || 'task' : subject?.snag_ref || 'snag'} inspection`,
  };
}
