/**
 * Model interpretation for the rows a deterministic reading could not settle.
 *
 * This is the only place a model touches an import, and its reach is deliberately
 * small: it may suggest a discipline, a work package, a reading of a room name, or
 * which existing task a row looks like. Every suggestion is checked against the
 * project's own registers before it is shown, and anything that is not in a
 * register is dropped. It never sets a value: a suggestion appears beside the
 * deterministic reading, and a person decides.
 *
 * When the provider is unavailable — no key, no credits, a refusal — the import
 * carries on with the deterministic reading alone. Deterministic work is never
 * reported as a model answer.
 */

import { recordUsage } from './ai.ts';
import { cleanText, listOf, looseKey } from './workImport.ts';

/** Rows sent to the provider in one call, to bound cost and exposure. */
export const AI_ROW_LIMIT = 12;

export const reconcilePrompt = ({ projectName, rows, disciplines, packages, rooms, tasks }) => `You are helping reconcile an uploaded construction work list with the live task register of ${projectName}.

For each listed row, say only what you can justify from the row's own words and the reference lists below.

Row fields: row (its number in the file), villa, description, floor, room, discipline_as_written, work_package_as_written, status_as_written, contractor_as_written, unclear (why the system could not settle it).
Reference lists are the ONLY allowed values:
disciplines: ${JSON.stringify(disciplines)}
work packages: ${JSON.stringify(packages)}
registered rooms: ${JSON.stringify(rooms)}
existing tasks that may be matched: ${JSON.stringify(tasks)}

Reply with JSON only:
{"rows":[{"row":<number>,"discipline":"<a discipline from the list, or empty>","work_package":"<a work package from the list, or empty>","room":"<a registered room from the list, or empty>","matches_task_ref":"<a task reference from the existing tasks list, or empty>","note":"<one short line: what the row appears to be, or what is missing>"}]}

Absolute rules:
- Never state or invent a villa number, room name, task reference, completion percentage, contractor, date or quantity that is not in the row or the lists above.
- Choose from the lists only. If nothing in a list fits, return an empty string for that field.
- A match may only be a task reference that appears in the existing tasks list.
- Description text in your note must be the row's own wording, shortened if needed.`;

/** The registers a suggestion may draw on, trimmed to what the rows need. */
function referenceLists(ctx, rows) {
  const villaIds = [...new Set(rows.map((row) => row.resolved.location_id).filter(Boolean))];
  const disciplines = [...new Set(rows.map((row) => row.resolved.discipline).filter(Boolean))];
  const rooms = ctx.areas
    .filter((area) => villaIds.includes(area.location_id))
    .map((area) => area.area_name);
  const packages = ctx.packages
    .filter((pkg) => disciplines.includes(pkg.discipline))
    .map((pkg) => `${pkg.discipline}: ${pkg.package_name}`);
  const candidates = new Map();
  rows.forEach((row) => {
    (row.reconcile?.candidates || []).forEach((candidate) => candidates.set(candidate.task_ref, `${candidate.task_ref} — ${candidate.name} (${candidate.villa}${candidate.area_label ? ` · ${candidate.area_label}` : ''})`));
  });
  return {
    disciplines,
    packages,
    rooms: [...new Set(rooms)],
    tasks: [...candidates.values()],
  };
}

/**
 * Suggestions for the rows that need them. Returns the hints keyed by row number,
 * plus a plain statement of whether the model was available — which is also what
 * is recorded on the batch.
 */
export async function aiHintsFor({ provider, base44, settings, rows, ctx, limit = AI_ROW_LIMIT }) {
  const needing = (rows || []).filter((row) => ['clarify', 'duplicate'].includes(row.reconcile?.outcome)).slice(0, limit);
  const status = { available: false, model: provider?.model || settings?.model || '', rows: needing.length, note: '', error: '', hints: new Map() };

  if (!needing.length) {
    status.note = 'No row needed an interpretation — the file was read entirely from its own columns.';
    return status;
  }
  if (!provider) {
    status.error = 'No AI provider is configured.';
    status.note = 'Interpretation was not requested: no AI provider is configured. The deterministic reading is shown.';
    return status;
  }
  if (settings && settings.enabled === false) {
    status.note = 'Interpretation is switched off in the AI settings. The deterministic reading is shown.';
    return status;
  }

  const lists = referenceLists(ctx, needing);
  const payload = needing.map((row) => ({
    row: row.row_number,
    villa: row.resolved.villa_code || '',
    description: row.resolved.name,
    floor: cleanText(row.values.floor),
    room: cleanText(row.values.area),
    discipline_as_written: cleanText(row.values.discipline),
    work_package_as_written: cleanText(row.values.work_package),
    status_as_written: cleanText(row.values.status),
    contractor_as_written: cleanText(row.values.contractor),
    unclear: [...(row.reconcile.clarifications || []), ...(row.issues || []).map((issue) => issue.message)].slice(0, 3),
  }));

  try {
    const answer = await provider.complete({
      system: 'You reconcile construction work lists with a task register. You only choose from the lists you are given and you never invent a value.',
      user: reconcilePrompt({ projectName: ctx.project.name, rows: payload, ...lists }),
      json: true,
      maxTokens: 1200,
    });
    const parsed = JSON.parse(answer.content || '{}');
    const byNumber = new Map((parsed?.rows || []).map((entry) => [Number(entry.row), entry]));

    // Every suggestion is checked against the register it claims to come from.
    const disciplines = new Set(ctx.disciplines.map((item) => item.code));
    const packages = new Map(ctx.packages.map((item) => [looseKey(item.package_name), item.package_name]));
    const rooms = new Map(ctx.areas.map((item) => [looseKey(item.area_name), item.area_name]));
    const tasks = new Map(ctx.tasks.filter((task) => task.task_ref).map((task) => [looseKey(task.task_ref), task.task_ref]));

    needing.forEach((row) => {
      const entry = byNumber.get(row.row_number);
      if (!entry) return;
      const suggestion = { note: cleanText(entry.note).slice(0, 240), discipline: '', work_package: '', room: '', task_ref: '', dropped: [] };
      const discipline = cleanText(entry.discipline);
      if (discipline) {
        const hit = [...disciplines].find((code) => looseKey(code) === looseKey(discipline));
        if (hit) suggestion.discipline = hit;
        else suggestion.dropped.push(`discipline “${discipline}” is not on the discipline list`);
      }
      const pkg = cleanText(entry.work_package);
      if (pkg) {
        const hit = packages.get(looseKey(pkg));
        if (hit) suggestion.work_package = hit;
        else suggestion.dropped.push(`work package “${pkg}” is not configured for this project`);
      }
      const room = cleanText(entry.room);
      if (room) {
        const hit = rooms.get(looseKey(room));
        if (hit) suggestion.room = hit;
        else suggestion.dropped.push(`room “${room}” is not in the room register`);
      }
      const ref = cleanText(entry.matches_task_ref);
      if (ref) {
        const hit = tasks.get(looseKey(ref));
        if (hit) suggestion.task_ref = hit;
        else suggestion.dropped.push(`task reference “${ref}” is not on this project`);
      }
      status.hints.set(row.row_number, suggestion);
    });

    status.available = true;
    status.note = `Interpretation was available for ${needing.length} row(s). Suggestions are shown beside the file's own words and are never applied by themselves.`;
    return status;
  } catch (error) {
    status.error = error?.message || 'The interpretation request failed.';
    status.note = /quota|credit|429|insufficient/i.test(status.error)
      ? 'OpenAI refused the request: the account has no remaining quota. The deterministic reading of every row is complete and unaffected.'
      : `Interpretation was not available (${status.error}). The deterministic reading of every row is complete and unaffected.`;
    return status;
  } finally {
    if (base44) {
      await recordUsage(base44.asServiceRole.entities, {
        user_id: (await base44.auth.me().catch(() => null))?.id || '',
        user_name: 'work import',
        day: new Date().toISOString().slice(0, 10),
        action: 'import_reconcile',
        project_id: ctx.project.id,
        model: status.model,
        question: `${needing.length} row(s) from an uploaded work list`,
        ok: status.available,
        error: status.error,
        asked_at: new Date().toISOString(),
      });
    }
  }
}

export const aiRowsWithSuggestions = (rows) => listOf(rows).filter((row) => row.reconcile?.ai_suggestion);