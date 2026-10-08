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