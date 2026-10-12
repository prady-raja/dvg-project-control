// S-01 — the working calendar behind every stale, at-risk and overdue rule.
import { describe, expect, it } from 'vitest';
import {
  addWorkingDays, DEFAULT_SETTINGS, isStale, isWorkingDay, projectSettings, settingsProblems, workingDaysBetween,
} from '../base44/shared/calendar.ts';
import { attentionFor } from '../base44/shared/attention.ts';
import { buildIndex } from '../base44/shared/dashboardCore.ts';

// 2026-10-11 is a Sunday.
describe('S-01 working calendar', () => {
  it('Monday to Saturday by default, Sunday off', () => {
    expect(isWorkingDay('2026-10-10')).toBe(true); // Saturday
    expect(isWorkingDay('2026-10-11')).toBe(false); // Sunday
  });

  it('a holiday is not a working day', () => {
    const s = projectSettings({ holidays: ['2026-10-12'] });
    expect(isWorkingDay('2026-10-12', s)).toBe(false);
    expect(workingDaysBetween('2026-10-10', '2026-10-13', s)).toBe(1); // only the 13th counts
  });

  it('counts working days after the first day up to and including the second', () => {
    expect(workingDaysBetween('2026-10-05', '2026-10-12')).toBe(6); // Tue..Sat (5) + Mon = 6
    expect(workingDaysBetween('2026-10-12', '2026-10-12')).toBe(0);
  });

  it('adds working days, skipping Sundays and holidays', () => {
    expect(addWorkingDays('2026-10-10', 1)).toBe('2026-10-12');
    expect(addWorkingDays('2026-10-10', 1, projectSettings({ holidays: ['2026-10-12'] }))).toBe('2026-10-13');
  });

  it('stale is counted in working days, so a Sunday does not make work stale', () => {
    const s = projectSettings({ stale_days: 1 });
    expect(isStale('2026-10-10', '2026-10-11', s)).toBe(false); // report Saturday, look on Sunday
    expect(isStale('2026-10-10', '2026-10-13', s)).toBe(true); // Mon + Tue = 2 > 1
    expect(isStale('', '2026-10-13', s)).toBe(true);
  });

  it('falls back to the defaults for missing or nonsense values', () => {
    const s = projectSettings({ stale_days: 'abc', working_days: [] });
    expect(s.stale_days).toBe(DEFAULT_SETTINGS.stale_days);
    expect(s.working_days).toEqual(DEFAULT_SETTINGS.working_days);
  });

  it('refuses settings that make no sense', () => {
    expect(settingsProblems({ working_days: [] })).toHaveLength(1);
    expect(settingsProblems({ stale_days: 0 })).toHaveLength(1);
    expect(settingsProblems({ holidays: ['soon'] })).toHaveLength(1);
    expect(settingsProblems({ stale_days: 5, working_days: [1, 2], site_lat: 12.9, site_lng: 77.5 })).toEqual([]);
  });

  it('Needs Attention uses the project\'s own stale threshold', () => {
    const task = { id: 't', project_id: 'p', status: 'In Progress', location_id: null, contractor_id: 'c', responsible_engineer: 'x', baseline_finish: '2026-12-01', progress_percent: 10, latest_report_date: '2026-10-08', scope_type: 'Site-wide' };
    const run = (stale_days) => attentionFor({
      tasks: [task], locations: [], areas: [], floors: [], dependencies: [], updates: [], asOf: '2026-10-13',
      ix: buildIndex({ projects: [{ id: 'p', stale_days }] }), options: {},
    }).items.some((i) => i.code === 'stale_update');
    expect(run(2)).toBe(true); // Thu -> Tue = Fri, Sat, Mon, Tue = 4 > 2
    expect(run(7)).toBe(false);
  });
});
