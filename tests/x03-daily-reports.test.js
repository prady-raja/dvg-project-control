// X-03 — daily reports could move tasks backwards or wipe data.
import { describe, expect, it } from 'vitest';
import {
  BACKDATE_LIMIT_DAYS, isOlderThanLatest, reportDateProblem, reportTargetProblem,
} from '../base44/shared/dailyReportRules.ts';
import { blockedStateFor } from '../base44/shared/taskWriteRules.ts';

const today = '2026-10-10';

describe('X-03 report date', () => {
  it('refuses a future date', () => {
    expect(reportDateProblem('2026-10-11', today)).toMatch(/future/);
  });

  it('refuses a date older than the backdate limit', () => {
    expect(reportDateProblem('2026-10-02', today)).toMatch(/backdated/);
    expect(reportDateProblem('2026-10-03', today)).toBe('');
    expect(BACKDATE_LIMIT_DAYS).toBe(7);
  });

  it('an older report never overwrites a newer one', () => {
    expect(isOlderThanLatest('2026-10-08', '2026-10-09')).toBe(true);
    expect(isOlderThanLatest('2026-10-09', '2026-10-09')).toBe(false);
    expect(isOlderThanLatest('2026-10-10', '2026-10-09')).toBe(false);
    expect(isOlderThanLatest('2026-10-08', '')).toBe(false);
  });
});

describe('X-03 report target', () => {
  it('refuses archived tasks and villa-work parents', () => {
    expect(reportTargetProblem({ archived: true })).toMatch(/archived/);
    expect(reportTargetProblem({ is_villa_work_parent: true })).toMatch(/Villa Work/);
    expect(reportTargetProblem({ status: 'In Progress' })).toBe('');
  });
});

describe('X-03 blocker rules', () => {
  const blocker = { blocker_category: 'Materials Pending', blocker_description: 'Tiles not delivered' };

  it('a blocker logged on In Progress work moves it to Blocked with blocked_since', () => {
    const task = { status: 'In Progress' };
    const { patch } = blockedStateFor({ task, next: { status: 'In Progress', ...blocker } });
    expect(patch.status).toBe('Blocked');
    expect(patch.blocked_since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a new blocker on an already Blocked task keeps the original blocked_since', () => {
    const task = { status: 'Blocked', blocked_since: '2026-10-01', ...blocker };
    const { patch } = blockedStateFor({
      task, next: { blocker_category: 'DVG Approval', blocker_description: 'Waiting on sign-off' },
    });
    expect(patch.blocked_since).toBe('2026-10-01');
  });

  it('moving a Blocked task on clears the blocker fields', () => {
    const task = { status: 'Blocked', blocked_since: '2026-10-01', ...blocker };
    const { patch } = blockedStateFor({ task, next: { status: 'In Progress' } });
    expect(patch).toMatchObject({ blocker_category: null, blocker_description: null, blocked_since: null });
  });

  it('editing an In Progress task that keeps its old category does not block it', () => {
    const task = { status: 'In Progress', blocker_category: 'Other' };
    const { patch } = blockedStateFor({ task, next: { status: 'In Progress', blocker_category: 'Other' } });
    expect(patch.status).toBeUndefined();
  });
});
