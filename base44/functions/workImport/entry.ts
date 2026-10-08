import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canManageProject, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { createdHistoryRows } from '../../shared/history.ts';
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

/**
 * CSV work import. Preview and import run the same validation, so what the
 * screen reports is what a confirmed import creates.
 *
 * Two things this function deliberately does not do: it never overwrites an
 * existing task, and it never invents a value the file left blank. A row that
 * cannot be resolved is refused rather than guessed at.
 */

const CHUNK = 25;

const decisionOf = (value) => {
  const text = String(value || '').toLowerCase();
  if (text === 'skip' || text === 'link' || text === 'import') return text;
  return '';
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

export default async function (req) {
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

    if (!projectId) throw fail('Choose the project this file belongs to.');
    if (!fileText) throw fail('Choose a CSV file to import.');
    if (fileText.length > MAX_IMPORT_TEXT) {
      throw fail('That file is larger than 1.5 MB. Split the work list into smaller files.');
    }

    // Permission is decided here, from the session — never from the browser.
    const rank = await resolveRank(base44, projectId, user);
    if (!canManageProject(rank)) {
      throw fail('Only a Project Manager or an administrator can import works.', 403);
    }

    const svc = base44.asServiceRole.entities;
    const ctx = await loadImportContext(base44, projectId);

    const file = readImportFile(fileText);
    if (file.error) throw fail(file.error);
    if (!file.total) throw fail('That file has a header row but no work rows.');
    if (file.total > MAX_IMPORT_ROWS) {
      throw fail(`That file has ${file.total} rows. One import takes up to ${MAX_IMPORT_ROWS}.`);
    }

    const validated = validateImportRows({ rows: file.rows, ctx, overrides, fileName });

    if (action === 'preview') {
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
          checksum,
          rows: file.total,
          columns: file.columns,
          unmapped: file.unmapped,
        },
        summary: validated.summary,
        rows: validated.rows,
        prior_batches: priorBatches.map((batch) => ({
          batch_ref: batch.batch_ref,
          imported_at: batch.imported_at,
          imported_by_name: batch.imported_by_name,
          source_file: batch.source_file,
          created_count: batch.created_count || 0,
          skipped_count: batch.skipped_count || 0,
          failed_count: batch.failed_count || 0,
          status: batch.status,
        })),
      });
    }

    if (action !== 'commit') return Response.json({ error: 'Unsupported action' }, { status: 400 });

    /* ------------------------------------------------------------------ commit */

    const plan = validated.rows.map((row) => {
      const asked = decisionOf(decisions[row.row_number]);
      return { row, decision: asked || (row.duplicate ? '' : 'import') };
    });

    const attention = plan.filter(
      ({ row, decision }) => (row.blocking && decision !== 'skip') || (!row.blocking && !decision),
    );
    if (attention.length) {
      return Response.json(
        {
          error: `${attention.length} row(s) still need attention. Correct them or mark them as skipped, then import again.`,
          attention: attention.map(({ row }) => ({
            row_number: row.row_number,
            issues: row.issues.map((issue) => issue.message),
          })),
        },
        { status: 400 },
      );
    }

    const badLink = plan.find(({ row, decision }) => decision === 'link' && !row.duplicate?.can_link);
    if (badLink) {
      throw fail(`Row ${badLink.row.row_number} cannot be linked — link only a confirmed match.`);
    }

    const memberIds = memberIdsOf(await activeMembers(base44, projectId));
    const startedAt = new Date();
    const batchRef = batchRefFor(startedAt);

    const batch = await svc.ImportBatch.create({
      batch_ref: batchRef,
      project_id: projectId,
      source_file: fileName,
      source_checksum: checksum,
      row_count: validated.rows.length,
      created_count: 0,
      skipped_count: 0,
      linked_count: 0,
      failed_count: 0,
      attention_count: validated.summary.blocking,
      status: 'Importing',
      imported_by_id: user.id,
      imported_by_name: actorName(user),
      imported_at: startedAt.toISOString(),
      member_ids: memberIds,
      report: [],
      notes: `CSV import of ${fileName}`,
    });

    const report = [];
    const entryFor = (row, outcome, extra = {}) => ({
      row_number: row.row_number,
      outcome,
      decision: extra.decision || '',
      task_id: extra.task_id || '',
      task_ref: extra.task_ref || '',
      name: row.resolved.name,
      villa_code: row.resolved.villa_code || (row.resolved.category === 'Site-Wide Work' ? 'Site-wide' : ''),
      discipline: row.resolved.discipline,
      contractor: row.resolved.contractor_name || '',
      missing: extra.missing || [],
      issues: row.issues.map((issue) => issue.message),
      note: extra.note || '',
    });

    const toCreate = [];
    for (const item of plan) {
      const { row, decision } = item;
      if (decision === 'skip') {
        report.push(entryFor(row, 'skipped', { decision, note: 'Marked as skipped before import' }));
        continue;
      }
      if (decision === 'link') {
        const targetId = String(links[row.row_number] || row.duplicate.task_id);
        const target = await getOne(svc.Task, targetId);
        if (!target || target.project_id !== projectId) {
          report.push(entryFor(row, 'failed', { decision, note: 'The task to link to was not found.' }));
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
          note: `Row ${row.row_number} of ${fileName} matched this task (${row.duplicate.reason}) — no new task created`,
        });
        report.push(
          entryFor(row, 'linked', {
            decision,
            task_id: target.id,
            task_ref: target.task_ref,
            note: `Matched ${target.task_ref} — no new task created`,
          }),
        );
        continue;
      }
      if (row.blocking) {
        report.push(entryFor(row, 'failed', { decision, note: 'Row still has unresolved problems' }));
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
              import_row_number: row.row_number,
            }),
          );

          const created = listAll(await svc.Task.bulkCreate(payloads));
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
          if (createdRows.length) await svc.TaskHistory.bulkCreate(createdRows);

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
            report.push(
              entryFor(row, task ? 'created' : 'failed', {
                decision: 'import',
                task_id: task?.id || '',
                task_ref: fix?.to || task?.task_ref || claims[index].ref,
                missing: missingInfoFor(row),
                note: fix ? `Reference re-issued after a simultaneous claim (was ${fix.from})` : '',
              }),
            );
          });
        } catch (error) {
          chunk.forEach((row) => {
            report.push(entryFor(row, 'failed', { decision: 'import', note: error.message }));
          });
        }
      }
    }

    const createdRows = report.filter((row) => row.outcome === 'created');
    const skippedRows = report.filter((row) => row.outcome === 'skipped');
    const linkedRows = report.filter((row) => row.outcome === 'linked');
    const failedRows = report.filter((row) => row.outcome === 'failed');
    const status = failedRows.length ? (createdRows.length ? 'Completed with exceptions' : 'Failed') : 'Completed';

    const updated = await svc.ImportBatch.update(batch.id, {
      created_count: createdRows.length,
      skipped_count: skippedRows.length,
      linked_count: linkedRows.length,
      failed_count: failedRows.length,
      status,
      report,
    });

    return Response.json({
      batch: updated,
      batch_ref: batchRef,
      counts: {
        rows: validated.rows.length,
        created: createdRows.length,
        skipped: skippedRows.length,
        linked: linkedRows.length,
        failed: failedRows.length,
        attention: validated.summary.blocking,
      },
      summary: validated.summary,
      created: createdRows,
      skipped: skippedRows,
      linked: linkedRows,
      failed: failedRows,
      by_villa: tally(
        createdRows.map((row) => ({ label: row.villa_code || 'Site-wide' })),
      ),
      by_contractor: tally(
        createdRows.map((row) => ({ label: row.contractor || 'Not assigned' })),
      ),
      needs_info: createdRows.filter((row) => (row.missing || []).length),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}