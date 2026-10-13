import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Circle, Pencil, Type, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { drawShapes, isMeaningful } from '@/lib/markup';
import { fitWithin } from '@/lib/photoUpload';
import { cn } from '@/lib/utils';

const TOOL_ICONS = { arrow: ArrowUpRight, circle: Circle, pen: Pencil, text: Type };
const TOOL_LABELS = { arrow: 'Arrow', circle: 'Circle', pen: 'Draw', text: 'Text' };

/**
 * Mark up a photo (F-05): arrow, circle, freehand or a short label, drawn on the
 * picture itself. The marked copy is handed back as a JPEG; the caller keeps the
 * untouched original beside it. Photos that were uploaded earlier and cannot be read
 * back by the browser cannot be marked — it says so rather than saving a blank.
 */
export default function PhotoMarkup({ open, src, onDone, onCancel }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [shapes, setShapes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [tool, setTool] = useState('arrow');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const redraw = useCallback((extra = null) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawShapes(ctx, extra ? [...shapes, extra] : shapes, { lineWidth: Math.max(4, canvas.width / 220), fontSize: Math.max(28, canvas.width / 28) });
  }, [shapes]);

  useEffect(() => {
    if (!open || !src) return undefined;
    let alive = true;
    setShapes([]); setDraft(null); setError(''); setReady(false); setLabel('');
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      imageRef.current = img;
      setReady(true);
    };
    img.onerror = () => alive && setError('This photo cannot be opened for marking.');
    img.src = src;
    return () => { alive = false; };
  }, [open, src]);

  useEffect(() => { if (ready) redraw(draft); }, [ready, redraw, draft]);

  const point = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height];
  };
  const down = (e) => {
    if (!ready) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const [x, y] = point(e);
    if (tool === 'text') {
      if (label.trim()) setShapes((s) => [...s, { type: 'text', text: label.trim(), x1: x, y1: y }]);
      return;
    }
    setDraft(tool === 'pen' ? { type: 'pen', points: [[x, y]] } : { type: tool, x1: x, y1: y, x2: x, y2: y });
  };
  const move = (e) => {
    if (!draft) return;
    const [x, y] = point(e);
    setDraft((d) => (d.type === 'pen' ? { ...d, points: [...d.points, [x, y]] } : { ...d, x2: x, y2: y }));
  };
  const up = () => {
    if (draft && isMeaningful(draft)) setShapes((s) => [...s, draft]);
    setDraft(null);
  };

  const finish = () => {
    try {
      canvasRef.current.toBlob((blob) => {
        if (!blob) { setError('The marked photo could not be saved.'); return; }
        onDone(blob);
      }, 'image/jpeg', 0.85);
    } catch {
      setError('This photo was uploaded earlier and cannot be marked here. Mark it up on a new photo instead.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-h-[96vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mark up the photo</DialogTitle>
          <DialogDescription>Show exactly which crack, socket or edge is meant. The original is kept.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(TOOL_ICONS).map((key) => {
            const Icon = TOOL_ICONS[key];
            return (
              <button key={key} type="button" onClick={() => setTool(key)} aria-pressed={tool === key}
                className={cn('flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm', tool === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}>
                <Icon className="h-4 w-4" aria-hidden /> {TOOL_LABELS[key]}
              </button>
            );
          })}
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={!shapes.length} onClick={() => setShapes((s) => s.slice(0, -1))}><Undo2 className="h-4 w-4" /> Undo</Button>
        </div>
        {tool === 'text' && <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Type the label, then tap where it goes" aria-label="Label text" maxLength={40} />}
        <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="max-h-[60vh] w-full touch-none rounded-lg border border-border bg-muted object-contain" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={!ready || !shapes.length} onClick={finish}>Use marked photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
