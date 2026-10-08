import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { activeMembers, isAppAdmin, resolveRole } from '../../shared/access.ts';
import { fail, getOne, listAll } from '../../shared/records.ts';
import { todayIst } from '../../shared/dashboardCore.ts';
import {
  AI_MODELS, BLOCKER_CATEGORIES, OPENAI_KEY_SECRET, TASK_STATUSES, buildDigest, callOpenAi,
  canUseAi, dailyBriefPrompt, loadAiSettings, matchTaskCandidates, meetingBriefPrompt,
  parseUpdatePrompt, askPrompt, recordUsage, systemPrompt, usageToday,
} from '../../shared/ai.ts';
import { loadProjectData, scopeFor } from '../../shared/projectData.ts';
import { buildProposal, mergeModelRefinement } from '../../shared/assist.ts';
import { canEditTasks, canManageProject } from '../../shared/access.ts';

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
/**
 * Long enough to cover a day's work at the site, short enough that a refusal is
 * not retried on every single message.
 */
const PROVIDER_COOLDOWN_MINUTES = 30;
const ASSISTANCE = 'edit_tasks';
const MANAGE = 'manage_project';

const newKey = () => {
  try {
    return `PR-${crypto.randomUUID()}`;
  } catch {
    return `PR-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
};

/**
 * The provider refused the last request recently — most often no credits. The
 * assistant keeps reading the words by rule and says why, instead of making the
 * same chargeable request again on every message.
 */
async function providerCoolingDown(svc, projectId) {
  const res = await svc.AiUsage.filter({ project_id: projectId, ok: false }, { sort: '-asked_at', limit: 3 });
  const rows = (res?.items || res || []).filter((row) => row.error);
  const recent = rows.find((row) => {
    const at = Date.parse(row.asked_at || '');
    return Number.isFinite(at) && Date.now() - at < PROVIDER_COOLDOWN_MINUTES * 60000;
  });
  return recent ? recent.error : '';
}

/** The model may only tidy what the rules already resolved. */
const refinePrompt = (text, proposal) => `A site message has already been read by deterministic rules into the proposal below.

Message: "${text}"

Proposal resolved by the rules (the only records that exist for this scope):
${JSON.stringify({
  intent: proposal.intent,
  villas: proposal.villas,
  questions: proposal.questions,
  candidates: proposal.candidates,
  actions: proposal.actions.map((action) => ({
    action_id: action.action_id,
    type: action.type,
    task_ref: action.review?.task_ref || '',
    task_name: action.review?.task_name || '',
    villa: action.review?.villa || '',
    scope: action.review?.scope_label || action.review?.scope_type || '',
    status: action.review?.task_status || '',
  })),
})}

Reply with JSON only, in this shape:
{
  "task_ref": "<one ref from the actions above that the message is really about, or empty if it is not clear>",
  "work_done": "<one clear line of what was done, in the engineer's own words, or empty>",
  "status": "<one of: ${TASK_STATUSES.join(', ')}, or empty if the message does not imply a status>",
  "blocker_category": "<one of: ${BLOCKER_CATEGORIES.join(', ')}, or empty>",
  "needs_clarification": ["<what cannot be determined from the message>"]
}
Never name a villa, a task, a person or a number that is not in the proposal above. Never state progress the message does not state.`;
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

    // Declared here, before every branch, so any branch may record its request.
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

    /* ------------------------------------------------- the AI site assistant */
    /*
     * The assistant is usable by the site team, not only by the roles the
     * administrator allowed to use the model: the reading of the message is done
     * by rule on the server. The model is only asked to tidy that reading, and
     * only when AI is permitted, configured and not out of budget.
     *
     * No message writes anything. A proposal is stored with an idempotency key,
     * the review screen confirms it, and the writes themselves are made by the
     * same guarded functions the ordinary screens use. Confirming twice is
     * answered from the stored proposal.
     */
    if (['assist', 'assist_confirm', 'assist_finish', 'assist_cancel'].includes(action)) {
      if (!scope.allowed) throw fail('You are not a member of this project.', 403);
      if (!scope.projectId) throw fail('Choose a project first.', 400);

      const proposalOf = async (key) => {
        const res = await svc.AiProposal.filter({ external_id: key }, { limit: 1 });
        return listAll(res)[0] || null;
      };
      const permissionForWrite = (type) =>
        (type === 'link_dependency' ? canManageProject(scope.rank) : canEditTasks(scope.rank));

      if (action !== 'assist') {
        const key = String(body?.key || '').trim();
        if (!key) throw fail('The proposal could not be identified.');
        const found = await proposalOf(key);
        if (!found) throw fail('That proposal is no longer available — ask again.', 404);
        if (found.user_id !== user.id) throw fail('Only the person who asked can answer this proposal.', 403);
        if (found.project_id !== scope.projectId) throw fail('That proposal belongs to a different project.', 403);

        if (action === 'assist_cancel') {
          if (found.status === 'Proposed') await svc.AiProposal.update(found.id, { status: 'Cancelled' });
          return Response.json({ key, status: found.status === 'Proposed' ? 'Cancelled' : found.status, written: 0 });
        }

        if (action === 'assist_finish') {
          const raw = Array.isArray(body?.results) ? body.results.slice(0, 40) : [];
          const results = raw.map((entry) => ({
            action_id: String(entry?.action_id || '').slice(0, 20),
            summary: String(entry?.summary || '').slice(0, 220),
            ok: entry?.ok === true,
            error: String(entry?.error || '').slice(0, 300),
            task_ref: String(entry?.task_ref || '').slice(0, 40),
            task_id: String(entry?.task_id || '').slice(0, 60),
          }));
          const written = results.filter((row) => row.ok).length;
          const status = results.length && written === results.length ? 'Applied' : written ? 'Partial' : 'Failed';
          await svc.AiProposal.update(found.id, { status, results, confirmed_at: new Date().toISOString() });
          return Response.json({
            key,
            status,
            attempted: results.length,
            written,
            results,
            failed: results.filter((row) => !row.ok),
            message: status === 'Applied'
              ? `${written} action(s) written and each one recorded in the change trail.`
              : `${written} of ${results.length} action(s) were written. The rest were refused — read the reasons and ask again if needed.`,
          });
        }

        // assist_confirm — an already-answered proposal is never applied twice.
        if (['Applied', 'Partial', 'Failed', 'Cancelled', 'Applying'].includes(found.status)) {
          return Response.json({
            key,
            status: found.status,
            replay: true,
            results: found.results || [],
            message: 'This proposal has already been confirmed, so nothing was written a second time.',
          });
        }

        const requested = (found.actions || []).filter(
          (item) => !Array.isArray(body?.action_ids) || body.action_ids.includes(item.action_id),
        );
        if (!requested.length) throw fail('Select at least one action to confirm.');

        const edits = body?.edits && typeof body.edits === 'object' ? body.edits : {};
        const accepted = [];
        const refused = [];
        for (const item of requested) {
          if (!permissionForWrite(item.type)) {
            refused.push({
              action_id: item.action_id,
              summary: item.summary,
              reason: item.type === 'link_dependency'
                ? 'Recording a dependency needs a Project Manager or an administrator.'
                : 'Your project role is read-only.',
            });
            continue;
          }
          if (item.guard?.task_id) {
            const task = await getOne(svc.Task, item.guard.task_id);
            if (!task || task.project_id !== scope.projectId || task.archived === true) {
              refused.push({ action_id: item.action_id, summary: item.summary, reason: 'That task no longer exists on this project.' });
              continue;
            }
            // Version check: a record changed after the review was prepared is
            // never overwritten from a stale screen.
            if (item.guard.updated_date && task.updated_date && task.updated_date !== item.guard.updated_date) {
              refused.push({
                action_id: item.action_id,
                summary: item.summary,
                reason: 'That task changed after this proposal was prepared — open it, check the new values, and confirm again.',
              });
              continue;
            }
          }
          const patch = edits[item.action_id] && typeof edits[item.action_id] === 'object' ? edits[item.action_id] : null;
          accepted.push(patch ? { ...item, payload: { ...item.payload, ...patch } } : item);
        }

        await svc.AiProposal.update(found.id, {
          status: accepted.length ? 'Applying' : 'Failed',
          results: refused,
          confirmed_at: new Date().toISOString(),
          error: accepted.length ? '' : 'Every selected action was refused.',
        });

        return Response.json({
          key,
          status: accepted.length ? 'Applying' : 'Failed',
          intent: found.intent,
          source: found.source,
          actions: accepted,
          refused,
        });
      }

      /* ------------------------------------------------------------ assist */
      const text = String(body?.text || '').trim().slice(0, MAX_QUESTION);
      if (!text) throw fail('Type what happened on site.');
      const key = String(body?.key || '').trim().slice(0, 80) || newKey();
      const already = await proposalOf(key);
      if (already && already.user_id === user.id) {
        return Response.json({
          key,
          replay: true,
          intent: already.intent,
          source: already.source,
          actions: already.actions || [],
          questions: already.questions || [],
          notes: [],
          villas: [],
          status: already.status,
          message: 'This proposal was already prepared; it is shown again and nothing new was stored.',
        });
      }

      const assistOptions = {
        projectId: scope.projectId,
        phaseId: String(body?.phaseId || ''),
        itemLimit: Math.min(Math.max(Number(settings.context_item_limit) || 40, 10), 120),
        includeDemo: false,
      };
      const data = await loadProjectData(base44, user, {
        projectIds: scope.projectIds,
        projectId: scope.projectId,
        asOf,
        dependencies: true,
        updates: true,
        snags: true,
      });
      const [areasRes, floorsRes, defaultsRes, packagesRes] = await Promise.all([
        svc.VillaArea.filter({ project_id: scope.projectId }, { sort: 'sort_order', limit: 500 }),
        svc.VillaFloor.filter({ project_id: scope.projectId }, { sort: 'level_order', limit: 300 }),
        svc.ContractorDefault.filter({ project_id: scope.projectId, active: true }, { limit: 300 }),
        svc.WorkPackage.filter({ project_id: scope.projectId, active: true }, { limit: 500 }),
      ]);

      const proposal = buildProposal({
        text,
        data: {
          ...data,
          areas: listAll(areasRes),
          floors: listAll(floorsRes),
          defaults: listAll(defaultsRes),
          workPackages: listAll(packagesRes),
        },
        scope: { projectId: scope.projectId, phaseId: assistOptions.phaseId },
        asOf,
        options: { rank: scope.rank, itemLimit: assistOptions.itemLimit },
      });

      const aiAllowed = canUseAi(settings, { appAdmin, rank: scope.rank, role });
      const budgetLeft = limit <= 0 || remaining > 0;
      const cooling = await providerCoolingDown(svc, scope.projectId);
      const worthRefining = aiAllowed.ok && configured && budgetLeft && !cooling
        && ['update_progress', 'unknown'].includes(proposal.intent)
        && (proposal.actions.length > 0 || proposal.candidates.length > 0);

      let finalProposal = proposal;
      let source = 'deterministic';
      let modelUsed = '';
      let providerError = cooling;

      if (worthRefining) {
        try {
          const { content, usage } = await callOpenAi({
            apiKey,
            model: settings.model,
            system: systemPrompt({
              user,
              settings,
              mode: 'assist',
              scopeLabel: `${data.ix.projectName(scope.projectId)}${assistOptions.phaseId ? ` / ${data.ix.phaseName(assistOptions.phaseId)}` : ''}`,
              asOf,
              digest: { note: 'No figures are sent for this request; the proposal is already resolved by the rules.' },
            }),
            user: refinePrompt(text, proposal),
            json: true,
            maxTokens: 600,
          });
          finalProposal = mergeModelRefinement(proposal, parseJson(content), TASK_STATUSES);
          source = 'ai';
          modelUsed = settings.model;
          await logUsage({
            ok: true,
            question: text.slice(0, 200),
            prompt_tokens: usage?.prompt_tokens || 0,
            completion_tokens: usage?.completion_tokens || 0,
          });
        } catch (error) {
          providerError = error.message;
          await logUsage({ ok: false, question: text.slice(0, 200), error: String(error.message).slice(0, 300) });
        }
      } else {
        await logUsage({ ok: true, question: text.slice(0, 200) });
      }

      const memberIds = listAll(await activeMembers(base44, scope.projectId)).map((member) => member.user_id).filter(Boolean);
      const stored = await svc.AiProposal.create({
        external_id: key,
        project_id: scope.projectId,
        phase_id: assistOptions.phaseId || '',
        user_id: user.id,
        user_name: user.full_name || user.email || '',
        message: text.slice(0, 1200),
        intent: finalProposal.intent,
        source,
        model: modelUsed,
        actions: finalProposal.actions,
        questions: finalProposal.questions,
        status: 'Proposed',
        results: [],
        proposed_at: new Date().toISOString(),
        member_ids: [...new Set(memberIds)],
      });

      return Response.json({
        ...finalProposal,
        key,
        proposal_id: stored.id,
        source,
        model: modelUsed,
        configured,
        ai_permitted: aiAllowed.ok,
        ai_reason: aiAllowed.ok ? '' : aiAllowed.reason,
        provider_error: providerError,
        remaining_today: remaining,
        ai_note: !configured
          ? 'No AI model is configured, so your words were read by rule on the server. Nothing was guessed, and nothing has been written — the proposal needs your confirmation.'
          : providerError
            ? `The AI provider is not answering (${providerError}), so your words were read by rule on the server. Nothing has been written — the proposal needs your confirmation.`
            : source === 'ai'
              ? 'The model tidied the reading of a proposal the rules had already resolved. Every record, value and permission was decided on the server. Nothing has been written yet.'
              : 'Read by rule on the server. Nothing has been written — the proposal needs your confirmation.',
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