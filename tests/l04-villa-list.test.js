import { describe, expect, it } from 'vitest';
import { matchesPlotRef } from '@/lib/plotSearch';
import { villaListView } from '../base44/shared/villaViews.ts';
import { buildIndex } from '../base44/shared/dashboardCore.ts';

describe('plot-ref search', () => {
  const row = { villa: 'B-05', plot_numbers: '12, 13' };
  it.each(['b5', 'B-05', 'b 05', 'b05', 'B-5'])('finds B-05 with "%s"', (q) => expect(matchesPlotRef(q, row)).toBe(true));
  it('finds by plot number', () => expect(matchesPlotRef('plot 12', row)).toBe(true));
  it('does not match another villa', () => {
    expect(matchesPlotRef('b6', row)).toBe(false);
    expect(matchesPlotRef('b-15', row)).toBe(false);
  });
  it('an empty search matches everything', () => expect(matchesPlotRef('  ', row)).toBe(true));
});

describe('villaListView', () => {
  const asOf = '2026-03-12';
  const locations = [
    { id: 'a', project_id: 'p', villa_code: 'A-01', location_type: 'Villa', possession_status: 'Handed Over' },
    { id: 'b', project_id: 'p', villa_code: 'A-02', location_type: 'Villa', possession_status: 'Not Handed Over' },
    { id: 'c', project_id: 'p', villa_code: 'A-03', location_type: 'Villa', possession_status: 'Not Handed Over' },
  ];
  const t = (id, location_id, extra = {}) => ({ id, project_id: 'p', location_id, status: 'In Progress', discipline: 'CIV', baseline_finish: '2026-04-01', ...extra });
  const tasks = [
    t('1', 'a'), t('2', 'b', { current_forecast_finish: '2026-03-01' }), t('3', 'b', { status: 'Blocked', blocker_category: 'Material' }),
    t('4', 'c', { status: 'Closed' }),
  ];
  const ix = buildIndex({ projects: [{ id: 'p' }], locations, tasks });
  const view = villaListView({ tasks, locations, snags: [{ location_id: 'b', status: 'Open' }, { location_id: 'b', status: 'Closed' }], ix, asOf });
  it('puts handed-over villas with open works first, then the riskiest', () => expect(view.rows.map((r) => r.villa)).toEqual(['A-01', 'A-02', 'A-03']));
  it('counts open, blocked, overdue and open snags', () => {
    const b = view.rows.find((r) => r.villa === 'A-02');
    expect(b.open).toBe(2);
    expect(b.blocked).toBe(1);
    expect(b.overdue).toBe(1);
    expect(b.snags_open).toBe(1);
  });
  it('a villa with everything closed has nothing open', () => expect(view.rows.find((r) => r.villa === 'A-03').open).toBe(0));
});
