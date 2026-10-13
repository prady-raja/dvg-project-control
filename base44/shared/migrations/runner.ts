/**
 * The backfill runner (O-01). Base44 has no migration mechanism, so each
 * backfill is a pure function — rows in, patches out — and this runner applies
 * the patches in batches behind a dry run.
 *
 *   migration = { id, description, entities: { Name: filter }, plan(data) -> patches }
 *   patch     = { entity, id, data }
 *
 * Plans must be idempotent: run twice, the second plan is empty. A test per
 * migration proves it. After the move to Supabase the same plan functions run
 * as scripts; only the loading and writing below change.
 */

export const BATCH_SIZE = 50;
export const SAMPLE_SIZE = 8;

/** Keep only patches that would actually change the stored row. */
export const effectivePatch = (row, data) => {
  const changed = {};
  Object.entries(data || {}).forEach(([field, value]) => {
    const before = row?.[field];
    const same = JSON.stringify(before ?? null) === JSON.stringify(value ?? null);
    if (!same) changed[field] = value;
  });
  return changed;
};

/** Load every entity a migration asks for, through the data adapter's readAll. */
export async function loadMigrationData(db, migration, { max = 20000 } = {}) {
  const data = {};
  const truncated = [];
  for (const [entity, filter] of Object.entries(migration.entities || {})) {
    const res = await db.readAll(entity, filter || {}, { max });
    data[entity] = res.items;
    if (res.truncated) truncated.push(entity);
  }
  return { data, truncated };
}

/** Summarise a plan without writing: counts per entity and a few sample diffs. */
export function summarisePlan(plan, data) {
  const byId = new Map();
  Object.entries(data).forEach(([entity, rows]) => rows.forEach((row) => byId.set(`${entity}:${row.id}`, row)));
  const counts = {};
  const samples = [];
  plan.forEach((patch) => {
    counts[patch.entity] = (counts[patch.entity] || 0) + 1;
    if (samples.length < SAMPLE_SIZE) {
      const before = byId.get(`${patch.entity}:${patch.id}`) || {};
      samples.push({
        entity: patch.entity,
        id: patch.id,
        changes: Object.fromEntries(Object.keys(patch.data).map((field) => [field, { from: before[field] ?? null, to: patch.data[field] }])),
      });
    }
  });
  return { total: plan.length, counts, samples };
}

/**
 * Run one migration. `dryRun` (the default) plans and reports; a real run
 * writes in batches and records a MigrationRun row so what happened is on file.
 */
export async function runMigration(db, migration, { dryRun = true, actor = '', now = () => new Date().toISOString() } = {}) {
  const { data, truncated } = await loadMigrationData(db, migration);
  const plan = migration.plan(data)
    .map((patch) => {
      const row = (data[patch.entity] || []).find((item) => item.id === patch.id);
      return { ...patch, data: effectivePatch(row, patch.data) };
    })
    .filter((patch) => Object.keys(patch.data).length);

  const summary = summarisePlan(plan, data);
  const result = {
    migration: migration.id,
    description: migration.description,
    dry_run: dryRun,
    truncated,
    ...summary,
    written: 0,
    failed: 0,
    errors: [],
  };

  if (!dryRun && truncated.length) {
    result.errors.push(`Not run: ${truncated.join(', ')} was larger than one safe read. Run it in smaller scopes.`);
    result.failed = plan.length;
    return result;
  }

  if (!dryRun) {
    for (let i = 0; i < plan.length; i += BATCH_SIZE) {
      const batch = plan.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((patch) => db.update(patch.entity, patch.id, patch.data)));
      settled.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') result.written += 1;
        else {
          result.failed += 1;
          if (result.errors.length < 10) result.errors.push(`${batch[index].entity} ${batch[index].id}: ${outcome.reason?.message || 'failed'}`);
        }
      });
    }
    await db.create('MigrationRun', {
      migration: migration.id,
      dry_run: false,
      run_by: actor,
      run_at: now(),
      planned: plan.length,
      written: result.written,
      failed: result.failed,
      report: JSON.stringify({ counts: result.counts, samples: result.samples, errors: result.errors }).slice(0, 20000),
    });
  }
  return result;
}
