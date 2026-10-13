import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { useSignedUrls } from '@/lib/useSignedUrls';

/**
 * Photos stay folded away until asked for: each one needs a freshly signed link,
 * so nothing is fetched for a report the reader does not open. Every photo is
 * signed, a few at a time, with a running count while they arrive.
 */
export default function PhotoStrip({ uris }) {
  const [open, setOpen] = useState(false);
  const list = uris || [];
  const { urls, failed, signed } = useSignedUrls(list, { enabled: open });
  if (!list.length) return null;

  const pending = open && signed + Object.keys(failed).length < list.length;

  return (
    <div className="space-y-2">
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" onClick={() => setOpen((v) => !v)}>
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
                <a key={uri} href={url} target="_blank" rel="noreferrer">
                  <Image src={url} alt={`Site photo ${index + 1}`} className="h-24 w-24 rounded-lg border border-border object-cover" />
                </a>
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
    </div>
  );
}
