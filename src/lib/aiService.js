import { base44 } from '@/api/base44Client';

/** Ask DVG AI — every request goes through the guarded server function. */
export async function aiStatus() {
  const res = await base44.functions.invoke('aiAction', { action: 'status' });
  return res?.data || {};
}

export async function aiAsk({ projectId, phaseId, question, date }) {
  const res = await base44.functions.invoke('aiAction', { action: 'ask', projectId, phaseId, question, date });
  return res?.data || {};
}

export async function aiDailyBrief({ projectId, phaseId, date }) {
  const res = await base44.functions.invoke('aiAction', { action: 'daily_brief', projectId, phaseId, date });
  return res?.data || {};
}

export async function aiMeetingBrief({ projectId, phaseId, contractorId, meetingDate }) {
  const res = await base44.functions.invoke('aiAction', {
    action: 'meeting_brief',
    projectId,
    phaseId,
    contractorId,
    meetingDate,
  });
  return res?.data || {};
}

export async function aiParseUpdate({ projectId, phaseId, text, date }) {
  const res = await base44.functions.invoke('aiAction', { action: 'parse_update', projectId, phaseId, text, date });
  return res?.data || {};
}

/* ------------------------------------------------------------------ site message assistant
 *
 * Four guarded steps, and only the third one writes:
 *   1. propose  — the words are read by rule, a proposal is stored under a key
 *   2. confirm  — the selected actions come back with their final values
 *   3. apply    — the client writes them through the ordinary guarded services
 *   4. finish   — the outcome is recorded, so the proposal can never apply twice
 */

export async function aiAssist({ projectId, phaseId, text, date, key }) {
  const res = await base44.functions.invoke('aiAction', { action: 'assist', projectId, phaseId, text, date, key });
  return res?.data || {};
}

export async function aiAssistConfirm({ projectId, phaseId, key, actionIds, edits }) {
  const res = await base44.functions.invoke('aiAction', {
    action: 'assist_confirm',
    projectId,
    phaseId,
    key,
    action_ids: actionIds,
    edits: edits || {},
  });
  return res?.data || {};
}

export async function aiAssistFinish({ projectId, phaseId, key, results }) {
  const res = await base44.functions.invoke('aiAction', {
    action: 'assist_finish',
    projectId,
    phaseId,
    key,
    results: results || [],
  });
  return res?.data || {};
}

export async function aiAssistCancel({ projectId, phaseId, key }) {
  const res = await base44.functions.invoke('aiAction', { action: 'assist_cancel', projectId, phaseId, key });
  return res?.data || {};
}

/** A key per message, so a repeated confirmation of the same words is recognised. */
export const newProposalKey = () =>
  `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The models an administrator may choose between. */
export const AI_MODELS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — lowest cost, good for summaries' },
  { value: 'gpt-4o', label: 'gpt-4o — stronger reasoning, higher cost' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini — balanced' },
  { value: 'gpt-4.1', label: 'gpt-4.1 — highest quality, highest cost' },
];

export const SUGGESTED_QUESTIONS = [
  'What are the most important issues requiring attention today?',
  'Which contractor has the most outstanding works?',
  'Which works are blocking Hariom?',
  'Which villas have the most overdue tasks?',
  'Prepare my meeting with Oasis.',
  'What works are scheduled for the next seven days?',
  'Which handed-over villas still have open works?',
  'Which tasks have not been updated recently?',
];

export const SITE_MESSAGE_EXAMPLES = [
  'Villa 10 painting is 60% complete, four painters today.',
  'Plot 5 and 6 false ceiling finishing done, waiting for electrical points.',
  'Kitchen waterproofing in B-07-08-09 not started, material not received.',
  'Raise a snag: major crack in the first floor master bedroom of B-05-06.',
  'Hariom cannot start tiling in villa A-01 until plumbing is complete.',
];

export const BRIEF_SECTIONS = [
  'Overall project activity',
  'Key overdue works',
  'Critical blockers',
  'Upcoming contractor commitments',
  'Tasks requiring management decisions',
  'Villas needing attention',
  'Missing or stale site updates',
  'Suggested priorities for the next working day',
];