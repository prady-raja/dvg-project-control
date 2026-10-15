import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canManageProject, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { createdHistoryRows } from '../../shared/history.ts';
import { COMPLETION_NOTE } from '../../shared/taskWriteRules.ts';
import { allocateTaskRefs, attachTaskRefs, resolveRefCollisions } from '../../shared/taskRef.ts';
import { actorName, fail, getOne, listAll } from '../../shared/records.ts';
import {
  MAX_IMPORT_ROWS,
  MAX_IMPORT_TEXT,
  buildTaskPayload,
  loadImportContext,
  missingInfoFor,
  readImportFile,
  validateImportRows,
} from '../../shared/workImport.ts';
import { reconcileRows } from '../../shared/reconcile.ts';
import { aiHintsFor } from '../../shared/reconcileAi.ts';
import { reconciledWorkbook } from '../../shared/reconcileSheets.ts';
import { applyTaskUpdate } from '../../shared/reconcileApply.ts';
import { loadAiSettings, providerFor, usageToday } from '../../shared/ai.ts';
import { withLog } from '../../shared/log.ts';
import { addCounts } from '../../shared/importChunks.ts';
import { bulkCreateOnce, withBackoff } from '../../shared/writeRetry.ts';

/**
 * Work import — Excel or CSV in, reconciled and reviewed changes out.
 *
 * Nothing is written by an upload. A preview reads the file, resolves every value
 * against the project's own registers, compares each row with the work already on
 * the register and states what it would create, change or leave alone. Only the
 * rows a person has decided on are written, and each agreed change to an existing
 * task goes through the same permission, baseline and audit rules as the editor.
 *
 * Two things this function deliberately never does: it never overwrites a value
 * the file left blank, and it never invents the value of a villa, room, reference,
 * percentage, contractor or date.
 */

const CHUNK = 25;

/** The decisions a reviewer can make about one row. */
const DECISIONS = ['import', 'update', 'link', 'skip', 'defer'];

const decisionOf = (value) => {
  const text = String(value || '').toLowerCase();
  return DECISIONS.includes(text) ? text : '';
};

const tally = (rows) => {
  const counts = new Map();
  rows.forEach((row) => counts.set(row.label, (counts.get(row.label) || 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

const batchRefFor = (date) => {
  const iso = date.toISOString();
  return `IMP-${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 16).replace(':', '')}`;
};

/**
 * The comparison needs the stored value of every field a file may change, so the
 * tasks a row matched are read in full — and only those, so scanning a large
 * register stays cheap. The reconciliation then runs again against the full
 * records, so an "existing" figure in the review screen is the record's own.
 */
async function reconcileWithDetails({ svc, validated, ctx, links }) {
  const first = reconcileRows({ rows: validated.rows, ctx, links });
  const ids = [...new Set([
    ...first.rows.map((row) => row.reconcile.match.task_id).filter(Boolean),
    ...[...(ctx.alreadyImported?.values() || [])].map((prior) => prior.task_id),
  ])];
  if (!ids.length) return first;

  const full = [];
  for (let i = 0; i < ids.length; i += 100) {
    full.push(...listAll(await svc.Task.filter({ id: { $in: ids.slice(i, i + 100) } }, { limit: 100 })));
  }
  const byId = new Map(full.map((task) => [task.id, task]));
  ctx.tasks = ctx.tasks.map((task) => byId.get(task.id) || task);
  return reconcileRows({ rows: validated.rows, ctx, links });
}

/**
 * Tasks written by earlier batches of the same file fingerprint, by source row.
 * A row that two different tasks claim is marked ambiguous and never auto-matched.
 */
async function priorRowsOf(svc, ctx, projectId, checksum) {
  const prior = new Map();
  if (!checksum) return prior;
  const batches = listAll(await svc.ImportBatch.filter({ project_id: projectId, source_checksum: checksum }, { limit: 200 }));
  const batchRefById = new Map(batches.map((batch) => [batch.id, batch.batch_ref]));
  ctx.tasks.forEach((task) => {
    if (!task.import_batch_id || !batchRefById.has(task.import_batch_id)) return;
    const rowNumber = Number(task.import_row_number);
    if (!Number.isFinite(rowNumber) || rowNumber <= 0) return;
    const existing = prior.get(rowNumber);
    if (existing && existing.task_id !== task.id) {
      existing.ambiguous = true;
      return;
    }
    prior.set(rowNumber, { task_id: task.id, batch_id: task.import_batch_id, batch_ref: batchRefById.get(task.import_batch_id) });
  });
  return prior;
}

async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'preview');
    const projectId = String(body?.project_id || '');
    const fileText = String(body?.file_text || '');
    const fileName = String(body?.file_name || '').trim() || 'work-list.csv';
    const checksum = String(body?.checksum || '');
    const overrides = body?.overrides && typeof body.overrides === 'object' ? body.overrides : {};
    const decisions = body?.decisions && typeof body.decisions === 'object' ? body.decisions : {};
    const links = body?.links && typeof body.links === 'object' ? body.links : {};
    const reasons = body?.reasons && typeof body.reasons === 'object' ? body.reasons : {};
    const edits = body?.edits && typeof body.edits === 'object' ? body.edits : {};
    // The record version the review screen compared against, row by row. A task that
    // has moved since that comparison is refused rather than written over.
    const expectedDates = body?.expected && typeof body.expected === 'object' ? body.expected : {};
    // Which worksheet the rows were read from, and the row each one sits on. Both
    // are provenance only — the file text is still the single source of truth, and
    // a row number list that does not line up is ignored rather than trusted.
    const sourceSheet = String(body?.source_sheet || '').trim().slice(0, 80);
    const rowNumbers = Array.isArray(body?.row_numbers) ? body.row_numbers.slice(0, MAX_IMPORT_ROWS + 1) : [];
    // A big file arrives in chunks of rows under one batch: the first commit creates
    // the batch, later ones name it with batch_id and add to it.
    const batchId = String(body?.batch_id || '');
    const chunkIndex = Math.max(Number(body?.chunk_index) || 0, 0);
    const chunkTotal = Math.max(Number(body?.chunk_total) || 1, 1);
    const totalRows = Math.max(Number(body?.total_rows) || 0, 0);
    const useAi = body?.use_ai === true;
    const aiNote = String(body?.ai_status || '').slice(0, 400);

    if (!projectId) throw fail('Choose the project this file belongs to.');
    if (!fileText) throw fail('Choose a CSV file to import.');
    if (fileText.length > MAX_IMPORT_TEXT) {
      throw fail('That file is larger than 1.5 MB. Split the work list into smaller files.');
    }

    // Permission is decided here, from the session — never from the browser.
    const rank = await resolveRank(base44, projectId, user);
    if (!canManageProject(rank)) {
      throw fail('Only a Project Editor or an administrator can import works.', 403);
    }

    const svc = base44.asServiceRole.entities;
    const ctx = await loadImportContext(base44, projectId);

    const file = readImportFile(fileText, { rowNumbers });
    if (file.error) throw fail(file.error);
    if (!file.total) throw fail('That file has a header row but no work rows.');
    if (file.total > MAX_IMPORT_ROWS) {
      throw fail(`That file has ${file.total} rows. One import takes up to ${MAX_IMPORT_ROWS}.`);
    }

    // Work an earlier run of this same file (same project, same fingerprint) already
    // wrote, keyed by source row. Read-only: it only lets a repeat run recognise it.
    ctx.alreadyImported = await priorRowsOf(svc, ctx, projectId, checksum);

    const validated = validateImportRows({ rows: file.rows, ctx, overrides, fileName });
    const reconciled = await reconcileWithDetails({ svc, validated, ctx, links });

    /* ------------------------------------------------------------------ preview */

    if (action === 'preview') {
      // Interpretation is asked for deliberately, for one preview at a time: every
      // override re-runs the preview, and a provider call on each of those would
      // be both costly and pointless.
      let ai = {
        available: false,
        requested: useAi,
        note: 'Interpretation was not requested. Press “Interpret unclear rows” to ask OpenAI about the rows the columns could not settle.',
        error: '',
        model: '',
        rows_helped: 0,
      };
      if (useAi) {
        const settings = await loadAiSettings(svc);
        const provider = providerFor(base44, settings);
        if (!provider) {
          ai = { ...ai, requested: true, error: 'No AI provider is configured.', note: 'No AI provider is configured on this app, so interpretation was skipped. Every row was read from its own columns.' };
        } else {
          const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const used = await usageToday(svc, user.id, day);
          const limit = Number(settings.daily_request_limit) || 40;
          if (used >= limit) {
            ai = { ...ai, requested: true, note: `The daily AI request limit (${limit}) is reached for today. Every row was read from its own columns.` };
          } else {
            const result = await aiHintsFor({
              provider,
              base44,
              settings,
              rows: reconciled.rows,
              ctx,
            });
            ai = {
              available: result.available,
              requested: true,
              note: result.note,
              error: result.error,
              model: result.model || settings.model,
              rows_helped: result.hints.size,
            };
            reconciled.rows.forEach((row) => {
              row.reconcile.ai_suggestion = result.hints.get(row.row_number) || null;
            });
          }
        }
      }

      const priorBatches = checksum
        ? listAll(
          await svc.ImportBatch.filter(
            { project_id: projectId, source_checksum: checksum },
            { sort: '-imported_at', limit: 5 },
          ),
        )
        : [];

      return Response.json({
        project: { id: ctx.project.id, name: ctx.project.name, code: ctx.project.code },
        file: {
          name: fileName,
          sheet: sourceSheet,
          checksum,
          rows: file.total,
          columns: file.columns,
          unmapped: file.unmapped,
        },
        summary: validated.summary,
        reconciliation: reconciled.summary,
        rows: reconciled.rows,
        ai,
        workbook: reconciledWorkbook({
          rows: reconciled.rows,
          ctx,
          file: { name: fileName, sheet: sourceSheet },
          batchRef: '',
          userName: actorName(user),
        }),
        prior_batches: priorBatches.map((batch) => ({
          batch_ref: batch.batch_ref,
          imported_at: batch.imported_at,
          imported_by_name: batch.imported_by_name,
          source_file: batch.source_file,
          created_count: batch.created_count || 0,
          updated_count: batch.updated_count || 0,
          skipped_count: batch.skipped_count || 0,
          failed_count: batch.failed_count || 0,
          status: batch.status,
        })),
      });
    }

    if (action !== 'commit') return Response.json({ error: 'Unsupported action' }, { status: 400 });

    /* ------------------------------------------------------------------ commit */

    // A row that already holds the information needs no decision; a row that would
    // change an existing task is only written when a person accepts it.
    const plan = reconciled.rows.map((row) => {
      const outcome = row.reconcile.outcome;
      // Written by an earlier run of this file: never written again, whatever was asked.
      const asked = row.reconcile.match?.via === 'already_imported' ? 'unchanged' : decisionOf(decisions[row.row_number]);
      const fallback = outcome === 'create' ? 'import' : outcome === 'unchanged' ? 'unchanged' : '';
      return { row, decision: asked || fallback, outcome };
    });

    const attention = plan.filter(({ decision }) => !decision);
    if (attention.length) {
      return Response.json(
        {
          error: `${attention.length} row(s) still need a decision. Accept, reject or defer them, then import again.`,
          attention: attention.map(({ row }) => ({
            row_number: row.row_number,
            issues: [
              ...(row.reconcile.clarifications || []),
              ...row.issues.map((issue) => issue.message),
            ],
          })),
        },
        { status: 400 },
      );
    }

    const badLink = plan.find(({ row, decision }) => decision === 'link' && !row.duplicate?.can_link && !row.reconcile.match.task_id);
    if (badLink) {
      throw fail(`Row ${badLink.row.row_number} cannot be linked — link only a task you have chosen.`);
    }

    const memberIds = memberIdsOf(await activeMembers(base44, projectId));
    const startedAt = new Date();
    const classification = reconciled.summary;

    let previousBatch = null;
    if (batchId) {
      previousBatch = await getOne(svc.ImportBatch, batchId);
      if (!previousBatch || previousBatch.project_id !== projectId || previousBatch.imported_by_id !== user.id) {
        throw fail('That import batch was not found.', 404);
      }
      if (previousBatch.status !== 'Importing') throw fail('That import has already finished.');
    }
    const batchRef = previousBatch ? previousBatch.batch_ref : batchRefFor(startedAt);

    const batch = previousBatch || await svc.ImportBatch.create({
      batch_ref: batchRef,
      project_id: projectId,
      source_file: fileName,
      source_sheet: sourceSheet || null,
      source_checksum: checksum,
      row_count: totalRows || reconciled.rows.length,
      created_count: 0,
      updated_count: 0,
      unchanged_count: 0,
      skipped_count: 0,
      deferred_count: 0,
      linked_count: 0,
      failed_count: 0,
      attention_count: validated.summary.blocking,
      classification,
      ai_status: aiNote || null,
      status: 'Importing',
      imported_by_id: user.id,
      imported_by_name: actorName(user),
      imported_at: startedAt.toISOString(),
      member_ids: memberIds,
      report: [],
      notes: sourceSheet ? `Excel import of ${fileName} (worksheet ${sourceSheet})` : `CSV import of ${fileName}`,
    });

    const report = [];
    const entryFor = (row, outcome, extra = {}) => ({
      row_number: row.row_number,
      sheet: sourceSheet || '',
      proposed: row.reconcile.outcome,
      classification: row.reconcile.label,
      outcome,
      decision: extra.decision || '',
      task_id: extra.task_id || '',
      task_ref: extra.task_ref || row.reconcile.match.task_ref || '',
      name: row.resolved.name,
      villa_code: row.resolved.villa_code || (row.resolved.category === 'Site-Wide Work' ? 'Site-wide' : ''),
      discipline: row.resolved.discipline,
      contractor: row.resolved.contractor_name || '',
      changed: extra.changed || [],
      missing: extra.missing || [],
      issues: row.issues.slice(0, 3).map((issue) => String(issue.message).slice(0, 160)),
      note: String(extra.note || '').slice(0, 240),
    });

    const applied = {};
    const toCreate = [];
    for (const item of plan) {
      const { row, decision } = item;
      const rec = row.reconcile;

      if (decision === 'skip') {
        report.push(entryFor(row, 'rejected', { decision, note: 'Rejected on the review screen — nothing was written' }));
        applied[row.row_number] = { outcome: 'rejected', note: 'Rejected on the review screen' };
        continue;
      }
      if (decision === 'defer') {
        report.push(entryFor(row, 'deferred', { decision, note: 'Deferred for a later review — nothing was written' }));
        applied[row.row_number] = { outcome: 'deferred', note: 'Deferred for a later review' };
        continue;
      }
      if (decision === 'unchanged') {
        report.push(entryFor(row, 'unchanged', { decision, note: 'The register already held this information — nothing was written' }));
        applied[row.row_number] = { outcome: 'unchanged', note: 'The register already held this information' };
        continue;
      }
      if (decision === 'link') {
        const targetId = String(links[row.row_number] || rec.match.task_id || row.duplicate?.task_id || '');
        const target = await getOne(svc.Task, targetId);
        if (!target || target.project_id !== projectId) {
          report.push(entryFor(row, 'failed', { decision, note: 'The task to link to was not found.' }));
          applied[row.row_number] = { outcome: 'failed', note: 'The task to link to was not found.' };
          continue;
        }
        await svc.TaskHistory.create({
          task_id: target.id,
          project_id: projectId,
          member_ids: memberIds,
          change_type: 'Import Link',
          field_changed: 'import_batch',
          old_value: '',
          new_value: batchRef,
          changed_by_id: user.id,
          changed_by_name: actorName(user),
          changed_at: new Date().toISOString(),
          note: `Row ${row.row_number} of ${fileName} matched this task (${rec.match.reason || row.duplicate?.reason}) — no new task created and nothing changed`,
        });
        report.push(
          entryFor(row, 'linked', {
            decision,
            task_id: target.id,
            task_ref: target.task_ref,
            note: `Matched ${target.task_ref} — nothing on it was changed`,
          }),
        );
        applied[row.row_number] = { outcome: 'linked', note: `Matched ${target.task_ref} — nothing changed` };
        continue;
      }

      if (decision === 'update') {
        const taskId = rec.match.task_id || String(links[row.row_number] || '');
        const task = taskId ? await getOne(svc.Task, taskId) : null;
        if (!task || task.project_id !== projectId) {
          report.push(entryFor(row, 'failed', { decision, note: 'That row is not an agreed change to a task on this project.' }));
          applied[row.row_number] = { outcome: 'failed', note: 'No matching task on this project' };
          continue;
        }
        try {
          // Revalidated here, against the stored record, immediately before it is
          // written — never from the browser's own comparison.
          const result = await applyTaskUpdate({
            base44,
            svc,
            task,
            row,
            user,
            memberIds,
            rank,
            reason: String(reasons[row.row_number] || '').trim(),
            edits: edits[row.row_number] || {},
            batchRef,
            fileName,
            expected: String(expectedDates[row.row_number] || rec.match.updated_date || ''),
          });
          report.push(
            entryFor(row, result.outcome, {
              decision,
              task_id: task.id,
              task_ref: task.task_ref,
              note: result.note,
              changed: result.changed,
            }),
          );
          applied[row.row_number] = { outcome: result.outcome, note: result.note };
        } catch (error) {
          report.push(entryFor(row, 'failed', { decision, task_id: task.id, task_ref: task.task_ref, note: error.message }));
          applied[row.row_number] = { outcome: 'failed', note: error.message };
        }
        continue;
      }

      // Everything left is offered as a new task — but only while the register still
      // reads the row that way. A repeat of a confirmation that has already run, or a
      // tab left open while someone else changed the work, arrives with an "import"
      // decision against a row that is now a change to an existing task: that row is
      // refused and asked for again rather than written a second time.
      // A person may deliberately import a POSSIBLE DUPLICATE as new work (a similar
      // task in a different room is not the same work) — but never a row this very
      // file already wrote on an earlier run, which would make a second copy.
      const writtenByThisFile = ctx.alreadyImported?.has(row.row_number) === true;
      const deliberateNew = rec.outcome === 'duplicate' && decision === 'import' && !writtenByThisFile && !row.duplicate?.in_file;
      if (rec.outcome !== 'create' && !deliberateNew) {
        const note = `The register now reads this row as ${rec.label} — nothing was written. Review the row again and decide it as it now stands.`;
        report.push(entryFor(row, 'failed', { decision, note }));
        applied[row.row_number] = { outcome: 'failed', note };
        continue;
      }
      if (row.blocking) {
        report.push(entryFor(row, 'failed', { decision, note: 'Row still has unresolved problems' }));
        applied[row.row_number] = { outcome: 'failed', note: 'Row still has unresolved problems' };
        continue;
      }
      toCreate.push(row);
    }

    // Grouped by phase so each group keeps its own reference counter, then
    // written in blocks — sequential, and a failing block cannot take the rest
    // of the file down with it.
    const groups = new Map();
    toCreate.forEach((row) => {
      const key = row.resolved.phase_id || 'none';
      groups.set(key, [...(groups.get(key) || []), row]);
    });

    for (const groupRows of groups.values()) {
      for (let i = 0; i < groupRows.length; i += CHUNK) {
        const chunk = groupRows.slice(i, i + CHUNK);
        try {
          const phaseId = chunk[0].resolved.phase_id || null;
          const claims = await allocateTaskRefs(base44.asServiceRole, projectId, phaseId, chunk.length, {
            memberIds,
            userId: user.id,
            userName: actorName(user),
          });

          const payloads = chunk.map((row, index) =>
            buildTaskPayload(row, {
              task_ref: claims[index].ref,
              created_by_name: actorName(user),
              updated_by_name: actorName(user),
              is_demo: false,
              archived: false,
              is_villa_work_parent: false,
              member_ids: memberIds,
              import_batch_id: batch.id,
              import_source_file: fileName,
              // The worksheet is stored, not merely shown: a task can always be
              // traced back to the sheet and the row it came from.
              import_source_sheet: sourceSheet || null,
              import_row_number: row.row_number,
            }),
          );

          // Rate limits are waited out; a retry first looks for rows already stored
          // under this batch, so nothing is written twice.
          const created = listAll(await bulkCreateOnce({
            create: (remaining) => svc.Task.bulkCreate(remaining),
            findStored: async () => listAll(await svc.Task.filter({ project_id: projectId, import_batch_id: batch.id }, { limit: 500 })),
            payloads,
            keyOf: (item) => item.import_row_number,
          }));
          const byRef = new Map(created.map((task) => [task.task_ref, task]));

          await attachTaskRefs(
            base44.asServiceRole,
            chunk.map((row, index) => ({ claim: claims[index], taskId: byRef.get(claims[index].ref)?.id })),
          );

          // A reference claimed by two simultaneous writers is re-issued here,
          // never renumbered silently: the correction is reported and recorded.
          const corrections = await resolveRefCollisions(base44.asServiceRole, projectId, created);

          const createdRows = createdHistoryRows({
            tasks: created,
            projectId,
            memberIds,
            user,
            note: `Imported from ${fileName} (batch ${batchRef})`,
          });
          if (createdRows.length) await withBackoff(() => svc.TaskHistory.bulkCreate(createdRows));

          // A reported completion carries its own trail row: the source's own word,
          // the operational status, and the fact that nobody in this session claims
          // to have done the work.
          const reported = created.filter((task) => task.needs_completion_verification === true);
          if (reported.length) {
            await svc.TaskHistory.bulkCreate(reported.map((task) => ({
              task_id: task.id,
              project_id: projectId,
              member_ids: memberIds,
              change_type: 'Import Completion Reported',
              field_changed: 'status',
              old_value: task.source_status || '',
              new_value: `${task.status} — ${COMPLETION_NOTE}`,
              changed_by_id: user.id,
              changed_by_name: actorName(user),
              changed_at: new Date().toISOString(),
              note: `The source file reports this work complete. Imported as ${task.status}; the completion must be verified by an authorised person, and approved or closed by a different one.`,
            })));
          }

          if (corrections.length) {
            await svc.TaskHistory.bulkCreate(
              corrections.map((fix) => ({
                task_id: fix.taskId,
                project_id: projectId,
                member_ids: memberIds,
                change_type: 'Reference Correction',
                field_changed: 'task_ref',
                old_value: fix.from,
                new_value: fix.to,
                changed_by_id: user.id,
                changed_by_name: actorName(user),
                changed_at: new Date().toISOString(),
                note: 'Simultaneous claim during import — re-issued the next free reference',
              })),
            );
          }

          chunk.forEach((row, index) => {
            const task = byRef.get(claims[index].ref);
            const fix = task ? corrections.find((correction) => correction.taskId === task.id) : null;
            const note = fix ? `Reference re-issued after a simultaneous claim (was ${fix.from})` : '';
            report.push(
              entryFor(row, task ? 'created' : 'failed', {
                decision: 'import',
                task_id: task?.id || '',
                task_ref: fix?.to || task?.task_ref || claims[index].ref,
                missing: missingInfoFor(row),
                note,
              }),
            );
            applied[row.row_number] = { outcome: task ? 'created' : 'failed', note: note || (task ? 'Created' : 'The task could not be written') };
          });
        } catch (error) {
          chunk.forEach((row) => {
            report.push(entryFor(row, 'failed', { decision: 'import', note: error.message }));
            applied[row.row_number] = { outcome: 'failed', note: error.message };
          });
        }
      }
    }

    const of = (outcome) => report.filter((row) => row.outcome === outcome);
    const createdRows = of('created');
    const updatedRows = of('updated');
    const unchangedRows = of('unchanged');
    const skippedRows = of('rejected');
    const deferredRows = of('deferred');
    const linkedRows = of('linked');
    const failedRows = of('failed');

    // Counts and the per-row report add up across chunks; the batch only finishes on the last one.
    // A resumed run retries the rows an earlier attempt could not write, so its
    // failures are not carried forward; everything it did write is kept.
    const resuming = body?.resume === true && previousBatch && chunkIndex === 0;
    const before = resuming
      ? {
        ...previousBatch,
        failed_count: 0,
        report: (Array.isArray(previousBatch.report) ? previousBatch.report : []).filter((entry) => entry.outcome !== 'failed'),
      }
      : (previousBatch || {});
    const total = (key, now) => (Number(before[key]) || 0) + now;
    const failedTotal = total('failed_count', failedRows.length);
    const writtenTotal = total('created_count', createdRows.length) + total('updated_count', updatedRows.length);
    const lastChunk = chunkIndex >= chunkTotal - 1;
    const status = !lastChunk
      ? 'Importing'
      : failedTotal ? (writtenTotal ? 'Completed with exceptions' : 'Failed') : 'Completed';

    const updated = await svc.ImportBatch.update(batch.id, {
      created_count: total('created_count', createdRows.length),
      updated_count: total('updated_count', updatedRows.length),
      unchanged_count: total('unchanged_count', unchangedRows.length),
      skipped_count: total('skipped_count', skippedRows.length),
      deferred_count: total('deferred_count', deferredRows.length),
      linked_count: total('linked_count', linkedRows.length),
      failed_count: failedTotal,
      attention_count: total('attention_count', validated.summary.blocking),
      classification: addCounts(before.classification || {}, classification),
      status,
      report: [...(Array.isArray(before.report) ? before.report : []), ...report],
    });

    return Response.json({
      batch: updated,
      batch_id: updated.id,
      batch_ref: batchRef,
      chunk_index: chunkIndex,
      chunk_total: chunkTotal,
      counts: {
        rows: reconciled.rows.length,
        created: createdRows.length,
        updated: updatedRows.length,
        unchanged: unchangedRows.length,
        rejected: skippedRows.length,
        deferred: deferredRows.length,
        linked: linkedRows.length,
        failed: failedRows.length,
        attention: validated.summary.blocking,
      },
      summary: validated.summary,
      reconciliation: classification,
      ai_status: aiNote,
      created: createdRows,
      updated: updatedRows,
      unchanged: unchangedRows,
      rejected: skippedRows,
      deferred: deferredRows,
      linked: linkedRows,
      failed: failedRows,
      by_villa: tally(createdRows.concat(updatedRows).map((row) => ({ label: row.villa_code || 'Site-wide' }))),
      by_contractor: tally(createdRows.map((row) => ({ label: row.contractor || 'Not assigned' }))),
      needs_info: createdRows.filter((row) => (row.missing || []).length),
      workbook: reconciledWorkbook({
        rows: reconciled.rows,
        ctx,
        file: { name: fileName, sheet: sourceSheet },
        batchRef,
        userName: actorName(user),
        applied,
        decisions,
        classification,
      }),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('workImport', handler);
