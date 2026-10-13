// Pure geometry for photo markup (F-05): the shapes a person can draw, kept as data
// so they can be redrawn after an undo and tested without a canvas.

export const TOOLS = ['arrow', 'circle', 'pen', 'text'];

/** The two short strokes that make an arrow head at (x2, y2), pointing away from (x1, y1). */
export function arrowHead(x1, y1, x2, y2, size = 22) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  return [
    [x2 - size * Math.cos(angle - spread), y2 - size * Math.sin(angle - spread)],
    [x2 - size * Math.cos(angle + spread), y2 - size * Math.sin(angle + spread)],
  ];
}

/** An ellipse that fits the drag from corner to corner. */
export function ellipseOf(x1, y1, x2, y2) {
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, rx: Math.abs(x2 - x1) / 2, ry: Math.abs(y2 - y1) / 2 };
}

/** A shape worth keeping: a tap with no drag is not a circle or an arrow. */
export function isMeaningful(shape, minimum = 6) {
  if (shape.type === 'text') return !!String(shape.text || '').trim();
  if (shape.type === 'pen') return (shape.points || []).length > 2;
  return Math.hypot((shape.x2 ?? 0) - (shape.x1 ?? 0), (shape.y2 ?? 0) - (shape.y1 ?? 0)) >= minimum;
}

/** Draw every shape onto a 2D context (the canvas, or a test double). */
export function drawShapes(ctx, shapes, { color = '#e11d48', lineWidth = 6, fontSize = 44 } = {}) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  shapes.forEach((s) => {
    ctx.beginPath();
    if (s.type === 'arrow') {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      arrowHead(s.x1, s.y1, s.x2, s.y2).forEach(([hx, hy]) => { ctx.moveTo(s.x2, s.y2); ctx.lineTo(hx, hy); });
      ctx.stroke();
    } else if (s.type === 'circle') {
      const e = ellipseOf(s.x1, s.y1, s.x2, s.y2);
      ctx.ellipse(e.cx, e.cy, Math.max(e.rx, 1), Math.max(e.ry, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.type === 'pen') {
      (s.points || []).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    } else if (s.type === 'text') {
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(s.text, s.x1, s.y1);
      ctx.fillText(s.text, s.x1, s.y1);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
    }
  });
}
