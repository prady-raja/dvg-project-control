import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isAppAdmin } from '../../shared/access.ts';
import { createDb } from '../../shared/db.ts';
import { MIGRATIONS, migrationById } from '../../shared/migrations/index.ts';
import { runMigration } from '../../shared/migrations/runner.ts';
import { assignNamesMigration } from '../../shared/migrations/userMatching.ts';
import { actorName, fail } from '../../shared/records.ts';
import { withLog } from '../../shared/log.ts';

/**
 * Admin-only backfill runner (O-01). A temporary Base44 stand-in for migrations:
 * `list` shows what exists, `run` plans (dry run by default) or applies one
 * migration in batches and logs a MigrationRun row.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAppAdmin(user)) throw fail('Administrator access required.', 403);

    const body = await req.json().catch(() => ({}));
    const db = createDb(base44);

    if (body?.action === 'list') {
      const runs = await db.list('MigrationRun', {}, { sort: '-run_at', limit: 30 });
      return Response.json({
        migrations: MIGRATIONS.map((m) => ({ id: m.id, description: m.description })),
        runs,
      });
    }

    if (body?.action === 'run') {
      const migration = migrationById(String(body?.id || ''));
      if (!migration) throw fail('Unknown migration.', 404);
      // Dry run unless the caller explicitly says otherwise.
      const result = await runMigration(db, migration, { dryRun: body?.dryRun !== false, actor: actorName(user) });
      return Response.json(result);
    }

    // The fix-up screen: typed names chosen by hand, applied to one project.
    if (body?.action === 'assign_names') {
      const projectId = String(body?.projectId || '');
      if (!projectId) throw fail('A project is required.');
      const migration = assignNamesMigration({ projectId, mapping: body?.mapping });
      return Response.json(await runMigration(db, migration, { dryRun: body?.dryRun === true, actor: actorName(user) }));
    }

    throw fail('Unknown action.');
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('migrate', handler);
