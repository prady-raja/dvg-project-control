import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { data } from '@/api/data';
import { useCatalogs } from '@/lib/CatalogContext';
import { useQuickActions } from '@/components/layout/QuickActions';
import { errorMessageOf } from '@/lib/clientErrors';
import { uploadPhotos } from '@/lib/photoUpload';
import { RESULTS, failedItems, overallOf, snagFromFailure, templateFor } from '@/lib/shared/checklists.ts';
import FormDialog from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TONE = { Pass: 'border-emerald-600 bg-emerald-600 text-white', Fail: 'border-red-600 bg-red-600 text-white', 'N/A': 'border-slate-500 bg-slate-500 text-white' };

/**
 * Inspect with a checklist. Optional, and it records what was looked at: it changes no
 * status and decides nobody's approval. A Fail can be turned into a snag with the
 * wording, photo and villa already filled in.
 */
export default function InspectionChecklistDialog({ open, onOpenChange, subjectType, subject, onSaved }) {
  const cat = useCatalogs();
  const quick = useQuickActions();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const [busyPhoto, setBusyPhoto] = useState(-1);
  const fileRef = useRef(null);
  const photoFor = useRef(-1);

  useEffect(() => {
    if (!open || !subject) return;
    const template = templateFor(subject.discipline, cat.disciplineByCode(subject.discipline)?.checklist_template);
    setRows(template.map((text) => ({ text, result: '', comment: '', photo_uri: '' })));
    setSaved(null);
    setError('');
  }, [open, subject, cat]);

  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const i = photoFor.current;
    if (!file || i < 0) return;
    setBusyPhoto(i);
    const { photos } = await uploadPhotos([file]);
    if (photos[0]) set(i, { photo_uri: photos[0].file_uri });
    else setError('The photo did not upload.');
    setBusyPhoto(-1);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const out = await data.invoke('inspectionWrite', {
        subject_type: subjectType, task_id: subjectType === 'Task' ? subject.id : undefined, snag_id: subjectType === 'Snag' ? subject.id : undefined, items: rows,
      });
      setSaved(out.checklist);
      onSaved?.(out.checklist);
    } catch (e) {
      setError(errorMessageOf(e, 'The checklist could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    const failed = failedItems(saved.items);
    return (
      <FormDialog open={open} onOpenChange={onOpenChange} title={saved.overall === 'Pass' ? 'Checklist saved: all clear' : `Checklist saved: ${failed.length} to fix`} description="The checklist is recorded. No status was changed." onSubmit={() => onOpenChange(false)} submitLabel="Done">
        {failed.length ? (
          <ul className="space-y-2">
            {failed.map((item) => (
              <li key={item.text} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{item.text}</p>
                <p className="text-xs text-muted-foreground">{item.comment}</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => { onOpenChange(false); quick.openSnag({ locationId: subject.location_id, prefill: snagFromFailure({ item, subject, subjectType }) }); }}>
                  Raise snag
                </Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Nothing failed.</p>}
      </FormDialog>
    );
  }

  const answered = rows.every((r) => r.result);
  const overall = answered ? overallOf(rows) : '';
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Inspection checklist" description={`${subject?.task_ref || subject?.snag_ref || ''} — optional. It records what you looked at and changes no status.`} onSubmit={save} submitting={saving} submitLabel={answered ? `Save (${overall})` : 'Save'} error={error} size="sm:max-w-xl">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
      <ul className="space-y-3">
        {rows.map((row, i) => (
          <li key={row.text} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{row.text}</p>
            <div className="mt-2 flex gap-2" role="group" aria-label={row.text}>
              {RESULTS.map((r) => (
                <button key={r} type="button" aria-pressed={row.result === r} onClick={() => set(i, { result: r })}
                  className={cn('min-h-11 flex-1 rounded-lg border text-sm font-medium', row.result === r ? TONE[r] : 'border-border bg-card')}>{r}</button>
              ))}
            </div>
            {row.result === 'Fail' && (
              <div className="mt-2 space-y-2">
                <Input value={row.comment} onChange={(e) => set(i, { comment: e.target.value })} placeholder="What is wrong?" aria-label={`What is wrong with ${row.text}`} />
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={busyPhoto === i} onClick={() => { photoFor.current = i; fileRef.current?.click(); }}>
                  {busyPhoto === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {row.photo_uri ? 'Photo attached' : 'Add a photo'}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </FormDialog>
  );
}
