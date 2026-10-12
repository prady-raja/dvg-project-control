import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { MAX_PHOTOS } from '@/lib/constants';

/**
 * Site photos are optional on every report. A chosen file uploads straight away
 * so saving stays instant, and the pictures are kept privately — no public URL.
 */
export default function PhotoUploader({ photos, onChange, onBusy }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusyState] = useState(false);
  const [error, setError] = useState('');

  // The report must not be saved while a photo is still on its way up.
  const setBusy = (value) => {
    setBusyState(value);
    onBusy?.(value);
  };

  const pick = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    const added = [];
    const room = Math.max(MAX_PHOTOS - (photos || []).length, 0);
    if (files.length > room) setError(`A report holds up to ${MAX_PHOTOS} photos, so ${files.length - room} were left out.`);
    for (const file of files.slice(0, room)) {
      try {
        const res = await base44.integrations.Core.UploadPrivateFile({ file });
        const file_uri = res?.file_uri || res?.data?.file_uri;
        if (file_uri) added.push({ file_uri, preview: URL.createObjectURL(file) });
      } catch {
        setError('A photo did not upload. The update can still be saved without it.');
      }
    }
    if (added.length) onChange([...(photos || []), ...added]);
    setBusy(false);
  };

  const list = photos || [];
  const full = list.length >= MAX_PHOTOS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={busy || full} onClick={() => cameraRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Camera
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={busy || full} onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> Gallery
        </Button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />

      {list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {list.map((photo, index) => (
            <div key={`${photo.file_uri}-${index}`} className="relative">
              <Image
                src={photo.preview}
                alt="Site photo"
                className="h-16 w-16 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-card p-0.5 text-muted-foreground"
                onClick={() => onChange(list.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {list.length > 0 && <p className="text-[11px] text-muted-foreground">{list.length} of {MAX_PHOTOS} photos attached.</p>}
    </div>
  );
}