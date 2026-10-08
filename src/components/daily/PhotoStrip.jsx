import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';

/**
 * Photos stay folded away until asked for: each one needs a freshly signed link,
 * so nothing is fetched for a report the reader does not open.
 */
export default function PhotoStrip({ uris }) {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(false);

  const list = uris || [];
  if (!list.length) return null;

  const reveal = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (urls.length) return;
    setLoading(true);
    const signed = await Promise.all(
      list.slice(0, 6).map((uri) =>
        base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri })
          .then((res) => res?.signed_url || res?.data?.signed_url || null)
          .catch(() => null),
      ),
    );
    setUrls(signed.filter(Boolean));
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" onClick={reveal}>
        <Camera className="h-3.5 w-3.5" />
        {list.length} photo{list.length === 1 ? '' : 's'}
        {loading ? ' · opening…' : ''}
      </Button>
      {open && !loading && (
        <div className="flex flex-wrap gap-2">
          {urls.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Photos could not be opened just now.</p>
          ) : (
            urls.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <Image src={url} alt={`Site photo ${index + 1}`} className="h-24 w-24 rounded-lg border border-border object-cover" />
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}