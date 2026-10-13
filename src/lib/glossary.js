import { STATUS_HELP } from '@/lib/shared/enums.ts';
import { ATTENTION_CODES } from '@/lib/shared/attention.ts';

/**
 * The words the app uses, explained once. The Help page shows them all; a "?"
 * beside a status, a health badge or a headline number shows the one that
 * applies. Statuses come from the shared list, so the explanation can never
 * drift from the rule.
 */
export const GLOSSARY = [
  ...Object.entries(STATUS_HELP).map(([term, meaning]) => ({ term, group: 'Status', meaning })),
  { term: 'Execution Complete vs Approved', group: 'Status', meaning: 'Execution Complete means the contractor says the work is finished. Approved means DVG has inspected it and agrees. Different people do the two steps on purpose, so nobody approves their own work.' },
  { term: 'On track', group: 'Health', meaning: 'Has a finish date and is not at risk or late. Health is separate from status.' },
  { term: 'At risk', group: 'Health', meaning: 'Due soon (inside the project’s at-risk window, counted in working days) and not on its way: no site update for too long, a predecessor still open, or blocked.' },
  { term: 'Late', group: 'Health', meaning: 'The finish date has passed and the work is still to be executed. Work waiting for inspection is never late — it is awaiting verification.' },
  { term: 'Overdue', group: 'Headline numbers', meaning: 'Still to be executed, with the finish date already passed. The same as Late.' },
  { term: 'Blocked tasks', group: 'Headline numbers', meaning: 'Marked Blocked, or carrying a recorded blocker, on work still to be executed. Every blocker has an owner and a clear-by date.' },
  { term: 'Awaiting verification', group: 'Headline numbers', meaning: 'Executed and waiting for DVG to inspect and approve. Not overdue.' },
  { term: 'Finish date', group: 'Dates', meaning: 'The forecast finish if there is one, otherwise the approved baseline finish. Nothing else is treated as a scheduled date.' },
  { term: 'Baseline', group: 'Dates', meaning: 'The approved plan. Once approved it is frozen; it only changes through a baseline revision with a reason.' },
  { term: 'Forecast', group: 'Dates', meaning: 'Where the finish date is now expected to be. Every change needs a reason and a delay category.' },
  { term: 'Working days', group: 'Dates', meaning: 'Days the project works (Monday to Saturday by default, minus holidays). Stale, at-risk and overdue rules count them, so a Sunday never makes work look neglected.' },
  { term: 'Villa-work parent', group: 'Records', meaning: 'A holder for work that applies to many villas. It is never counted as work; each villa has its own child task.' },
  { term: 'Handed over', group: 'Records', meaning: 'Possession is with the owner. Handing over never closes work: open works and snags stay first in line.' },
  { term: 'Snag', group: 'Records', meaning: 'A defect. It is tracked on its own, separate from tasks, and closed by the person who checks it.' },
  { term: 'Demo record', group: 'Records', meaning: 'Practice data. It is kept out of every figure unless an administrator switches the demo view on.' },
  { term: 'Measured completion', group: 'Headline numbers', meaning: 'A percentage appears only when every task in the set has measured progress (approved and closed count as 100%). Otherwise the app says how many are measured instead of guessing.' },
  ...Object.entries(ATTENTION_CODES).map(([code, meta]) => ({ term: meta.label, group: 'Needs attention', code, meaning: meta.severity === 'invalid' ? 'A decision is needed before this record can be trusted. These must reach zero before go-live.' : 'Acceptable to carry forward, but worth filling in.' })),
];

export const glossaryFor = (term) => GLOSSARY.find((entry) => entry.term === term) || null;