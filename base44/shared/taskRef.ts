/**
 * Permanent task references, e.g. IMG-A-0001. A project-wide common-work task
 * uses the GEN phase code.
 *
 * A reference is an issue-once identifier. It is therefore taken from an
 * append-only ledger (RefAllocation), never from the highest task that happens
 * to exist: deleting, archiving or correcting a task must not free its number,
 * and two people saving at the same moment must not receive the same one.
 *
 * What this platform does and does not guarantee
 * ----------------------------------------------
 * Entities on this platform have no compare-and-swap and no unique index: two
 * simultaneous writers on one key can both insert a row (measured — see
 * docs/REFERENCE_ALLOCATION.md). The ledger is therefore arbitrated rather than
 * locked: every claim is written first, read back, and the lowest row for a
 * number wins by creation order. A claim that lost takes the next free number,
 * and a created task's reference is checked once more afterwards, so a task
 * that lost a shared number is re-issued immediately instead of shipping a
 * duplicate. That converges on uniqueness from any interleaving; it is not the
 * same as an atomic allocator, and the migration note in
 * docs/REFERENCE_ALLOCATION.md gives the one-line Supabase replacement.
 */

const PAD = 4;
const CLAIM_ATTEMPTS = 6;
const BLOCK_LIMIT = 500;

const listOf = (res) => (Array.isArray(res) ? res : res?.items || []);

const pad = (sequence) => String(sequence).padStart(PAD, '0');

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const codeOf = (value, fallback) => String(value || fallback).toUpperCase().trim() || fallback;

/** `IMG-A-0004` -> `IMG-A-`; also accepts a bare prefix. */
export const prefixOfRef = (ref) => String(ref || '').replace(/\d+$/, '');

const sequenceOfRef = (ref) => {
  const match = String(ref || '').match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

/** Project + phase decide the prefix, and each prefix keeps its own counter. */
export async function resolvePrefix(client, projectId, phaseId) {
  const projectRes = await client.entities.Project.filter({ id: projectId }, { limit: 1 });
  const project = listOf(projectRes)[0];
  if (!project) throw new Error('Project not found');
  const projectCode = codeOf(project.code, 'PRJ');

  let phaseCode = 'GEN';
  if (phaseId) {
    const phaseRes = await client.entities.Phase.filter({ id: phaseId }, { limit: 1 });
    const phase = listOf(phaseRes)[0];
    if (phase && phase.code) phaseCode = codeOf(phase.code, 'GEN');
  }
  return { prefix: `${projectCode}-${phaseCode}-` };
}

/**
 * Every number already issued under a prefix: the ledger itself, the tasks
 * that still carry a reference (archived included) and the change trail of
 * tasks that have since been deleted. Reading all three is what makes a
 * previously issued reference survive the loss of its task record.
 */
async function collectUsed(client, prefix, projectId) {
  const pattern = `^${escapeRegex(prefix)}`;
  const [ledgerRes, taskRes, historyRes] = await Promise.all([
    client.entities.RefAllocation.filter({ prefix }, { limit: 5000, fields: ['sequence', 'task_ref'] }),
    client.entities.Task.filter(
      { task_ref: { $regex: pattern } },
      { limit: 5000, fields: ['task_ref'] },
    ),
    client.entities.TaskHistory.filter(
      { field_changed: 'task_ref', new_value: { $regex: pattern } },
      { limit: 5000, fields: ['new_value'] },
    ),
  ]);

  const used = new Set();
  let max = 0;
  const note = (ref) => {
    const sequence = sequenceOfRef(ref);
    if (sequence > 0) {
      used.add(sequence);
      if (sequence > max) max = sequence;
    }
  };
  listOf(ledgerRes).forEach((row) => note(row.task_ref || (row.sequence ? `${prefix}${pad(row.sequence)}` : '')));
  listOf(taskRes).forEach((row) => note(row.task_ref));
  listOf(historyRes).forEach((row) => note(row.new_value));
  return { used, max, projectId };
}

/** Oldest claim first; the tie-break is stable so every writer agrees. */
const byCreationOrder = (a, b) => {
  const left = String(a?.created_date || '');
  const right = String(b?.created_date || '');
  if (left !== right) return left < right ? -1 : 1;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
};

/**
 * One number: write the claim, read the number back, keep it only if this is
 * the earliest claim for it. Bounded, and the caller moves to the next number
 * when it loses.
 */
async function claimOne(client, prefix, claimId, sequence, meta) {
  const ref = `${prefix}${pad(sequence)}`;
  const row = await client.entities.RefAllocation.create({
    external_id: ref,
    prefix,
    sequence,
    task_ref: ref,
    claim_id: claimId,
    source: 'allocation',
    allocated_at: new Date().toISOString(),
    ...meta,
  });

  const rows = listOf(await client.entities.RefAllocation.filter({ prefix, sequence }, { limit: 20 }));
  if (!rows.length) return { ref, sequence, row };
  const winner = [...rows].sort(byCreationOrder)[0];
  return winner?.id === row.id ? { ref, sequence, row } : null;
}

/** A whole block in three calls, so a 40-villa assignment stays fast. */
async function claimBlock(client, prefix, claimId, start, count, meta) {
  const sequences = Array.from({ length: count }, (_, index) => start + index);
  const payload = sequences.map((sequence, index) => ({
    external_id: `${prefix}${pad(sequence)}`,
    prefix,
    sequence,
    task_ref: `${prefix}${pad(sequence)}`,
    claim_id: `${claimId}-${index}`,
    source: 'allocation',
    allocated_at: new Date().toISOString(),
    ...meta,
  }));

  const created = listOf(await client.entities.RefAllocation.bulkCreate(payload));
  const mineByRef = new Map(created.map((row) => [row.task_ref, row]));
  const check = listOf(
    await client.entities.RefAllocation.filter({ prefix, sequence: { $in: sequences } }, { limit: BLOCK_LIMIT }),
  );

  const groups = new Map();
  check.forEach((row) => groups.set(row.sequence, [...(groups.get(row.sequence) || []), row]));

  const accepted = [];
  const lost = [];
  sequences.forEach((sequence) => {
    const ref = `${prefix}${pad(sequence)}`;
    const mine = mineByRef.get(ref);
    if (!mine) {
      lost.push(sequence);
      return;
    }
    const group = groups.get(sequence) || [];
    const winner = group.length ? [...group].sort(byCreationOrder)[0] : mine;
    if (winner?.id === mine.id) accepted.push({ ref, sequence, row: mine });
    else lost.push(sequence);
  });

  return { accepted, lost, highest: sequences.length ? sequences[sequences.length - 1] : start };
}

/**
 * `count` permanent references for a project + phase, claimed together. Villa
 * Work uses this for its parent and every child in one go.
 */
export async function allocateTaskRefs(client, projectId, phaseId, count = 1, options = {}) {
  const { prefix } = await resolvePrefix(client, projectId, phaseId);
  const { max } = await collectUsed(client, prefix, projectId);

  const meta = {
    project_id: projectId,
    phase_id: phaseId || null,
    allocated_by_id: options.userId || '',
    allocated_by_name: options.userName || '',
    member_ids: options.memberIds || [],
  };
  const claimId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const block = await claimBlock(client, prefix, claimId, max + 1, count, meta);
  const results = [...block.accepted];
  let next = Math.max(block.highest + 1, max + count + 1);

  // A lost number is retried individually — the usual case is that another
  // writer reached the same number first.
  for (let i = 0; i < block.lost.length && i < CLAIM_ATTEMPTS; i += 1) {
    let claimed = null;
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS && !claimed; attempt += 1) {
      const taken = listOf(
        await client.entities.RefAllocation.filter({ prefix, sequence: next }, { limit: 5 }),
      );
      if (taken.length) {
        next += 1;
        continue;
      }
      claimed = await claimOne(client, prefix, `${claimId}-r${i}`, next, meta);
      if (!claimed) next += 1;
    }
    if (!claimed) throw new Error('Could not allocate the next task reference. Please try again.');
    results.push(claimed);
    next = claimed.sequence + 1;
  }

  results.sort((a, b) => a.sequence - b.sequence);
  return results;
}

export const allocateTaskRef = async (client, projectId, phaseId, options) =>
  (await allocateTaskRefs(client, projectId, phaseId, 1, options))[0];

/** The next reference without consuming it — for showing, never for issuing. */
export async function peekTaskRef(client, projectId, phaseId) {
  const { prefix } = await resolvePrefix(client, projectId, phaseId);
  const { max } = await collectUsed(client, prefix, projectId);
  return `${prefix}${pad(max + 1)}`;
}

/** Records which task consumed a claimed number. Numbers are never released. */
export async function attachTaskRefs(client, pairs) {
  const updates = (pairs || [])
    .filter((pair) => pair?.claim?.row?.id && pair?.taskId)
    .map((pair) => ({ id: pair.claim.row.id, task_id: pair.taskId }));
  if (!updates.length) return 0;
  await client.entities.RefAllocation.bulkUpdate(updates);
  return updates.length;
}

/**
 * Final guard on a created task: if two simultaneous writers did claim the
 * same number, the task that was created earlier keeps it and the other is
 * re-issued straight away, so no duplicate reference is ever left in place.
 * Returns the corrections so the caller can record them in the trail.
 */
export async function resolveRefCollisions(client, projectId, tasks) {
  const list = (tasks || []).filter((task) => task?.task_ref);
  if (!list.length) return [];

  const refs = [...new Set(list.map((task) => task.task_ref))];
  const found = listOf(await client.entities.Task.filter({ task_ref: { $in: refs } }, { limit: BLOCK_LIMIT }));

  const groups = new Map();
  found.forEach((task) => groups.set(task.task_ref, [...(groups.get(task.task_ref) || []), task]));

  const corrections = [];
  for (const [ref, group] of groups) {
    if (group.length < 2) continue;
    const ordered = [...group].sort(byCreationOrder);
    const losers = ordered.slice(1);
    for (const loser of losers) {
      const phaseId = loser.phase_id || null;
      const fresh = await allocateTaskRefs(client, projectId || loser.project_id, phaseId, 1, {
        memberIds: loser.member_ids || [],
        userName: 'Reference allocator',
      });
      const replacement = fresh[0];
      await client.entities.Task.update(loser.id, { task_ref: replacement.ref });
      await attachTaskRefs(client, [{ claim: replacement, taskId: loser.id }]);
      corrections.push({ taskId: loser.id, from: ref, to: replacement.ref, projectId: loser.project_id });
    }
  }
  return corrections;
}