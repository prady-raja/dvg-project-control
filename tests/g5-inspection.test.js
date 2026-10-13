import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ITEMS, GENERIC_ITEMS, checklistInput, failedItems, inspectableProblem, overallOf, parseTemplateText, snagFromFailure, templateFor } from '../base44/shared/checklists.ts';
import { SEED_DISCIPLINES } from '@/lib/constants';
import { canEditTasks } from '../base44/shared/access.ts';
import { guardTaskChanges } from '../base44/shared/taskWriteRules.ts';

describe('templates', () => {
  it('every discipline in the seed list has a starting list', () => SEED_DISCIPLINES.forEach((d) => expect(DEFAULT_ITEMS[d.code], d.code).toBeTruthy()));
  it('the administrator\'s own list wins; otherwise the starting list; otherwise a generic one', () => {
    expect(templateFor('CIVIL', ['  Check A ', '', 'Check B'])).toEqual(['Check A', 'Check B']);
    expect(templateFor('CIVIL', [])).toBe(DEFAULT_ITEMS.CIVIL);
    expect(templateFor('NEWTRADE', undefined)).toBe(GENERIC_ITEMS);
  });
  it('typing a list one item per line tidies it', () => expect(parseTemplateText('- Level\n2) Plumb\n\nlevel\n• Clean')).toEqual(['Level', 'Plumb', 'Clean']));
});

describe('filling one in', () => {
  const pass = { text: 'Level', result: 'Pass' };
  it('every item needs a result', () => expect(() => checklistInput([pass, { text: 'Plumb' }])).toThrow(/Pass, Fail or N\/A/));
  it('a Fail needs a comment', () => {
    expect(() => checklistInput([{ text: 'Plumb', result: 'Fail' }])).toThrow(/what is wrong/);
    expect(checklistInput([{ text: 'Plumb', result: 'Fail', comment: 'Out by 5mm' }])[0].comment).toBe('Out by 5mm');
  });
  it('overall is Fail if any item fails', () => {
    expect(overallOf([pass, { result: 'N/A' }])).toBe('Pass');
    expect(overallOf([pass, { result: 'Fail' }])).toBe('Fail');
    expect(failedItems([pass, { result: 'Fail' }])).toHaveLength(1);
  });
  it('empty or oversized lists are refused', () => {
    expect(() => checklistInput([])).toThrow();
    expect(() => checklistInput(Array.from({ length: 41 }, () => pass))).toThrow(/at most 40/);
  });
});

describe('where it can be attached', () => {
  it('a task only once the work is reported done; a snag until closed', () => {
    expect(inspectableProblem('Task', { status: 'In Progress' })).toMatch(/Execution Complete/);
    expect(inspectableProblem('Task', { status: 'Execution Complete' })).toBe('');
    expect(inspectableProblem('Task', { status: 'Under Inspection' })).toBe('');
    expect(inspectableProblem('Snag', { status: 'Open' })).toBe('');
    expect(inspectableProblem('Snag', { status: 'Closed' })).toMatch(/closed/);
  });
});

describe('a Fail offers a prefilled snag', () => {
  it('carries the item, comment, photo, villa and trade', () => {
    const prefill = snagFromFailure({
      item: { text: 'Joints are neat', comment: 'Gaps at the corner', photo_uri: 'files/p.jpg' },
      subject: { task_ref: 'IMG-B-0042', discipline: 'FIN', contractor_id: 'c1', location_id: 'v1', floor_id: 'f1', area_ids: ['a1'] },
      subjectType: 'Task',
    });
    expect(prefill).toMatchObject({ title: 'Joints are neat', description: 'Gaps at the corner', photo_uris: ['files/p.jpg'], discipline: 'FIN', contractor_id: 'c1', locationId: 'v1', floor_id: 'f1', area_ids: ['a1'] });
    expect(prefill.from).toContain('IMG-B-0042');
  });
});

describe('it changes no status rule (G5, G6)', () => {
  const writer = readFileSync(new URL('../base44/functions/inspectionWrite/entry.ts', import.meta.url), 'utf8');
  it('the function never updates a task or a snag', () => {
    expect(writer).not.toMatch(/svc\.Task\.update/);
    expect(writer).not.toMatch(/svc\.Snag\.update/);
    expect(writer).not.toMatch(/status\s*:\s*['"]/); // it sets no status value anywhere
    expect(writer).not.toMatch(/guardApproval|approved_by|execution_completed_by/);
  });
  it('only people who can edit tasks may save one; a viewer is refused by the server', () => {
    expect(writer).toMatch(/if \(!canEditTasks\(rank\)\)/);
    expect(canEditTasks(0)).toBe(false);
  });
  it('the completer still cannot approve their own completion (rule unchanged)', () => {
    const task = { status: 'Execution Complete', execution_completed_by_id: 'u1' };
    const entries = [{ field_changed: 'status', old_value: 'Execution Complete', new_value: 'Approved' }];
    expect(() => guardTaskChanges({ task, entries, rank: 2, user: { id: 'u1' } })).toThrow(/cannot approve or close work you/);
    expect(() => guardTaskChanges({ task, entries, rank: 2, user: { id: 'u2' } })).not.toThrow();
  });
});
