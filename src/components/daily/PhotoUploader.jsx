import React, { useRef, useState } from 'react';
import { Brush, Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import { MAX_PHOTOS } from '@/lib/constants';
import { uploadPhotos } from '@/lib/photoUpload';
import { useSignedUrls } from '@/lib/useSignedUrls';
import PhotoLightbox from '@/components/common/PhotoLightbox';
import PhotoMarkup from '@/components/common/PhotoMarkup';

/**
 * Site photos are optional on every report. A chosen file uploads straight away
 * so saving stays instant, and the pictures are kept privately — no public URL.
 * Each photo can carry a caption, be opened full screen and be marked up (F-05).
 */
export default function PhotoUploader({ photos, onChange, onBusy }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusyState] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [marking, setMarking] = useState(null);
  const list = photos || [];
  const target = marking !== null ? list[marking] : null;
  const signed = useSignedUrls(target && !target.preview ? [target.file_uri] : [], { enabled: !!target && !target.preview });
  const markSrc = target ? (target.preview || signed.urls[target.file_uri] || '') : '';

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
    const room = Math.max(MAX_PHOTOS - list.length, 0);
    if (files.length > room) setError(`A report holds up to ${MAX_PHOTOS} photos, so ${files.length - room} were left out.`);
    const { photos: added, failed } = await uploadPhotos(files.slice(0, room), {
      onProgress: ({ done, total }) => setProgress({ done, total }),
    });
    if (failed.length) setError(`${failed.length} photo${failed.length === 1 ? '' : 's'} did not upload (${failed.slice(0, 2).join(', ')}). The update can still be saved without ${failed.length === 1 ? 'it' : 'them'}.`);
    if (added.length) onChange([...list, ...added]);
    setProgress(null);
    setBusy(false);
  };

  const caption = (index, text) => onChange(list.map((p, i) => (i === index ? { ...p, caption: text } : p)));

  const markedCopy = async (blob) => {
    const index = marking;
    setMarking(null);
    setBusy(true);
    setError('');
    const { photos: added, failed } = await uploadPhotos([new File([blob], 'marked-up.jpg', { type: 'image/jpeg' })]);
    if (failed.length || !added.length) setError('The marked-up photo did not upload. The original is unchanged.');
    else {
      const old = list[index];
      // The marked copy becomes the photo on the report; the original is kept beside it.
      onChange(list.map((p, i) => (i === index ? { ...added[0], caption: old.caption || '', original_uri: old.original_uri || old.file_uri } : p)));
    }
    setBusy(false);
  };

  const full = list.length >= MAX_PHOTOS;
  const allPreviews = list.length > 0 && list.every((p) => p.preview);

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
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((photo, index) => (
            <li key={`${photo.file_uri}-${index}`} className="flex gap-2 rounded-lg border border-border p-2">
              <button type="button" aria-label={`Open photo ${index + 1}`} onClick={() => setViewing(index)} className="shrink-0">
                {photo.preview ? (
                  <Image src={photo.preview} alt="Site photo" className="h-16 w-16 rounded-lg border border-border object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground" title="Uploaded earlier">
                    <Camera className="h-5 w-5" />
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input value={photo.caption || ''} maxLength={200} onChange={(e) => caption(index, e.target.value)} placeholder="What does it show?" aria-label={`Caption for photo ${index + 1}`} />
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" disabled={busy} onClick={() => setMarking(index)}>
                    <Brush className="h-3.5 w-3.5" /> {photo.original_uri ? 'Mark up again' : 'Mark up'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 gap-1 px-2 text-xs text-muted-foreground" aria-label={`Remove photo ${index + 1}`} onClick={() => onChange(list.filter((_, i) => i !== index))}>
                    <X className="h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PhotoLightbox
        open={viewing !== null}
        onOpenChange={(v) => !v && setViewing(null)}
        uris={list.map((p) => p.file_uri)}
        captions={Object.fromEntries(list.map((p) => [p.file_uri, p.caption || '']))}
        urls={allPreviews ? Object.fromEntries(list.map((p) => [p.file_uri, p.preview])) : undefined}
        startIndex={viewing || 0}
      />
      <PhotoMarkup open={marking !== null && !!markSrc} src={markSrc} onCancel={() => setMarking(null)} onDone={markedCopy} />

      {progress && <p className="text-xs text-muted-foreground" role="status">Uploading {progress.done} of {progress.total}…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {list.length > 0 && <p className="text-xs text-muted-foreground">{list.length} of {MAX_PHOTOS} photos attached.</p>}
    </div>
  );
}
