// T-01 — work belongs to real people.
import { describe, expect, it } from 'vitest';
import { assigneeFor, checkWatchers, matchMember } from '../base44/shared/assignees.ts';
import { userMatching, assignNamesMigration } from '../base44/shared/migrations/userMatching.ts';
import { runMigration } from '../base44/shared/migrations/runner.ts';
import { makeDb } from '../base44/shared/dbCore.ts';

const members = [
  { user_id: 'u1', name: 'Rahul Sharma', email: 'rahul.sharma@dvg.example', initials: 'RS' },
  { user_id: 'u2', name: 'Priya Nair', email: 'priya@dvg.example', initials: 'PN' },
  { user_id: 'u3', name: 'Rahul Verma', email: 'rverma@dvg.example', initials: 'RV' },
];

describe('T-01 matching typed names to members', () => {
  it('matches exact names, email names and unique first names', () => {
    expect(matchMember('rahul sharma', members).user_id).toBe('u1');
    expect(matchMember('Priya', members).user_id).toBe('u2');
    expect(matchMember('priya@dvg.example', members).user_id).toBe('u2');
    expect(matchMember('PN', members).user_id).toBe('u2');
  });

  it('never guesses between two people', () => {
    expect(matchMember('Rahul', members)).toBeNull();
    expect(matchMember('Someone Else', members)).toBeNull();
    expect(matchMember('', members)).toBeNull();
  });

  it('accepts a first name with an initial', () => {
    expect(matchMember('Rahul S', members).user_id).toBe('u1');
    expect(matchMember('Rahul V.', members).user_id).toBe('u3');
  });
});

describe('T-01 assignee on write', () => {
  it('refuses someone who is not a member', () => {
    expect(() => assigneeFor({ requested: 'ghost', members })).toThrow(/active member/);
  });

  it('fills the display name from the member', () => {
    expect(assigneeFor({ requested: 'u2', members })).toEqual({ assignee_user_id: 'u2', responsible_engineer: 'Priya Nair' });
  });

  it('keeps a name that was typed', () => {
    expect(assigneeFor({ requested: 'u2', members, typedName: 'P. Nair' })).toEqual({ assignee_user_id: 'u2' });
  });

  it('a new task inherits the villa engineer; an update does not', () => {
    const location = { assigned_engineer_user_id: 'u1' };
    expect(assigneeFor({ members, location, isCreate: true }).assignee_user_id).toBe('u1');
    expect(assigneeFor({ members, location, isCreate: false })).toEqual({});
    expect(assigneeFor({ members, location: { assigned_engineer_user_id: 'gone' }, isCreate: true })).toEqual({});
  });

  it('watchers must be members', () => {
    expect(checkWatchers(['u1', 'u1', 'u2'], members)).toEqual(['u1', 'u2']);
    expect(() => checkWatchers(['nobody'], members)).toThrow(/members/);
  });
});

function memoryDb(seed) {
  const tables = Object.fromEntries(Object.entries(seed).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));
  const entities = new Proxy({}, {
    get: (_, name) => ({
      filter: async () => ({ items: (tables[name] || []).map((r) => ({ ...r })), has_more: false }),
      update: async (id, data) => Object.assign(tables[name].find((r) => r.id === id), data),
      create: async (data) => { (tables[name] ||= []).push({ id: 'n', ...data }); },
    }),
  });
  return { tables, db: makeDb({ entities }) };
}

describe('T-01 backfill', () => {
  const seed = () => ({
    ProjectMembership: [
      { id: 'm1', project_id: 'p', user_id: 'u1', user_name: 'Rahul Sharma', user_email: 'rs@x', active: true },
      { id: 'm2', project_id: 'p', user_id: 'u2', user_name: 'Priya Nair', user_email: 'pn@x', active: true },
    ],
    Task: [
      { id: 't1', project_id: 'p', responsible_engineer: 'Priya' },
      { id: 't2', project_id: 'p', responsible_engineer: 'Mr Unknown' },
      { id: 't3', project_id: 'p', responsible_engineer: 'Priya', assignee_user_id: 'u1' },
    ],
    Location: [{ id: 'l1', project_id: 'p', assigned_engineer: 'Rahul Sharma' }],
    MeetingCommitment: [{ id: 'c1', project_id: 'p', responsible_person: 'Rahul Sharma' }],
  });

  it('links only clear matches, never overwrites, and leaves the typed text', async () => {
    const { db, tables } = memoryDb(seed());
    await runMigration(db, userMatching, { dryRun: false });
    expect(tables.Task.find((t) => t.id === 't1').assignee_user_id).toBe('u2');
    expect(tables.Task.find((t) => t.id === 't1').responsible_engineer).toBe('Priya');
    expect(tables.Task.find((t) => t.id === 't2').assignee_user_id).toBeUndefined();
    expect(tables.Task.find((t) => t.id === 't3').assignee_user_id).toBe('u1');
    expect(tables.Location[0].assigned_engineer_user_id).toBe('u1');
    expect(tables.MeetingCommitment[0].responsible_user_id).toBe('u1');
    const again = await runMigration(db, userMatching, { dryRun: false });
    expect(again.total).toBe(0);
  });

  it('the fix-up screen links a hand-chosen name', async () => {
    const { db, tables } = memoryDb(seed());
    const result = await runMigration(db, assignNamesMigration({ projectId: 'p', mapping: { 'Mr Unknown': 'u2' } }), { dryRun: false });
    expect(result.written).toBe(1);
    expect(tables.Task.find((t) => t.id === 't2').assignee_user_id).toBe('u2');
  });
});
