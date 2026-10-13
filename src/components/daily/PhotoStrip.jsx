import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { useSignedUrls } from '@/lib/useSignedUrls';
import PhotoLightbox from '@/components/common/PhotoLightbox';

/**
 * Photos stay folded away until asked for: each one needs a freshly signed link,
 * so nothing is fetched for a report the reader does not open. Every photo is
 * signed, a few at a time, with a running count while they arrive. A tap opens the
 * full-screen viewer with the captions (F-05).
 */
export default function PhotoStrip({ uris, captions = {} }) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const list = uris || [];
  const { urls, failed, signed } = useSignedUrls(list, { enabled: open });
  if (!list.length) return null;

  const pending = open && signed + Object.keys(failed).length < list.length;

  return (
    <div className="space-y-2">
      <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs text-muted-foreground" onClick={() => setOpen((v) => !v)}>
        <Camera className="h-3.5 w-3.5" />
        {list.length} photo{list.length === 1 ? '' : 's'}
        {pending ? ` · opening ${signed}/${list.length}` : ''}
      </Button>
      {open && (
        <div className="flex flex-wrap gap-2">
          {list.map((uri, index) => {
            const url = urls[uri];
            if (url) {
              return (
                <button key={uri} type="button" onClick={() => setViewing(index)} className="text-left" aria-label={`Open photo ${index + 1}${captions[uri] ? `: ${captions[uri]}` : ''}`}>
                  <Image src={url} alt={captions[uri] || `Site photo ${index + 1}`} className="h-24 w-24 rounded-lg border border-border object-cover" />
                  {captions[uri] && <span className="mt-0.5 block max-w-[6rem] truncate text-xs text-muted-foreground">{captions[uri]}</span>}
                </button>
              );
            }
            return (
              <div key={uri} className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                {failed[uri] ? 'Could not open' : 'Opening…'}
              </div>
            );
          })}
        </div>
      )}
      <PhotoLightbox open={viewing !== null} onOpenChange={(v) => !v && setViewing(null)} uris={list} captions={captions} urls={urls} startIndex={viewing || 0} />
    </div>
  );
}
