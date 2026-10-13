// L-08 — bulk drawing intake.
import { describe, expect, it } from 'vitest';
import { compareRevisions, compilePattern, parseDrawingName, planDrawingIntake, revisionRank } from '../base44/shared/drawingIntake.ts';

describe('L-08 reading file names', () => {
  it('reads number, title and revision with the default pattern', () => {
    expect(parseDrawingName('IMG-A-101 - Ground Floor Plan - R2.pdf')).toMatchObject({ number: 'IMG-A-101', title: 'Ground Floor Plan', revision: 'R2', matched: true });
  });

  it('copes with underscores and other common ways drawing sets are named', () => {
    expect(parseDrawingName('IMG-A-102_First_Floor_Plan_B.pdf')).toMatchObject({ number: 'IMG-A-102', revision: 'B' });
    expect(parseDrawingName('E-201_Electrical_Layout.pdf')).toMatchObject({ number: 'E-201', title: 'Electrical Layout', revision: '' });
  });

  it('uses the editable pattern first', () => {
    const p = parseDrawingName('Type-A__GF__rev3.pdf', '{number}__{title}__rev{rev}');
    expect(p).toMatchObject({ number: 'Type-A', title: 'GF', revision: '3' });
  });

  it('reports a name it cannot read instead of guessing a number', () => {
    expect(parseDrawingName('scan001.pdf')).toMatchObject({ matched: false, number: '' });
    expect(compilePattern('{title} only')).toBeNull();
    expect(compilePattern('{number} {wat}')).toBeNull();
  });
});

describe('L-08 revisions', () => {
  it('orders numbers and letters naturally', () => {
    expect(revisionRank('R10')).toBeGreaterThan(revisionRank('R2'));
    expect(compareRevisions('B', 'A')).toBeGreaterThan(0);
    expect(compareRevisions('2', 'R2')).toBe(0);
    expect(compareRevisions('', 'A')).toBeLessThan(0);
  });
});

describe('L-08 planning against the register', () => {
  const existing = [
    { drawing_number: 'A-101', revision: 'R2', status: 'Current', location_id: 'v1' },
    { drawing_number: 'A-101', revision: 'R1', status: 'Superseded', location_id: 'v1' },
    { drawing_number: 'T-1', revision: 'A', status: 'Current', villa_type: 'Type A' },
  ];
  const file = (number, revision, target) => ({ number, revision, target });
  const states = (files) => planDrawingIntake({ files, existing }).map((p) => p.state);

  it('flags new, duplicate, newer and older', () => {
    expect(states([
      file('A-102', 'R1', { location_id: 'v1' }),
      file('A-101', 'R2', { location_id: 'v1' }),
      file('A-101', 'R3', { location_id: 'v1' }),
      file('A-101', 'R0', { location_id: 'v1' }),
    ])).toEqual(['new', 'duplicate', 'newer', 'older']);
  });

  it('the same number on another villa is a different drawing, but on the same villa type it is the same one', () => {
    expect(states([file('A-101', 'R2', { location_id: 'v2' })])).toEqual(['new']);
    expect(states([file('T-1', 'B', { villa_type: 'type a' })])).toEqual(['newer']);
  });

  it('a drawing without a number cannot be filed', () => {
    expect(states([file('', 'A', { location_id: 'v1' })])).toEqual(['needs_number']);
  });

  it('files in the same batch are checked against each other', () => {
    expect(states([file('N-1', 'A', { location_id: 'v1' }), file('N-1', 'A', { location_id: 'v1' }), file('N-1', 'B', { location_id: 'v1' })])).toEqual(['new', 'duplicate', 'newer']);
  });
});
