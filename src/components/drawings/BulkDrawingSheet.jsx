import React, { useCallback, useMemo, useState } from 'react';
import { FileUp, Loader2, RotateCcw } from 'lucide-react';
import { createRecord } from '@/lib/recordService';
import { errorMessageOf } from '@/lib/clientErrors';
import { todayIst } from '@/lib/format';
import { uploadFiles } from '@/lib/photoUpload';
import { DEFAULT_PATTERN, parseDrawingName, planDrawingIntake } from '@shared/drawingIntake.ts';
import { useCatalogs } from '@/lib/CatalogContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EnumSelect from '@/components/common/EnumSelect';
import { cn } from '@/lib/utils';

const STATE_TONE = {
  new: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  newer: 'border-sky-300 bg-sky-50 text-sky-900',
  older: 'border-amber-300 bg-amber-50 text-amber-900',
  duplicate: 'border-red-300 bg-red-50 text-red-900',
  needs_number: 'border-red-300 bg-red-50 text-red-900',
};
const STATE_LABEL = { new: 'New', newer: 'Newer revision', older: 'Older revision', duplicate: 'Duplicate — skipped', needs_number: 'Needs a number' };
const TYPES = ['Floor Plan', 'Furniture Layout', 'Electrical Layout', 'Plumbing Layout', 'Elevation', 'Section', 'Site Plan', 'Detail', 'Other'];

/** A target as one string for a select: villa, villa type, a floor of the villa, or a common area. */
const encode = (t) => (t.villa_type ? `type:${t.villa_type}` : t.floor_id ? `floor:${t.floor_id}` : `loc:${t.location_id}`);

/**
 * Bulk drawing intake (L-08): drop a whole drawing set, read the number, title and
 * revision from the file names, say where each belongs, see what is new, a
 * duplicate or a newer revision, then file them three at a time. A file that fails
 * can be retried on its own.
 */
export default function BulkDrawingSheet({ open, onOpenChange, location, floors = [], existing = [], onDone }) {
  const cat = useCatalogs();
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [rows, setRows] = useState([]);
  const [defaultTarget, setDefaultTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const targets = useMemo(() => {
    const list = [{ value: `loc:${location.id}`, label: `${location.villa_code} (this villa)`, target: { location_id: location.id } }];
    if (location.villa_type) list.push({ value: `type:${location.villa_type}`, label: `Every ${location.villa_type} villa`, target: { villa_type: location.villa_type } });
    floors.forEach((f) => list.push({ value: `floor:${f.id}`, label: `${location.villa_code} · ${f.floor_name}`, target: { location_id: location.id, floor_id: f.id } }));
    cat.locations.filter((l) => l.project_id === location.project_id && l.location_type !== 'Villa').forEach((l) => list.push({ value: `loc:${l.id}`, label: `${l.villa_code} (common area)`, target: { location_id: l.id } }));
    return list;
  }, [location, floors, cat.locations]);
  const targetOf = (value) => (targets.find((t) => t.value === value) || targets[0]).target;
  const initialTarget = defaultTarget || targets[0].value;

  const plan = useCallback((list, within = existing) => planDrawingIntake({
    files: list.map((r) => ({ ...r, target: targetOf(r.targetValue) })),
    existing: within,
  }).map((p, i) => ({ ...list[i], state: p.state, note: p.note })), [existing, targets]); // eslint-disable-line

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []).filter((f) => /\.(pdf|png|jpe?g|dwg|dxf)$/i.test(f.name));
    if (!incoming.length) { setError('Choose PDF or image drawings.'); return; }
    setError('');
    const parsed = incoming.map((file, i) => {
      const p = parseDrawingName(file.name, pattern);
      return { key: `${file.name}-${file.size}-${i}-${Date.now()}`, file, number: p.number, title: p.title, revision: p.revision, drawing_type: 'Floor Plan', targetValue: initialTarget, status: 'ready' };
    });
    setRows((prev) => plan([...prev, ...parsed]));
  };

  const patchRow = (key, patch) => setRows((prev) => plan(prev.map((r) => (r.key === key ? { ...r, ...patch } : r))));
  const reparse = () => setRows((prev) => plan(prev.map((r) => {
    const p = parseDrawingName(r.file.name, pattern);
    return { ...r, number: p.number, title: p.title, revision: p.revision };
  })));
  const retarget = (value) => { setDefaultTarget(value); setRows((prev) => plan(prev.map((r) => ({ ...r, targetValue: value })))); };

  const fileable = rows.filter((r) => ['new', 'newer', 'older'].includes(r.state) && r.status !== 'filed');
  const skipped = rows.filter((r) => ['duplicate', 'needs_number'].includes(r.state)).length;

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const todo = fileable;
      const uploads = await uploadFiles(todo.map((r) => r.file), { onProgress: (p) => setProgress({ ...p, label: 'Uploading' }) });
      for (let i = 0; i < todo.length; i += 1) {
        const row = todo[i];
        const up = uploads[i];
        if (up.error) { setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: 'failed', failure: up.error } : r))); continue; }
        try {
          const t = targetOf(row.targetValue);
          // eslint-disable-next-line no-await-in-loop
          await createRecord('Drawing', {
            project_id: location.project_id,
            phase_id: location.phase_id || null,
            location_id: t.location_id || null,
            floor_id: t.floor_id || null,
            villa_type: t.villa_type || null,
            drawing_number: row.number,
            title: row.title || row.number,
            drawing_type: row.drawing_type,
            revision: row.revision || null,
            uploaded_date: todayIst(),
            file_uri: up.file_uri,
            file_name: row.file.name,
          });
          setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: 'filed', failure: '' } : r)));
        } catch (e) {
          setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: 'failed', failure: errorMessageOf(e), file_uri: up.file_uri } : r)));
        }
        setProgress({ done: i + 1, total: todo.length, label: 'Filing' });
      }
      await onDone?.();
    } catch (e) {
      setError(errorMessageOf(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const filed = rows.filter((r) => r.status === 'filed').length;
  const failed = rows.filter((r) => r.status === 'failed');

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Bulk add drawings</DialogTitle>
          <DialogDescription>Drop many PDFs or images. Numbers, titles and revisions are read from the file names — check them, say where each belongs, then file.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted-foreground">
            File name pattern
            <Input className="mt-1" value={pattern} onChange={(e) => setPattern(e.target.value)} onBlur={reparse} placeholder="{number} - {title} - {rev}" />
          </label>
          <div className="text-xs font-medium text-muted-foreground">
            Belongs to (for all)
            <div className="mt-1"><EnumSelect value={initialTarget} onChange={retarget} options={targets.map(({ value, label }) => ({ value, label }))} /></div>
          </div>
          <div className="flex items-end">
            <Button asChild variant="outline" className="w-full gap-2">
              <label className="cursor-pointer"><FileUp className="h-4 w-4" /> Choose files
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            </Button>
          </div>
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        >
          Drop drawings here. Use <code className="rounded bg-muted px-1">{'{number}'}</code>, <code className="rounded bg-muted px-1">{'{title}'}</code> and <code className="rounded bg-muted px-1">{'{rev}'}</code> in the pattern.
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">File</th><th className="px-2">Number</th><th className="px-2">Title</th><th className="px-2">Rev</th><th className="px-2">Type</th><th className="px-2">Belongs to</th><th className="px-2">Check</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-border align-top">
                    <td className="max-w-[160px] truncate px-2 py-1.5 text-xs" title={r.file.name}>{r.file.name}</td>
                    <td className="px-2 py-1.5"><Input className="h-8 w-28" value={r.number} onChange={(e) => patchRow(r.key, { number: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-8 w-44" value={r.title} onChange={(e) => patchRow(r.key, { title: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><Input className="h-8 w-16" value={r.revision} onChange={(e) => patchRow(r.key, { revision: e.target.value.toUpperCase() })} /></td>
                    <td className="px-2 py-1.5"><EnumSelect size="sm" value={r.drawing_type} onChange={(v) => patchRow(r.key, { drawing_type: v })} options={TYPES} /></td>
                    <td className="px-2 py-1.5"><EnumSelect size="sm" value={r.targetValue} onChange={(v) => patchRow(r.key, { targetValue: v })} options={targets.map(({ value, label }) => ({ value, label }))} /></td>
                    <td className="px-2 py-1.5">
                      {r.status === 'filed' ? <span className="text-xs font-medium text-emerald-800">Filed</span>
                        : r.status === 'failed' ? <span className="text-xs text-destructive">{r.failure}</span>
                          : <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', STATE_TONE[r.state])} title={r.note}>{STATE_LABEL[r.state]}</span>}
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{r.status === 'ready' ? r.note : ''}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" role="status">
            {progress ? `${progress.label} ${progress.done} of ${progress.total}…` : rows.length ? `${fileable.length} to file · ${skipped} will be skipped · ${filed} filed${failed.length ? ` · ${failed.length} failed` : ''}` : 'No files chosen yet.'}
          </p>
          <div className="flex gap-2">
            {failed.length > 0 && !busy && (
              <Button variant="outline" className="gap-1.5" onClick={() => setRows((prev) => prev.map((r) => (r.status === 'failed' ? { ...r, status: 'ready', failure: '' } : r)))}>
                <RotateCcw className="h-4 w-4" /> Retry failed
              </Button>
            )}
            <Button disabled={busy || !fileable.length} onClick={start} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}File {fileable.length} drawing{fileable.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
