import { STATUS_CATEGORY, STATUS_HELP } from '@/lib/shared/enums.ts';

/**
 * Colour, icon and category for every status (U-01). A status is always shown
 * with its icon and its text as well as its colour, so it still reads for
 * people who cannot tell the colours apart and in a black-and-white printout.
 */
const CATEGORY_TONE = {
  'To do': 'bg-slate-100 text-slate-700 border-slate-300',
  Active: 'bg-sky-50 text-sky-800 border-sky-300',
  Stuck: 'bg-red-50 text-red-800 border-red-300',
  Done: 'bg-emerald-50 text-emerald-800 border-emerald-300',
};

const CATEGORY_ICON = { 'To do': 'Circle', Active: 'Loader', Stuck: 'OctagonAlert', Done: 'CircleCheck' };

export const STATUS_TOKENS = Object.fromEntries(
  Object.entries(STATUS_CATEGORY).map(([status, category]) => [
    status,
    { category, icon: CATEGORY_ICON[category], tone: CATEGORY_TONE[category], help: STATUS_HELP[status] },
  ]),
);

// Closed is the end of the line, so it is drawn solid rather than as a tint.
STATUS_TOKENS.Closed.tone = 'bg-slate-800 text-slate-50 border-slate-800';
// Inspection steps are Done for the worker but still need DVG, so they read differently.
STATUS_TOKENS['Under Inspection'].tone = 'bg-violet-50 text-violet-800 border-violet-300';
STATUS_TOKENS['Execution Complete'].tone = 'bg-teal-50 text-teal-800 border-teal-300';

/** Villa and project status values that are not task statuses. */
export const OTHER_TOKENS = {
  'On Hold': { icon: 'CirclePause', tone: 'bg-orange-50 text-orange-800 border-orange-300', help: 'Paused on purpose. Its work is held out of active figures.' },
  Active: { icon: 'CirclePlay', tone: 'bg-emerald-50 text-emerald-800 border-emerald-300', help: 'In use.' },
};

export const HEALTH_TOKENS = {
  'On track': { icon: 'CircleCheck', tone: 'bg-emerald-50 text-emerald-800 border-emerald-300', help: 'On or ahead of its finish date.' },
  'At risk': { icon: 'TriangleAlert', tone: 'bg-amber-50 text-amber-900 border-amber-300', help: 'Due soon with no recent update, a predecessor still open, or blocked near its due date.' },
  Late: { icon: 'Clock', tone: 'bg-red-50 text-red-800 border-red-300', help: 'Its finish date has passed and the work is not finished.' },
};

export const tokenFor = (status) => STATUS_TOKENS[status] || null;