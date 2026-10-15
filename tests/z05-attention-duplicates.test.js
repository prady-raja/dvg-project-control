// Needs Attention: the same wording in different rooms is not "the same work twice".
import { describe, expect, it } from 'vitest';
import { attentionFor } from '../base44/shared/attention.ts';

const task = (id, over = {}) => ({
  id, task_ref: `IMG-B-${id}`, project_id: 'p1', location_id: 'v1', discipline: 'Electrical', name: 'Switch plates and switches',
  status: 'Not Started', archived: false, is_demo: false, area_ids: [], floor_id: null, ...over,
});
const dupes = (tasks) => attentionFor({ tasks, locations: [{ id: 'v1', villa_code: 'B-01' }], asOf: '2026-10-15' }).items.filter((i) => i.code === 'possible_duplicate');

describe('possible duplicate', () => {
  it('is not raised for the same wording in different rooms', () => {
    expect(dupes([task('1', { area_ids: ['r1'] }), task('2', { area_ids: ['r2'] })])).toHaveLength(0);
  });
  it('is not raised for rooms not yet registered but named differently', () => {
    expect(dupes([task('1', { source_location_text: 'Kids Bedroom 1' }), task('2', { source_location_text: 'Kids Bedroom 2' })])).toHaveLength(0);
  });
  it('is still raised for the same wording in the same room', () => {
    expect(dupes([task('1', { area_ids: ['r1'] }), task('2', { area_ids: ['r1'] })]).length).toBeGreaterThan(0);
  });
});
