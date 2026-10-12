// F-02 — Block and Unblock as one action, with an owner and a date.
import { describe, expect, it } from 'vitest';
import { chaseMessage, constraintInput, isPastDue, ownerLabel, whatsappLink } from '../base44/shared/constraints.ts';
import { defaultOwnerTypeFor } from '../base44/shared/enums.ts';
import { blockerBoardView } from '../base44/shared/dashboardBoards.ts';
import { buildIndex } from '../base44/shared/dashboardCore.ts';

const TODAY = '2026-10-12';

describe('F-02 what a person enters', () => {
  it('needs a category and a description', () => {
    expect(() => constraintInput({ description: 'x' }, { today: TODAY })).toThrow(/category/i);
    expect(() => constraintInput({ category: 'Materials Pending' }, { today: TODAY })).toThrow(/holding the work up/i);
  });

  it('owner access and client selection default to the villa owner; the rest to the contractor', () => {
    expect(defaultOwnerTypeFor('Owner Access Pending')).toBe('Villa owner');
    expect(defaultOwnerTypeFor('Client Selection Pending')).toBe('Villa owner');
    expect(defaultOwnerTypeFor('Materials Pending')).toBe('Contractor');
    expect(constraintInput({ category: 'Owner Access Pending', description: 'Keys' }, { today: TODAY }).owner_type).toBe('Villa owner');
  });

  it('refuses a date in the past or one that is not a date', () => {
    const base = { category: 'Other', description: 'x' };
    expect(() => constraintInput({ ...base, due_date: '2026-10-01' }, { today: TODAY })).toThrow(/past/);
    expect(() => constraintInput({ ...base, due_date: 'soon' }, { today: TODAY })).toThrow(/real date/);
    expect(constraintInput({ ...base, due_date: '2026-10-20' }, { today: TODAY }).due_date).toBe('2026-10-20');
    expect(constraintInput(base, { today: TODAY }).due_date).toBeNull();
  });

  it('flags an open blocker past its date', () => {
    expect(isPastDue({ status: 'Open', due_date: '2026-10-10' }, TODAY)).toBe(true);
    expect(isPastDue({ status: 'Cleared', due_date: '2026-10-10' }, TODAY)).toBe(false);
    expect(isPastDue({ status: 'Open', due_date: '' }, TODAY)).toBe(false);
  });
});

describe('F-02 chasing on WhatsApp', () => {
  const constraint = { category: 'Materials Pending', description: 'Tiles not delivered', owner_name: 'Alpha Tiles', due_date: '2026-10-10' };
  it('words the message with the task, the reason, the date and a link', () => {
    const text = chaseMessage({ constraint, task: { task_ref: 'IMG-0042', name: 'Floor tiling' }, villa: 'A-04', link: 'https://app/tasks/1' });
    expect(text).toContain('Alpha Tiles');
    expect(text).toContain('IMG-0042 (A-04)');
    expect(text).toContain('Tiles not delivered');
    expect(text).toContain('2026-10-10');
    expect(text).toContain('https://app/tasks/1');
  });

  it('builds a wa.me link only when there is a usable number', () => {
    expect(whatsappLink('+91 98765 43210', 'hi there')).toBe('https://wa.me/919876543210?text=hi%20there');
    expect(whatsappLink('', 'hi')).toBe('');
    expect(whatsappLink('12', 'hi')).toBe('');
    expect(ownerLabel({ owner_type: 'Villa owner' })).toBe('The villa owner');
  });
});

describe('F-02 the Blocker board', () => {
  const locations = [{ id: 'v1', project_id: 'p', location_type: 'Villa', villa_code: 'A-01' }, { id: 'v2', project_id: 'p', location_type: 'Villa', villa_code: 'A-02' }];
  const t = (id, over) => ({ id, task_ref: id, name: id, project_id: 'p', location_id: 'v1', discipline: 'FIN', status: 'Blocked', blocker_description: 'x', blocked_since: '2026-10-01', baseline_finish: '2026-12-01', ...over });
  const tasks = [
    t('t1', { blocker_category: 'Materials Pending' }),
    t('t2', { blocker_category: 'Owner Access Pending', location_id: 'v2' }),
    t('t3', { blocker_category: 'Owner Access Pending', location_id: 'v1' }),
    t('t4', { blocker_category: 'DVG Approval' }),
  ];
  const constraints = [
    { id: 'c1', task_id: 't1', status: 'Open', category: 'Materials Pending', owner_type: 'Contractor', owner_name: 'Alpha Tiles', due_date: '2026-10-05' },
    { id: 'c2', task_id: 't2', status: 'Open', category: 'Owner Access Pending', owner_type: 'Villa owner', due_date: '2026-10-20' },
    { id: 'c3', task_id: 't3', status: 'Open', category: 'Owner Access Pending', owner_type: 'Villa owner' },
  ];
  const ix = buildIndex({ locations, tasks });
  const board = blockerBoardView({ tasks, ix, options: {}, asOf: TODAY, heldIds: new Set(), constraints });

  it('groups by owner, owner-access blockers by villa, past-due groups first', () => {
    expect(board.by_owner.map((g) => g.owner)).toEqual(['Alpha Tiles', 'Owner not assigned', 'Villa owner — A-01', 'Villa owner — A-02']);
    expect(board.by_owner[0].past_due).toBe(1);
  });

  it('takes the expected date from the owner, and counts what has no owner or date', () => {
    expect(board.rows.find((r) => r.id === 't1').expected_resolution_date).toBe('2026-10-05');
    expect(board.counts.past_due).toBe(1);
    expect(board.counts.without_owner).toBe(1); // t4 has no constraint
    expect(board.by_owner.find((g) => g.owner === 'Villa owner — A-01').no_date).toBe(1);
  });
});
