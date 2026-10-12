// U-01 — one status language, defined once.
import { describe, expect, it } from 'vitest';
import {
  BLOCKER_CATEGORIES, DELAY_CATEGORIES, MEMBERSHIP_ROLES, STATUS_CATEGORY, STATUS_HELP, TASK_STATUSES,
  allowedNextStatuses,
} from '../base44/shared/enums.ts';
import { STATUS_TOKENS } from '@/lib/tokens';
import * as ui from '@/lib/constants';
import * as rules from '../base44/shared/taskWriteRules.ts';
import { entitySchema } from './helpers/jsonc.js';

describe('U-01 enums match the entity schemas', () => {
  const task = entitySchema('Task').properties;
  it('task status', () => expect(task.status.enum).toEqual(TASK_STATUSES));
  it('blocker category', () => expect(task.blocker_category.enum).toEqual(BLOCKER_CATEGORIES));
  it('membership role', () => {
    const roles = entitySchema('ProjectMembership').properties.role.enum;
    expect(new Set(roles)).toEqual(new Set(MEMBERSHIP_ROLES));
  });
});

describe('U-01 one definition everywhere', () => {
  it('the screens and the server share the same lists', () => {
    expect(ui.TASK_STATUSES).toBe(TASK_STATUSES);
    expect(ui.BLOCKER_CATEGORIES).toBe(BLOCKER_CATEGORIES);
    expect(rules.TASK_STATUSES).toBe(TASK_STATUSES);
    expect(ui.MEMBERSHIP_ROLES).toBe(MEMBERSHIP_ROLES);
  });

  it('every status has a category, an icon, a colour and a tooltip', () => {
    for (const status of TASK_STATUSES) {
      expect(STATUS_CATEGORY[status]).toBeTruthy();
      expect(STATUS_HELP[status]).toBeTruthy();
      expect(STATUS_TOKENS[status].icon).toBeTruthy();
      expect(STATUS_TOKENS[status].tone).toBeTruthy();
    }
  });

  it('only legal next statuses are offered', () => {
    expect(allowedNextStatuses('Not Started')).not.toContain('Approved');
    expect(allowedNextStatuses('Not Started')).not.toContain('Closed');
    expect(allowedNextStatuses('Execution Complete')).toContain('Approved');
    expect(allowedNextStatuses('Approved')).toContain('Closed');
  });

  it('delay reasons are a fixed list so they can be counted', () => {
    expect(DELAY_CATEGORIES).toContain('Material');
    expect(new Set(DELAY_CATEGORIES).size).toBe(DELAY_CATEGORIES.length);
  });
});
