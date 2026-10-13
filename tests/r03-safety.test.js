import { describe, expect, it } from 'vitest';
import { approvalHold, staleProblem } from '../base44/shared/approvalHold.ts';
import { backupState, verifyBackup } from '../src/lib/backupCheck.js';

describe('approval holds', () => {
  it('a clean task has no hold', () => expect(approvalHold({ task: {}, checklists: [], snags: [] })).toBe(''));
  it('rework waits for a new inspection', () => expect(approvalHold({ task: { rework_pending: true } })).toMatch(/new inspection/));
  it('the latest failed checklist holds, a later pass releases', () => {
    const fail = { created_date: '2026-10-10T10:00:00Z', overall: 'Fail' };
    const pass = { created_date: '2026-10-11T10:00:00Z', overall: 'Pass' };
    expect(approvalHold({ task: {}, checklists: [fail] })).toMatch(/failed items/);
    expect(approvalHold({ task: {}, checklists: [fail, pass] })).toBe('');
  });
  it('open snags hold, closed ones do not', () => {
    expect(approvalHold({ task: {}, snags: [{ status: 'Open' }, { status: 'Closed' }] })).toMatch(/1 snag is still open/);
    expect(approvalHold({ task: {}, snags: [{ status: 'Closed' }] })).toBe('');
  });
});

describe('conflict check', () => {
  const task = { updated_date: '2026-10-13T07:00:00Z' };
  it('passes when the person has the current version, or sent none', () => {
    expect(staleProblem(task, '2026-10-13T07:00:00Z')).toBe('');
    expect(staleProblem(task, undefined)).toBe('');
  });
  it('refuses a stale copy', () => expect(staleProblem(task, '2026-10-12T07:00:00Z')).toMatch(/Someone else changed/));
});

describe('backups', () => {
  const now = new Date('2026-10-13T00:00:00Z');
  it('reminds when none or older than a week', () => {
    expect(backupState('', now)).toBe('none');
    expect(backupState('2026-10-01T00:00:00Z', now)).toBe('overdue');
    expect(backupState('2026-10-10T00:00:00Z', now)).toBe('fresh');
  });
  const whole = { _meta: { row_counts: { Project: 1, Location: 1, Task: 1 } }, entities: { Project: [{ id: 'p' }], Location: [{ id: 'l', project_id: 'p' }], Task: [{ id: 't', project_id: 'p', location_id: 'l' }] } };
  it('accepts a whole bundle', () => expect(verifyBackup(whole).problems).toEqual([]));
  it('finds missing, short, duplicated and orphaned data', () => {
    expect(verifyBackup({}).problems[0]).toMatch(/not a backup/);
    const bad = { _meta: { row_counts: { Task: 2 } }, entities: { Project: [{ id: 'p' }], Location: [{ id: 'l' }, { id: 'l' }], Task: [{ id: 't', location_id: 'gone' }] } };
    const text = verifyBackup(bad).problems.join(' | ');
    expect(text).toMatch(/Task promises 2 rows but holds 1/);
    expect(text).toMatch(/Location repeats the id l/);
    expect(text).toMatch(/points to a Location/);
  });
});
