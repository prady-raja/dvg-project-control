// X-01 — update dialogs and the task picker showed the wrong task data.
import { describe, expect, it } from 'vitest';
import {
  changedFields, escapeRegex, forecastOf, legalNextStatuses, pickerQuery, quickUpdateForm,
} from '@/lib/taskForm';

const task = {
  id: 't1',
  status: 'In Progress',
  progress_percent: 40,
  current_forecast_finish: '2026-11-20',
  date_revision_reason: 'Old reason from an earlier revision',
  remarks: 'Planner remarks',
  latest_update: 'Tiling started',
};

describe('X-01 quick update form', () => {
  it('opening and saving with no edits changes nothing', () => {
    expect(changedFields(task, quickUpdateForm(task))).toEqual({});
  });

  it('a task with blank fields also saves as no change', () => {
    const blank = { id: 't2', status: 'Not Started', progress_percent: null };
    expect(changedFields(blank, quickUpdateForm(blank))).toEqual({});
  });

  it('sends only the edited field', () => {
    const form = { ...quickUpdateForm(task), progress_percent: '60' };
    expect(changedFields(task, form)).toEqual({ progress_percent: '60' });
  });

  it('never carries the previous revision reason into a new form', () => {
    expect(quickUpdateForm(task).date_revision_reason).toBe('');
  });

  it('builds the form from the task, not from an empty first render', () => {
    expect(quickUpdateForm(null).status).toBe('Not Started');
    expect(quickUpdateForm(task).status).toBe('In Progress');
    expect(quickUpdateForm(task).current_forecast_finish).toBe('2026-11-20');
  });

  it('only offers statuses the server accepts next', () => {
    expect(legalNextStatuses('In Progress')).not.toContain('Approved');
    expect(legalNextStatuses('In Progress')).not.toContain('Closed');
    expect(legalNextStatuses('Execution Complete')).toContain('Approved');
  });
});

describe('X-01 forecast revision', () => {
  it('reads the Planning row forecast_finish when there is no current_forecast_finish', () => {
    expect(forecastOf({ forecast_finish: '2026-12-01', baseline_finish: '2026-11-01' })).toBe('2026-12-01');
    expect(forecastOf({ current_forecast_finish: '2026-12-05', forecast_finish: '2026-12-01' })).toBe('2026-12-05');
    expect(forecastOf({ baseline_finish: '2026-11-01' })).toBe('2026-11-01');
  });
});

describe('X-01 task picker', () => {
  it('excludes closed work and villa-work parents', () => {
    const q = pickerQuery({ projectId: 'p1' });
    expect(q.is_villa_work_parent).toEqual({ $ne: true });
    expect(q.status.$in).not.toContain('Approved');
    expect(q.status.$in).not.toContain('Closed');
    expect(q.status.$in).toContain('In Progress');
  });

  it('escapes search text so "(" is a valid pattern', () => {
    const q = pickerQuery({ projectId: 'p1', term: '(' });
    expect(() => new RegExp(q.$or[0].name.$regex)).not.toThrow();
    expect(new RegExp(escapeRegex('B-5 (A)')).test('Villa B-5 (A) tiling')).toBe(true);
  });
});
