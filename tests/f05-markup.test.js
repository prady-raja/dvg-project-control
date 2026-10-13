import { describe, expect, it } from 'vitest';
import { arrowHead, drawShapes, ellipseOf, isMeaningful } from '@/lib/markup';

describe('markup geometry', () => {
  it('the arrow head points back from the tip', () => {
    const [a, b] = arrowHead(0, 0, 100, 0, 20);
    expect(a[0]).toBeLessThan(100);
    expect(b[0]).toBeLessThan(100);
    expect(a[1]).toBeCloseTo(-b[1]);
  });
  it('an ellipse fits the drag', () => expect(ellipseOf(10, 20, 50, 60)).toEqual({ cx: 30, cy: 40, rx: 20, ry: 20 }));
  it('a tap is not a shape', () => {
    expect(isMeaningful({ type: 'arrow', x1: 5, y1: 5, x2: 6, y2: 5 })).toBe(false);
    expect(isMeaningful({ type: 'circle', x1: 0, y1: 0, x2: 40, y2: 40 })).toBe(true);
    expect(isMeaningful({ type: 'text', text: '  ' })).toBe(false);
    expect(isMeaningful({ type: 'pen', points: [[0, 0], [1, 1]] })).toBe(false);
  });
  it('draws each shape once, in order', () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]), set: () => true });
    drawShapes(ctx, [{ type: 'arrow', x1: 0, y1: 0, x2: 50, y2: 50 }, { type: 'circle', x1: 0, y1: 0, x2: 20, y2: 20 }]);
    expect(calls.filter(([n]) => n === 'stroke')).toHaveLength(2);
    expect(calls.some(([n]) => n === 'ellipse')).toBe(true);
  });
});
