import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useSignedUrls } from '@/lib/useSignedUrls';

/**
 * A full-screen photo viewer (F-05): swipe or use the arrows to move between a
 * report's photos, with the caption underneath. `urls` may be passed when the
 * caller has already signed them; otherwise they are signed here.
 */
export default function PhotoLightbox({ uris = [], captions = {}, startIndex = 0, open, onOpenChange, urls: given }) {
  const [index, setIndex] = useState(startIndex);
  const own = useSignedUrls(uris, { enabled: open && !given });
  const urls = given || own.urls;
  const touch = useRef(null);

  useEffect(() => { if (open) setIndex(startIndex); }, [open, startIndex]);
  const step = useCallback((d) => setIndex((i) => (uris.length ? (i + d + uris.length) % uris.length : 0)), [uris.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  const uri = uris[index];
  const url = urls?.[uri];
  const onTouchEnd = (e) => {
    const start = touch.current;
    touch.current = null;
    if (start === null || start === undefined) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] gap-0 border-0 bg-black/95 p-0 text-white sm:max-w-4xl [&>button]:hidden">
        <DialogTitle className="sr-only">Photo {index + 1} of {uris.length}</DialogTitle>
        <DialogDescription className="sr-only">{captions[uri] || 'Site photo'}</DialogDescription>
        <div className="relative flex min-h-[50vh] items-center justify-center" onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={onTouchEnd}>
          {url ? <img src={url} alt={captions[uri] || `Site photo ${index + 1}`} className="max-h-[80vh] max-w-full object-contain" /> : <p className="text-sm text-white/70">Opening…</p>}
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60"><X className="h-5 w-5" /></button>
          {uris.length > 1 && (
            <>
              <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60"><ChevronRight className="h-5 w-5" /></button>
            </>
          )}
        </div>
        <div className="px-4 py-3 text-sm">
          <p>{captions[uri] || <span className="text-white/60">No caption</span>}</p>
          <p className="mt-1 text-xs text-white/60">{index + 1} of {uris.length}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
