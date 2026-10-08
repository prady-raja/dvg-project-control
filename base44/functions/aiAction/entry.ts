import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { isAppAdmin, resolveRole } from '../../shared/access.ts';
import { fail } from '../../shared/records.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import {
  AI_MODELS, BLOCKER_CATEGORIES, OPENAI_KEY_SECRET, TASK_STATUSES, buildDigest, callOpenAi,
  canUseAi, dailyBriefPrompt, loadAiSettings, matchTaskCandidates, meetingBriefPrompt,
  parseUpdatePrompt, askPrompt, recordUsage, systemPrompt, usageToday,
} from '../../shared/ai.ts';
import { loadProjectData, scopeFor } from '../../shared/projectData.ts';

/**
 * Ask DVG AI.
 *
 * The model never touches the database. This function decides what the caller
 * may see from their own project membership, computes every figure with the
 * dashboard engine, and sends only that bounded digest to the provider. The
 * request is refused before any provider call when the key is missing, the role
 * is not allowed, or the day's limit is used up.
 *
 * Nothing here writes to a task, a baseline or a permission. A proposed
 * site update is returned for a human to confirm and is applied afterwards
 * through the existing guarded daily-update path.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUESTION = 1200;
const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

const parseJson = (value) => {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    const match = String(value || '').match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
};

const bounded = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Math.round(number * 10) / 10;
};

/** Only values the guards already accept survive — the model can add nothing. */
const sanitizeProposal = (raw, candidates) => {
  const refs = new Set(candidates.map((candidate) => candidate.ref));
  return {
    task_ref: refs.has(String(raw?.task_ref || '')) ? String(raw.task_ref) : '',
    matched_confidence: ['high', 'medium', 'low'].includes(raw?.matched_confidence) ? raw.matched_confidence : 'low',
    status: TASK_STATUSES.includes(raw?.status) ? raw.status : '',
    progress_percent: bounded(raw?.progress_percent, 0, 100),
    manpower_total: bounded(raw?.manpower_total, 0, 5000),
    work_done: String(raw?.work_done || '').slice(0, 800),
    plan_tomorrow: String(raw?.plan_tomorrow || '').slice(0, 800),
    blocker_category: BLOCKER_CATEGORIES.includes(raw?.blocker_category) ? raw.blocker_category : '',
    blocker_description: String(raw?.blocker_description || '').slice(0, 800),
    needs_clarification: Array.isArray(raw?.needs_clarification)
      ? raw.needs_clarification.slice(0, 5).map((item) => String(item).slice(0, 140))
      : [],
  };
};

/** Mechanical reading of the words — used only when AI is not configured. */
const deterministicProposal = (text, candidates) => {
  const percent = String(text).match(/(\d{1,3}(?:\.\d)?)\s*(?:%|per cent|percent)/i);
  const workers = String(text).match(/(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s*(?:workers|worker|men|man|persons|person|people|nos)/i);
  const count = workers
    ? (WORD_NUMBERS[String(workers[1]).toLowerCase()] ?? Number(workers[1]))
    : null;
  const blockerLike = /waiting|pending|not available|not started|blocked|delay|short of/i.test(String(text));
  return {
    task_ref: candidates.length === 1 ? candidates[0].ref : '',
    matched_confidence: candidates.length === 1 ? 'medium' : 'low',
    status: /complet|done|finish/i.test(String(text)) ? 'Execution Complete' : /blocked|waiting|pending/i.test(String(text)) ? 'Blocked' : 'In Progress',
    progress_percent: percent ? bounded(percent[1], 0, 100) : null,
    manpower_total: Number.isFinite(count) ? count : null,
    work_done: String(text).slice(0, 800),
    plan_tomorrow: '',
    blocker_category: '',
    blocker_description: blockerLike ? String(text).slice(0, 400) : '',
    needs_clarification: [
      'Confirm the correct task',
      'Confirm the status and progress',
      ...(blockerLike ? ['Choose the blocker category if this is a blocker'] : []),
    ],
  };
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    const action = String(body?.action || 'status');
    const day = todayIst();
    const asOf = DATE.test(String(body?.date || '')) ? String(body.date) : day;

    const settings = await loadAiSettings(svc);
    let apiKey = '';
    try {
      apiKey = secrets.get(OPENAI_KEY_SECRET) || '';
    } catch {
      apiKey = '';
    }
    const configured = !!apiKey;
    const limit = Number(settings.daily_request_limit) || 0;
    const used = await usageToday(svc, user.id, day);
    const remaining = limit > 0 ? Math.max(0, limit - used) : 0;

    const projectId = String(body?.projectId || '');
    const scope = await scopeFor(base44, user, projectId);
    const role = await resolveRole(base44, user, scope.projectId || '');
    const appAdmin = isAppAdmin(user);
    const permission = canUseAi(settings, { appAdmin, rank: scope.rank, role });

    if (action === 'status') {
      return Response.json({
        configured,
        enabled: settings.enabled,
        model: settings.model,
        allowed_roles: settings.allowed_roles,
        daily_limit: limit,
        used_today: used,
        remaining_today: remaining,
        permitted: permission.ok,
        reason: permission.reason || '',
        available_models: AI_MODELS,
        settings_record_id: settings.record_id || '',
        key_name: OPENAI_KEY_SECRET,
      });
    }

    if (!scope.allowed) throw fail('You are not a member of this project.', 403);
    if (!scope.projectId) throw fail('Choose a project before asking the assistant.', 400);
    if (!permission.ok) throw fail(permission.reason, 403);

    const options = {
      projectId: scope.projectId,
      phaseId: String(body?.phaseId || ''),
      itemLimit: Number(settings.context_item_limit) || 40,
      includeDemo: false,
    };

    const data = await loadProjectData(base44, user, {
      projectIds: scope.projectIds,
      projectId: scope.projectId,
      asOf,
      updates: true,
      dependencies: true,
      commitments: true,
      snags: true,
    });

    const logUsage = (entry) =>
      recordUsage(svc, {
        user_id: user.id,
        user_name: user.full_name || user.email || '',
        day,
        action,
        project_id: scope.projectId,
        model: action === 'parse_update' ? 'deterministic' : settings.model,
        asked_at: new Date().toISOString(),
        ...entry,
      });

    /* ------------------------------------------- natural-language site update */
    if (action === 'parse_update') {
      const text = String(body?.text || '').trim().slice(0, MAX_QUESTION);
      if (!text) throw fail('Describe what happened on site.');
      const candidates = matchTaskCandidates(data.tasks, data.ix, text, asOf, 6);

      if (!configured) {
        await logUsage({ ok: true, question: text.slice(0, 200) });
        return Response.json({
          configured: false,
          source: 'deterministic',
          candidates,
          proposed: candidates.length ? deterministicProposal(text, candidates) : null,
          message: candidates.length
            ? 'AI Setup Required — fields below were read mechanically from your words. Check every field and confirm the task yourself.'
            : 'AI Setup Required — no open task matches that description, so nothing was proposed. Choose the task yourself.',
          data_date: asOf,
        });
      }
      if (!candidates.length) {
        await logUsage({ ok: true, question: text.slice(0, 200) });
        return Response.json({
          configured: true,
          source: 'none',
          candidates: [],
          proposed: null,
          message: 'No open task matches that description. Choose the task yourself before recording the update.',
          data_date: asOf,
        });
      }
      if (limit > 0 && remaining <= 0) throw fail(`The daily AI limit (${limit} requests) is used up for today. It resets after midnight, Asia/Kolkata.`, 429);

      const system = systemPrompt({
        user,
        settings,
        mode: 'parse_update',
        scopeLabel: `${data.ix.projectName(scope.projectId)}${options.phaseId ? ` / ${data.ix.phaseName(options.phaseId)}` : ''}`,
        asOf,
        digest: { candidates },
      });
      try {
        const { content, usage } = await callOpenAi({
          apiKey,
          model: settings.model,
          system,
          user: parseUpdatePrompt(text, candidates, BLOCKER_CATEGORIES),
          json: true,
          maxTokens: 700,
        });
        const proposed = sanitizeProposal(parseJson(content), candidates);
        if (!proposed.task_ref && candidates.length === 1) proposed.task_ref = candidates[0].ref;
        await logUsage({
          ok: true,
          question: text.slice(0, 200),
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
        });
        return Response.json({
          configured: true,
          source: 'ai',
          candidates,
          proposed,
          ambiguous: !proposed.task_ref,
          message: proposed.task_ref ? '' : 'More than one task could match. Choose the correct task before recording this update.',
          data_date: asOf,
        });
      } catch (error) {
        await logUsage({ ok: false, question: text.slice(0, 200), error: String(error.message).slice(0, 300) });
        // The provider refused or is unreachable. The engineer can still record
        // the update: the fields come from a mechanical reading of their own
        // words, the error is stated, and the task and every value must still be
        // confirmed by hand before the guarded writer is called.
        return Response.json({
          configured: true,
          source: 'deterministic',
          provider_error: error.message,
          candidates,
          proposed: deterministicProposal(text, candidates),
          message: `The AI provider could not be reached (${error.message}). The fields below were read mechanically from your words — check every one, and the update is still recorded through the normal guarded daily-update path.`,
          data_date: asOf,
        });
      }
    }

    /* -------------------------------------------------------------- ask/briefs */
    const question = String(body?.question || '').trim().slice(0, MAX_QUESTION);
    if (action === 'ask' && !question) throw fail('Type a question for the assistant.');
    const contractorId = String(body?.contractorId || '');
    if (action === 'meeting_brief' && !contractorId) throw fail('Choose the contractor for the meeting brief.');
    const meetingDate = DATE.test(String(body?.meetingDate || '')) ? String(body.meetingDate) : day;

    const digest = buildDigest({ ...data, options, asOf });
    const scopeLabel = `${data.ix.projectName(scope.projectId)}${options.phaseId ? ` / ${data.ix.phaseName(options.phaseId)}` : ''}`;

    if (!configured) {
      return Response.json({
        configured: false,
        message: `AI Setup Required — no OpenAI API key is stored for this application yet. An administrator adds it under Secrets as ${OPENAI_KEY_SECRET}; the rest of the application works normally in the meantime.`,
        data_date: asOf,
        scope: digest.scope,
      });
    }
    if (settings.enabled !== true) throw fail('AI is switched off by the administrator.', 403);
    if (limit > 0 && remaining <= 0) throw fail(`The daily AI limit (${limit} requests) is used up for today. It resets after midnight, Asia/Kolkata.`, 429);

    const system = systemPrompt({ user, settings, mode: action, scopeLabel, asOf, digest });
    const prompt = action === 'daily_brief'
      ? dailyBriefPrompt()
      : action === 'meeting_brief'
        ? meetingBriefPrompt({ contractor: data.ix.contractorName(contractorId) || 'contractor', meetingDate })
        : askPrompt(question);

    let content = '';
    let usage = {};
    try {
      const result = await callOpenAi({
        apiKey,
        model: settings.model,
        system,
        user: prompt,
        maxTokens: action === 'ask' ? 1600 : 2400,
      });
      content = result.content;
      usage = result.usage;
    } catch (error) {
      await logUsage({ ok: false, question: question.slice(0, 200), error: String(error.message).slice(0, 300) });
      throw error;
    }

    await logUsage({
      ok: true,
      question: question ? question.slice(0, 200) : action,
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
    });

    return Response.json({
      configured: true,
      action,
      answer: content,
      model: settings.model,
      data_date: asOf,
      scope: digest.scope,
      facts: {
        counts: digest.portfolio,
        data_quality: digest.data_quality,
        progress_on_register: digest.progress_on_register,
      },
      usage: { prompt_tokens: usage?.prompt_tokens || 0, completion_tokens: usage?.completion_tokens || 0 },
      remaining_today: Math.max(0, remaining - 1),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}