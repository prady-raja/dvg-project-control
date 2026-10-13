/**
 * Backups (O-04). A backup nobody has opened is a hope, not a backup, so the admin
 * panel reminds the administrator every Sunday and can check a saved bundle: every
 * entity present, row counts as promised, unique ids, and the main links intact.
 * Pure rules; the panel reads the file.
 */
export const BACKUP_MAX_AGE_DAYS = 7;
const MUST_HAVE = ['Project', 'Location', 'Task'];
/** [from entity, field, target entity] — a link that points nowhere would not survive a restore. */
const LINKS = [['Task', 'project_id', 'Project'], ['Task', 'location_id', 'Location'], ['Location', 'project_id', 'Project'], ['DailyUpdate', 'task_id', 'Task'], ['Snag', 'task_id', 'Task']];

export function backupAgeDays(iso, now = new Date()) {
  const then = Date.parse(iso || '');
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86400000);
}

/** 'none' | 'overdue' | 'fresh' for the last full backup. */
export function backupState(iso, now = new Date()) {
  const age = backupAgeDays(iso, now);
  if (age === null) return 'none';
  return age > BACKUP_MAX_AGE_DAYS ? 'overdue' : 'fresh';
}

/** What is wrong with a parsed backup bundle; an empty list means it is whole. */
export function verifyBackup(bundle) {
  const entities = bundle?.entities;
  if (!entities || typeof entities !== 'object') return { problems: ['This is not a backup bundle: it has no entities.'], counts: {} };
  const problems = [];
  const counts = {};
  MUST_HAVE.forEach((name) => { if (!Array.isArray(entities[name]) || !entities[name].length) problems.push(`${name} is missing or empty.`); });
  const ids = {};
  Object.entries(entities).forEach(([name, rows]) => {
    if (!Array.isArray(rows)) { problems.push(`${name} is not a list of rows.`); return; }
    counts[name] = rows.length;
    const promised = bundle?._meta?.row_counts?.[name];
    if (promised !== undefined && promised !== rows.length) problems.push(`${name} promises ${promised} rows but holds ${rows.length}.`);
    const seen = new Set();
    rows.forEach((row) => {
      if (!row?.id) problems.push(`A ${name} row has no id.`);
      else if (seen.has(row.id)) problems.push(`${name} repeats the id ${row.id}.`);
      seen.add(row?.id);
    });
    ids[name] = seen;
  });
  LINKS.forEach(([from, field, to]) => {
    if (!ids[from] || !ids[to]) return;
    const orphans = (entities[from] || []).filter((row) => row?.[field] && !ids[to].has(row[field])).length;
    if (orphans) problems.push(`${orphans} ${from} row${orphans === 1 ? '' : 's'} point${orphans === 1 ? 's' : ''} to a ${to} that is not in the backup.`);
  });
  return { problems: problems.slice(0, 20), counts };
}
