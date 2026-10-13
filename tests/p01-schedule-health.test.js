// P-01 — schedule health, actual dates and categorised delay reasons.
import { describe, expect, it } from 'vitest';
import { delayCauses, healthOf, slipDays } from '../base44/shared/dashboardCore.ts';
import { projectSettings } from '../base44/shared/calendar.ts';
import { deriveTaskEffects, guardTaskChanges } from '../base44/shared/taskWriteRules.ts';
import { categoryForReason, delayCategoryFor } from '../base44/shared/delay.ts';

const AS_OF = '2026-10-12'; // Monday
const task = (over = {}) => ({
  id: 't', project_id: 'p', status: 'In Progress', baseline_finish: '2026-10-14', current_forecast_finish: '',
  latest_report_date: '2026-10-12', ...over,
});
const settings = projectSettings({ at_risk_window_days: 3, stale_days: 2 });

describe('P-01 slip and health', () => {
  it('slip is forecast minus baseline, and null when either is missing', () => {
    expect(slipDays(task({ current_forecast_finish: '2026-10-20' }))).toBe(6);
    expect(slipDays(task({ current_forecast_finish: '2026-10-10' }))).toBe(-4);
    expect(slipDays(task())).toBeNull();
  });

  it('Late means the finish date has passed on work still to be executed', () => {
    expect(healthOf(task({ baseline_finish: '2026-10-01' }), AS_OF, { settings })).toBe('Late');
    expect(healthOf(task({ status: 'Execution Complete', baseline_finish: '2026-10-01' }), AS_OF, { settings })).toBe('');
  });

  it('At risk: due soon and stale, or a predecessor open, or blocked', () => {
    expect(healthOf(task({ latest_report_date: '2026-10-05' }), AS_OF, { settings })).toBe('At risk');
    expect(healthOf(task(), AS_OF, { settings, openPredecessors: 1 })).toBe('At risk');
    expect(healthOf(task({ status: 'Blocked', blocker_description: 'x' }), AS_OF, { settings })).toBe('At risk');
    expect(healthOf(task(), AS_OF, { settings })).toBe('On track');
  });

  it('far-off work is on track even when stale; undated work has no health', () => {
    expect(healthOf(task({ baseline_finish: '2026-12-31', latest_report_date: '2026-09-01' }), AS_OF, { settings })).toBe('On track');
    expect(healthOf(task({ baseline_finish: '' }), AS_OF, { settings })).toBe('');
  });

  it('the at-risk window counts working days: a Sunday in between does not shorten it', () => {
    // Due Tuesday 13th, asOf Saturday 10th: Sat -> Tue = Mon, Tue = 2 working days.
    const strict = projectSettings({ at_risk_window_days: 1 });
    expect(healthOf(task({ baseline_finish: '2026-10-13', latest_report_date: '' }), '2026-10-10', { settings: strict })).toBe('On track');
    expect(healthOf(task({ baseline_finish: '2026-10-13', latest_report_date: '' }), '2026-10-10', { settings: projectSettings({ at_risk_window_days: 2 }) })).toBe('At risk');
  });
});

describe('P-01 actual dates', () => {
  const user = { id: 'u', full_name: 'Site Eng' };
  const move = (taskState, next) =>
    deriveTaskEffects({ task: taskState, entries: [{ field_changed: 'status', old_value: taskState.status, new_value: next }], user, onDate: '2026-10-09' });

  it('sets actual_start on the first move to In Progress, and keeps it afterwards', () => {
    expect(move({ status: 'Not Started' }, 'In Progress').patch.actual_start).toBe('2026-10-09');
    expect(move({ status: 'Not Started', actual_start: '2026-10-01' }, 'In Progress').patch.actual_start).toBeUndefined();
  });

  it('sets actual_finish on Execution Complete, using the report date', () => {
    const effects = move({ status: 'In Progress', actual_start: '2026-10-01' }, 'Execution Complete');
    expect(effects.patch.actual_finish).toBe('2026-10-09');
  });

  it('an imported completion states no finish date', () => {
    const effects = deriveTaskEffects({
      task: { status: 'Not Started' }, entries: [{ field_changed: 'status', new_value: 'Execution Complete' }], user, importedCompletion: true,
    });
    expect(effects.patch.actual_finish).toBeUndefined();
  });

  it('reopening clears the finish and says so in the history', () => {
    const effects = move({ status: 'Execution Complete', actual_finish: '2026-10-05', execution_completed_by_id: 'x' }, 'In Progress');
    expect(effects.patch.actual_finish).toBeNull();
    expect(effects.derived.some((d) => d.field_changed === 'actual_finish')).toBe(true);
  });
});

describe('P-01 delay categories', () => {
  const entries = [{ field_changed: 'current_forecast_finish', old_value: '2026-10-01', new_value: '2026-10-20' }];
  const guard = (extra) => guardTaskChanges({ task: { status: 'In Progress' }, entries, rank: 2, user: { id: 'u' }, reason: 'Tiles late', ...extra });

  it('a forecast change needs a category from the fixed list', () => {
    expect(() => guard({})).toThrow(/why the date moved/i);
    expect(() => guard({ category: 'Because' })).toThrow(/delay categories/i);
    expect(() => guard({ category: 'Material' })).not.toThrow();
  });

  it('automatic paths read the category from the reason instead', () => {
    expect(() => guard({ inferCategory: true })).not.toThrow();
    expect(delayCategoryFor({ reason: 'Heavy rain on site', infer: true })).toBe('Weather');
    expect(categoryForReason('waiting for material delivery')).toBe('Material');
  });

  it('delay causes are counted and ranked by slip', () => {
    const rows = delayCauses([
      task({ date_revision_category: 'Material', current_forecast_finish: '2026-10-24' }),
      task({ date_revision_category: 'Material', current_forecast_finish: '2026-10-16' }),
      task({ date_revision_category: 'Weather', current_forecast_finish: '2026-10-20' }),
      task({}),
    ]);
    expect(rows.map((r) => r.category)).toEqual(['Material', 'Weather']);
    expect(rows[0]).toMatchObject({ tasks: 2, slip_days: 12, cumulative_percent: 67 });
    expect(rows[1].cumulative_percent).toBe(100);
  });
});
