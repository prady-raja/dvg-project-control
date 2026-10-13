import { describe, expect, it } from 'vitest';
import { dataHealthView, missingFieldsOf } from '../base44/shared/dataHealth.ts';
import { buildIndex } from '../base44/shared/dashboardCore.ts';

const t = (id, extra = {}) => ({ id, task_ref: `T-${id}`, project_id: 'p', location_id: 'v', name: `Task ${id}`, status: 'In Progress', baseline_finish: '2026-04-01', ...extra });
const tasks = [
  t('1'), // missing all three
  t('2', { responsible_engineer: 'Asha', current_forecast_finish: '2026-04-10', priority: 'High' }), // complete
  t('3', { assignee_user_id: 'u1', priority: 'Low' }), // missing forecast only
  t('4', { status: 'Closed' }), // closed work is not counted
  t('5', { is_demo: true }), // demo work is not counted
  t('6', { archived: true }),
  t('7', { is_villa_work_parent: true }),
];
const ix = buildIndex({ projects: [{ id: 'p' }], locations: [{ id: 'v', villa_code: 'B-05' }], tasks });

describe('what a task is missing', () => {
  it('names each gap and nothing else', () => {
    expect(missingFieldsOf(tasks[0])).toEqual(['engineer', 'forecast', 'priority']);
    expect(missingFieldsOf(tasks[1])).toEqual([]);
    expect(missingFieldsOf(tasks[2])).toEqual(['forecast']);
  });
  it('a user-id assignment counts as an engineer even before the name is copied', () => expect(missingFieldsOf({ assignee_user_id: 'u1' })).not.toContain('engineer'));
});

describe('data health counts match the tasks behind each one (G4)', () => {
  const base = dataHealthView({ tasks, ix, asOf: '2026-03-10' });
  it('counts only outstanding, countable work', () => {
    expect(base.tasks_reviewed).toBe(3);
    expect(Object.fromEntries(base.fields.map((f) => [f.key, f.count]))).toEqual({ engineer: 1, forecast: 2, priority: 1 });
  });
  it.each(['engineer', 'forecast', 'priority'])('the list for %s has exactly as many rows as its count', (field) => {
    const v = dataHealthView({ tasks, ix, asOf: '2026-03-10', options: { field } });
    expect(v.rows.length).toBe(v.total);
    expect(v.total).toBe(base.fields.find((f) => f.key === field).count);
    v.rows.forEach((row) => expect(row.missing).toContain(field));
  });
  it('pages a long list', () => {
    const many = Array.from({ length: 30 }, (_, i) => t(String(100 + i)));
    const v = dataHealthView({ tasks: many, ix, asOf: '2026-03-10', options: { field: 'forecast', limit: 10, offset: 10 } });
    expect(v.total).toBe(30);
    expect(v.rows).toHaveLength(10);
  });
});

import { diffFields } from '../base44/shared/history.ts';
import { guardTaskChanges } from '../base44/shared/taskWriteRules.ts';

describe('saving from the chip goes through the normal task rules (G3, G6)', () => {
  const task = { id: 'x', status: 'In Progress', baseline_start: '2026-01-01', baseline_finish: '2026-02-01', baseline_locked: true };
  const editor = { id: 'u', full_name: 'Editor' };
  const check = (changes, rank = 1, extra = {}) => {
    const entries = diffFields(task, changes);
    guardTaskChanges({ task, entries, rank, user: editor, ...extra });
    return entries.map((e) => e.field_changed);
  };

  it('saving only one field changes only that field', () => expect(check({ priority: 'High' })).toEqual(['priority']));
  it('an engineer alone is fine', () => expect(check({ assignee_user_id: 'u9' })).toEqual(['assignee_user_id']));
  it('a forecast needs a reason and a delay category', () => {
    expect(() => check({ current_forecast_finish: '2026-03-01' })).toThrow(/revision reason/);
    expect(() => check({ current_forecast_finish: '2026-03-01' }, 1, { reason: 'Contractor plan' })).toThrow(/why the date moved/i);
    expect(check({ current_forecast_finish: '2026-03-01' }, 1, { reason: 'Contractor plan', category: 'Other' })).toEqual(['current_forecast_finish']);
  });
  it('the forecast leaves the baseline dates untouched', () => {
    const fields = check({ current_forecast_finish: '2026-03-01' }, 1, { reason: 'Contractor plan', category: 'Other' });
    expect(fields).not.toContain('baseline_start');
    expect(fields).not.toContain('baseline_finish');
  });
  it('a viewer cannot save any of it: the write path refuses rank 0 and below before any rule runs', async () => {
    const { canEditTasks } = await import('../base44/shared/access.ts');
    expect(canEditTasks(0)).toBe(false);
    expect(canEditTasks(-1)).toBe(false);
    expect(canEditTasks(1)).toBe(true);
    const { readFileSync } = await import('node:fs');
    const writer = readFileSync(new URL('../base44/functions/taskWrite/entry.ts', import.meta.url), 'utf8');
    expect(writer).toMatch(/if \(!canEditTasks\(rank\)\)/);
  });
});
