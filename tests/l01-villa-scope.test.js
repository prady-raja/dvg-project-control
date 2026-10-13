// L-01 — floors, rooms and drawings usable from start to finish.
import { describe, expect, it } from 'vitest';
import { planScopeCopy } from '../base44/shared/villaScopeCopy.ts';
import { areaLabelFor } from '../base44/shared/villaAreas.ts';

const sourceFloors = [
  { id: 'f1', floor_code: 'GF', floor_name: 'Ground Floor', level_order: 0 },
  { id: 'f2', floor_code: 'FF', floor_name: 'First Floor', level_order: 1 },
];
const sourceAreas = [
  { id: 'a1', floor_id: 'f1', area_name: 'Living Room' },
  { id: 'a2', floor_id: 'f1', area_name: 'Kitchen' },
  { id: 'a3', floor_id: 'f2', area_name: 'Master Bedroom', aliases: ['MBR'] },
];

describe('L-01 copy floors and rooms', () => {
  it('copies everything to an empty villa, keeping each room on its floor', () => {
    const plan = planScopeCopy({ sourceFloors, sourceAreas });
    expect(plan.floorsToCreate.map((f) => f.floor_code)).toEqual(['GF', 'FF']);
    expect(plan.areasToCreate.map((a) => [a.area_name, a.floorKey])).toEqual([
      ['Living Room', 'gf'], ['Kitchen', 'gf'], ['Master Bedroom', 'ff'],
    ]);
    expect(plan.areasToCreate[2].aliases).toEqual(['MBR']);
  });

  it('skips floors and rooms the target already has', () => {
    const plan = planScopeCopy({
      sourceFloors, sourceAreas,
      targetFloors: [{ id: 'x1', floor_code: 'GF', floor_name: 'Ground Floor' }],
      targetAreas: [{ id: 'y1', area_name: 'kitchen' }],
    });
    expect(plan.floorsToCreate.map((f) => f.floor_code)).toEqual(['FF']);
    expect(plan.areasToCreate.map((a) => a.area_name)).toEqual(['Living Room', 'Master Bedroom']);
    expect(plan.skippedAreas).toEqual(['Kitchen']);
  });

  it('running it again changes nothing', () => {
    const first = planScopeCopy({ sourceFloors, sourceAreas });
    const targetFloors = first.floorsToCreate.map((f, i) => ({ id: `t${i}`, ...f }));
    const targetAreas = first.areasToCreate.map((a, i) => ({ id: `r${i}`, ...a }));
    const again = planScopeCopy({ sourceFloors, sourceAreas, targetFloors, targetAreas });
    expect(again.floorsToCreate).toHaveLength(0);
    expect(again.areasToCreate).toHaveLength(0);
  });

  it('shows scope as floor and rooms', () => {
    expect(areaLabelFor([{ area_name: 'Kitchen' }, { area_name: 'Utility' }], { floor_name: 'GF' })).toBe('GF · Kitchen, Utility');
  });
});
