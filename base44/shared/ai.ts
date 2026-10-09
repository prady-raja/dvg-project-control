/**
 * AI support for Ask DVG AI.
 *
 * Every number the assistant is allowed to talk about is computed here first by
 * the dashboard engine; the model receives that computed digest and is asked to
 * explain it, never to calculate it. The prompt states the rules, the data date
 * and the gaps, and the response is expected to separate facts, calculated
 * results, risks and suggested actions, quoting task references.
 */

import { secrets } from 'base44:runtime';
import { listAll } from './records.ts';
import {
  dueWithin, heldLocationIds, isAwaitingClosure, isAwaitingVerification, isOutstanding,
  isOverdue, isUnscheduled, shiftDay, statusCounts, taskRow, weightedProgress,
} from './dashboardCore.ts';
import { contractorBoardView, disciplineCounts, executiveView, villaInventory } from './dashboardViews.ts';
import { blockerBoardView, handoverBoardView } from './dashboardBoards.ts';

export const DEFAULT_SETTINGS = {
  enabled: true,
  allowed_roles: ['Project Admin', 'Project Manager'],
  model: 'gpt-4o-mini',
  daily_request_limit: 40,
  context_item_limit: 40,
  instructions: '',
};

export const AI_MODELS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — lowest cost, good for summaries' },
  { value: 'gpt-4o', label: 'gpt-4o — stronger reasoning, higher cost' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini — balanced' },
  { value: 'gpt-4.1', label: 'gpt-4.1 — highest quality, highest cost' },
];

export const OPENAI_KEY_SECRET = 'OPENAI_API_KEY';

/** The lists a proposed update must stay inside — the same values the guarded writers accept. */
export const TASK_STATUSES = [
  'Not Started', 'In Progress', 'Blocked', 'Execution Complete', 'Under Inspection', 'Approved', 'Closed',
];

export const BLOCKER_CATEGORIES = [
  'Previous Work Incomplete', 'Materials Pending', 'Client Selection Pending', 'Owner Access Pending',
  'Drawing / Design Clarification', 'Contractor Manpower', 'DVG Approval', 'External Utility / Authority', 'Other',
];

/** The key lives only in server-side secrets. Its presence is the setup switch. */
export function aiKeyPresent() {
  try {
    return !!secrets.get(OPENAI_KEY_SECRET);
  } catch {
    return false;
  }
}

export async function loadAiSettings(svc) {
  const res = await svc.AiSettings.list({ sort: '-updated_date', limit: 1 });
  const record = listAll(res)[0] || {};
  const defined = Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  return { ...DEFAULT_SETTINGS, ...defined, record_id: record.id || '' };
}

export function canUseAi(settings, { appAdmin, rank, role }) {
  if (!settings.enabled) return { ok: false, reason: 'AI is switched off by the administrator.' };
  if (appAdmin) return { ok: true };
  if (rank < 0) return { ok: false, reason: 'You are not a member of this project.' };
  const allowed = settings.allowed_roles || [];
  if (!allowed.length || allowed.includes(role)) return { ok: true };
  return { ok: false, reason: `AI is limited to ${allowed.join(', ')} for this project.` };
}

export async function usageToday(svc, userId, day) {
  const res = await svc.AiUsage.filter({ user_id: userId, day, ok: true }, { limit: 200, fields: ['id'] });
  return listAll(res).length;
}

export async function recordUsage(svc, entry) {
  try {
    await svc.AiUsage.create(entry);
  } catch {
    // Usage logging must never take down an answer the user is waiting for.
  }
}

/** One bounded call to the provider. */
export async function callOpenAi({ apiKey, model, system, user, json = false, maxTokens = 1500 }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: json ? 0.1 : 0.3,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(60000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `The AI provider refused the request (${response.status}).`);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return {
    content: payload?.choices?.[0]?.message?.content || '',
    usage: payload?.usage || {},
  };
}

/* ------------------------------------------------------------------ the digest */

const compact = (row) => ({
  ref: row.ref,
  villa: row.villa,
  task: row.name,
  discipline: row.discipline_name,
  contractor: row.contractor || 'Unassigned',
  phase: row.phase,
  status: row.status,
  progress: row.progress,
  finish: row.finish,
  finish_source: row.finish_source,
  overdue_days: row.overdue_days,
  due_in_days: row.due_in_days,
  blocker: row.blocker || undefined,
  blocker_category: row.blocker_category || undefined,
  blocked_days: row.blocked_days ?? undefined,
  action: row.action || undefined,
});

/**
 * The permission-scoped, size-bounded fact sheet handed to the model. It is
 * built from the same functions the dashboards use, so a figure in an answer
 * always matches the figure on screen.
 */
export function buildDigest({ tasks, locations, phases, projects, contractors, ix, options, asOf, dependencies = [], commitments = [], snags = [] }) {
  const limit = Number(options.itemLimit) || 40;
  const perProject = options.projectId
    ? { project_id: options.projectId, phase_id: options.phaseId || '' }
    : null;
  const executive = executiveView({ tasks, locations, phases, projects, ix, options, asOf });
  const contractorBoard = contractorBoardView({ tasks, contractors, ix, options: { ...options, locations }, asOf });
  const blockers = blockerBoardView({ tasks, dependencies, ix, options, asOf, heldIds: heldLocationIds(locations) });
  const handover = handoverBoardView({ tasks, locations, snags, ix, asOf, options });

  const heldIds = heldLocationIds(locations);
  const scoped = tasks.filter((t) => {
    if (t.archived === true || t.is_villa_work_parent === true || t.is_demo) return false;
    if (options.projectId && t.project_id !== options.projectId) return false;
    if (options.phaseId && t.phase_id !== options.phaseId) return false;
    return true;
  });
  const active = scoped.filter((t) => !t.location_id || !heldIds.has(t.location_id));
  const outstanding = active.filter(isOutstanding);

  const staleBefore = shiftDay(asOf, -7);
  const stale = outstanding.filter((t) => {
    const last = ix.lastReportAt(t.id) || t.updated_date || '';
    return !last || String(last).slice(0, 10) < staleBefore;
  });

  const villaRows = locations
    .filter((l) => l.location_type === 'Villa')
    .filter((l) => !options.projectId || l.project_id === options.projectId)
    .filter((l) => !options.phaseId || l.phase_id === options.phaseId)
    .map((villa) => {
      const mine = active.filter((t) => t.location_id === villa.id);
      const row = {
        villa: villa.villa_code,
        phase: ix.phaseName(villa.phase_id),
        possession: villa.possession_status,
        works_stage: villa.works_stage,
        on_hold: villa.active_status === 'On Hold',
        open: mine.filter(isOutstanding).length,
        overdue: mine.filter((t) => isOverdue(t, asOf)).length,
        blocked: mine.filter((t) => t.status === 'Blocked').length,
        awaiting_verification: mine.filter(isAwaitingVerification).length,
        open_snags: snags.filter((s) => s.location_id === villa.id && s.status !== 'Closed').length,
      };
      return row;
    })
    .filter((row) => row.open > 0 || row.overdue > 0 || row.open_snags > 0)
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
    .slice(0, limit);

  const measured = outstanding.filter((t) => typeof t.progress_percent === 'number');
  const openCommitments = commitments
    .filter((c) => !options.projectId || c.project_id === options.projectId)
    .filter((c) => !options.phaseId || c.phase_id === options.phaseId)
    .filter((c) => c.status === 'Open');

  return {
    data_date: asOf,
    scope: perProject
      ? { project: ix.projectName(options.projectId), phase: options.phaseId ? ix.phaseName(options.phaseId) : 'all phases' }
      : { projects: projects.map((p) => p.name) },
    data_quality: {
      note: 'Counts below are calculated from records, not estimated.',
      demo_tasks_excluded: executive.metrics.demo_tasks_excluded,
      held_villas_excluded_from_active_figures: executive.metrics.held_open_tasks,
      measured_progress: `${measured.length} of ${outstanding.length} outstanding tasks carry measured progress`,
      progress_reliable: measured.length === outstanding.length && outstanding.length > 0,
      tasks_without_dates: executive.metrics.unscheduled_tasks,
      tasks_not_updated_in_7_days: stale.length,
      dependency_links_recorded: blockers.counts.dependency_links,
      dependencies_complete:
        blockers.counts.dependency_links > 0
          ? 'Partly recorded — impact is only stated where a link exists'
          : 'No task dependencies recorded, so scheduling impact cannot be determined',
      site_photos_available: snags.filter((s) => (s.photo_uris || []).length).length,
      last_site_report: active
        .map((t) => ix.lastReportAt(t.id))
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || 'none recorded',
    },
    portfolio: executive.metrics,
    villa_inventory: villaInventory(locations, active, heldIds, asOf, options),
    progress_on_register: executive.progress,
    management_priorities: executive.priorities.slice(0, Math.min(limit, 20)).map((row) => ({
      ...compact(row),
      action: row.action,
      rank: row.rank,
    })),
    overdue: outstanding
      .filter((t) => isOverdue(t, asOf))
      .slice()
      .sort((a, b) => String(a.current_forecast_finish || a.baseline_finish).localeCompare(String(b.current_forecast_finish || b.baseline_finish)))
      .slice(0, limit)
      .map((t) => compact(taskRow(t, ix, asOf))),
    due_next_7_days: outstanding.filter((t) => dueWithin(t, asOf, 7)).slice(0, limit).map((t) => compact(taskRow(t, ix, asOf))),
    blockers: blockers.rows.slice(0, limit).map((row) => ({
      ...compact(row),
      identified: row.identified,
      expected_resolution_date: row.expected_resolution_date || undefined,
      downstream_count: row.downstream_count,
      downstream: row.downstream.slice(0, 4).map((n) => `${n.ref} ${n.discipline_name} (${n.status})`),
    })),
    dependency_chains: blockers.chains.slice(0, 8).map((chain) => ({
      root: `${chain.root.ref} ${chain.root.name}`,
      downstream: chain.nodes.map((n) => `${n.ref} ${n.discipline_name} (${n.status})`),
    })),
    awaiting_verification: outstanding.filter(isAwaitingVerification).slice(0, limit).map((t) => compact(taskRow(t, ix, asOf))),
    awaiting_closure: outstanding.filter(isAwaitingClosure).slice(0, limit).map((t) => compact(taskRow(t, ix, asOf))),
    unscheduled: outstanding.filter(isUnscheduled).slice(0, limit).map((t) => compact(taskRow(t, ix, asOf))),
    not_updated_recently: stale.slice(0, limit).map((t) => ({
      ref: t.task_ref,
      villa: ix.villaCode(t.location_id) || 'Site-wide',
      task: t.name,
      status: t.status,
      last_report: ix.lastReportAt(t.id) || 'never reported',
    })),
    villas_needing_attention: villaRows,
    contractors: contractorBoard.rows.map((row) => ({
      contractor: row.contractor,
      trade: row.trade,
      open: row.open,
      overdue: row.overdue,
      blocked: row.blocked,
      due_this_week: row.due_this_week,
      awaiting_approval: row.awaiting_approval,
      measured_progress: row.progress.reliable ? row.progress.percent : null,
      progress_note: row.progress.reliable ? '' : row.progress.reason,
      manpower_reported_last_7_days: row.manpower_7d,
      tasks_not_updated_in_7_days: row.stale_tasks,
      blocked_by_other_parties: row.needs_intervention.length,
      villa_list: row.villas.slice(0, 8),
    })),
    handed_over_with_open_works: handover.rows
      .filter((row) => row.possession_status === 'Handed Over' && (row.outstanding > 0 || row.open_snags + row.snags_awaiting_reinspection > 0))
      .slice(0, limit)
      .map((row) => ({
        villa: row.villa,
        phase: row.phase,
        outstanding: row.outstanding,
        overdue: row.overdue,
        awaiting_verification: row.awaiting_verification,
        open_snags: row.open_snags,
        snags_awaiting_reinspection: row.snags_awaiting_reinspection,
        handover_stage: row.handover_stage,
      })),
    handover_summary: handover.summary,
    site_wide: {
      open: executive.metrics.site_wide_open,
      note: 'Site-wide and common works are counted separately from villa works.',
    },
    by_discipline: disciplineCounts(active, ix, asOf).map((row) => ({
      discipline: row.discipline_name,
      open: row.open,
      overdue: row.overdue,
      blocked: row.blocked,
      awaiting_verification: row.awaitingVerification,
      measured_progress: row.progress.reliable ? row.progress.percent : null,
      progress_note: row.progress.reliable ? '' : row.progress.reason,
    })),
    open_commitments: openCommitments.slice(0, limit).map((c) => ({
      contractor: ix.contractorName(c.contractor_id) || 'Unassigned',
      task_ref: c.task_ref || '',
      meeting_date: c.meeting_date,
      promised_date: c.promised_date || '',
      commitment: c.commitment,
      responsible: c.responsible_person || '',
      overdue: !!c.promised_date && c.promised_date < asOf,
    })),
    pending_decisions: outstanding
      .filter((t) => isAwaitingVerification(t) || isAwaitingClosure(t) || t.access_status === 'Pending' || t.selection_status === 'Pending Selection')
      .slice(0, limit)
      .map((t) => ({ ...compact(taskRow(t, ix, asOf)), decisions: taskRow(t, ix, asOf).decisions })),
    counts_by_status: statusCounts(active, asOf),
    weighted_progress_basis: weightedProgress(active).basis,
  };
}

/* -------------------------------------------------------------------- prompts */

const RULES = `You are the project-intelligence assistant inside DVG Project Control, a construction management system used by Dream Valley Group.

Absolute rules:
1. Ground every statement in the FACTS block you are given. It was calculated from the live database for the data date shown. Do not recalculate, extrapolate or invent numbers, dates, percentages, contractor names or villa codes.
2. Never state a completion percentage unless the facts mark the progress as reliable. If progress is not measured, say so plainly and use the status counts instead.
3. Quote task references (for example IMG-A-0004) and villa codes for every claim about specific work, so the user can open the record.
4. If the facts show that data is missing (no dependencies recorded, tasks without dates, tasks not updated recently, demo data only, few or no records), say so before drawing conclusions.
5. Distinguish clearly between: FACTS (recorded data), CALCULATED (derived by the system from records), RISKS (things that may go wrong), and SUGGESTED ACTIONS (what management could do next). Use those four headings.
6. You may summarise, explain and prioritise. You may not approve work, change baselines, alter permissions, write to records, or authorise anything.
7. Only the records in the FACTS block are visible to you. If a question concerns something outside that scope, say that it is outside your current access rather than guessing.
8. Be concise and operational. No filler, no disclaimers beyond what the rules require.`;

export const systemPrompt = ({ user, settings, mode, scopeLabel, asOf, digest }) => `${RULES}
${settings.instructions ? `\nStanding instructions from the administrator: ${settings.instructions}\n` : ''}
Request type: ${mode}.
Signed-in user: ${user.full_name || user.email} (their own project access already applies to these facts).
Scope: ${scopeLabel}.
Data date: ${asOf}. Nothing later than this date is recorded in the facts you were given.

FACTS (calculated by the system from project records):
${JSON.stringify(digest)}`;

export const askPrompt = (question) => `Question from management:\n"${question}"\n\nAnswer using the four headed sections. Keep it under 450 words and lead with the most important issue.`;

export const dailyBriefPrompt = () => `Write the daily management brief using these eight numbered sections, each short and factual:
1. Overall project activity
2. Key overdue works
3. Critical blockers
4. Upcoming contractor commitments
5. Tasks requiring management decisions
6. Villas needing attention
7. Missing or stale site updates
8. Suggested priorities for the next working day

State the data date at the top. If there are no recent site reports, say so instead of implying the picture is current.`; 

export const meetingBriefPrompt = ({ contractor, meetingDate }) => `Prepare the meeting brief for ${contractor} on ${meetingDate}.
Include, as short headed sections: the outstanding works worth raising, overdue items and broken promises (quote task references), upstream blockers and who owns them, questions to ask this contractor, decisions management must take, and a closing list of what to confirm at the end of the meeting. Where a dependency or an impact is not recorded in the facts, say the information is insufficient rather than asserting one.`;

export const parseUpdatePrompt = (text, candidates, categories) => `A site engineer wrote this update:
"${text}"

The candidate tasks below are the only tasks that may be matched (chosen by deterministic matching, not by you):
${JSON.stringify(candidates)}

Extract a proposed structured update and reply with JSON only, matching this shape:
{
  "task_ref": "<one ref from the candidates, or empty string if none is clearly right>",
  "matched_confidence": "high" | "medium" | "low",
  "status": "<one of: Not Started, In Progress, Blocked, Execution Complete, Under Inspection, Approved, Closed, or empty>",
  "progress_percent": <number 0-100 or null>,
  "manpower_total": <number or null>,
  "work_done": "<one line describing what was done, in the engineer's words, or empty>",
  "plan_tomorrow": "<one line or empty>",
  "blocker_category": "<one of: ${categories.join(', ')}, or empty>",
  "blocker_description": "<short description or empty>",
  "needs_clarification": ["<what you could not determine>"]
}
Never invent a progress figure that the text does not state. Never choose a task unless the text clearly refers to it.`;

/** Deterministic candidate matching — the model may only choose from these. */
export function matchTaskCandidates(tasks, ix, text, asOf, limit = 6) {
  const haystack = String(text || '').toLowerCase();
  const words = new Set(haystack.split(/[^a-z0-9-]+/).filter((word) => word.length > 2));
  const scored = tasks
    .filter((task) => isOutstanding(task))
    .map((task) => {
      let score = 0;
      const ref = String(task.task_ref || '').toLowerCase();
      if (ref && haystack.includes(ref)) score += 80;
      const villa = String(ix.villaCode(task.location_id) || '').toLowerCase();
      if (villa && villa.length > 2 && haystack.includes(villa)) score += 40;
      const nameWords = String(task.name || '').toLowerCase().split(/[^a-z0-9-]+/).filter((word) => word.length > 2);
      score += nameWords.filter((word) => words.has(word)).length * 10;
      const packageWords = String(task.work_package || '').toLowerCase().split(/[^a-z0-9-]+/).filter((word) => word.length > 2);
      score += packageWords.filter((word) => words.has(word)).length * 8;
      const engineer = String(task.responsible_engineer || '').toLowerCase();
      if (engineer && engineer.length > 2 && haystack.includes(engineer)) score += 5;
      return { task, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ task, score }) => {
    const row = taskRow(task, ix, asOf);
    return {
      task_id: task.id,
      ref: row.ref,
      villa: row.villa,
      name: row.name,
      discipline: row.discipline_name,
      contractor: row.contractor,
      status: row.status,
      progress: row.progress,
      finish: row.finish,
      score,
    };
  });
}