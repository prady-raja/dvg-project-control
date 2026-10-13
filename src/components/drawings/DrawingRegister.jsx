import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, SquareArrowOutUpRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { createRecord } from '@/lib/recordService';
import DrawingDialog from '@/components/drawings/DrawingDialog';
import EmptyState from '@/components/common/EmptyState';
import Pill from '@/components/common/Pill';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { useSignedUrls } from '@/lib/useSignedUrls';
import BulkDrawingSheet from '@/components/drawings/BulkDrawingSheet';
import { data } from '@/api/data';

/**
 * The drawing register of one villa. Every revision keeps its own row, so a task
 * can always be traced back to the drawing it was read from. Files live in
 * private storage and are opened with a short-lived link.
 */
export default function DrawingRegister({ location, canManage }) {
  const [drawings, setDrawings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [projectDrawings, setProjectDrawings] = useState([]);

  const load = useCallback(async () => {
    if (!location?.id) return;
    setLoading(true);
    // This villa's own drawings, plus the drawings that apply to every villa of its type.
    const [own, ofType, floorRes, all] = await Promise.all([
      data.readAll('Drawing', { location_id: location.id }, { sort: '-uploaded_date', max: 1000 }),
      location.villa_type ? data.readAll('Drawing', { project_id: location.project_id, villa_type: location.villa_type }, { sort: '-uploaded_date', max: 1000 }) : { items: [] },
      base44.entities.VillaFloor.filter({ location_id: location.id }, { sort: 'level_order', limit: 100 }),
      data.readAll('Drawing', { project_id: location.project_id }, { fields: ['drawing_number', 'revision', 'status', 'location_id', 'floor_id', 'villa_type'], max: 20000 }),
    ]);
    setProjectDrawings(all.items);
    setDrawings([...own.items, ...ofType.items]);
    setFloors(items(floorRes));
    setLoading(false);
  }, [location?.id, location?.villa_type]);

  useEffect(() => {
    load();
  }, [load]);

  const file = async (values) => {
    setSaving(true);
    setError('');
    try {
      const result = await createRecord('Drawing', {
        project_id: location.project_id,
        phase_id: location.phase_id || null,
        location_id: location.id,
        ...values,
      });
      setOpen(false);
      setNotice(
        result?.superseded
          ? `Filed. Revision ${result.superseded} is now shown as superseded and stays on the register.`
          : 'Drawing filed on the register.',
      );
      await load();
    } catch (e) {
      setError(e?.message || 'The drawing could not be filed.');
    } finally {
      setSaving(false);
    }
  };

  // Links are signed before the tap and opened through a plain <a href>: iPhone
  // browsers block window.open when it runs after an await.
  const { urls, failed } = useSignedUrls(drawings.map((d) => d.file_uri).filter(Boolean));

  // The register leads with the revisions in force; superseded sheets are one tap away.
  const shown = showOld ? drawings : drawings.filter((d) => d.status !== 'Superseded');
  const hiddenCount = drawings.length - shown.length;

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-4 w-4" /> Drawing register
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {shown.length} current · {drawings.length - shown.length} older revision{drawings.length - shown.length === 1 ? '' : 's'} kept
            {hiddenCount > 0 && <button type="button" className="ml-2 underline" onClick={() => setShowOld((v) => !v)}>{showOld ? 'Hide' : 'Show'} older</button>}
            {hiddenCount === 0 && showOld && <button type="button" className="ml-2 underline" onClick={() => setShowOld(false)}>Hide older</button>}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkOpen(true)}>Bulk add</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> File drawing
            </Button>
          </div>
        )}
      </div>

      {notice && <p className="mt-3 rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/5 px-3 py-2 text-xs">{notice}</p>}
      {error && <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      {!drawings.length ? (
        <div className="mt-3 rounded-lg border border-border">
          <EmptyState
            icon={FileText}
            title="No drawings filed yet"
            description="File the plan this villa's room register was read from, so every task can point back to it."
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {shown.map((drawing) => (
            <li key={drawing.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {drawing.drawing_number && <span className="field-mono mr-2 text-xs text-muted-foreground">{drawing.drawing_number}</span>}
                  {drawing.title}
                  {drawing.villa_type && !drawing.location_id && <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs uppercase text-muted-foreground">all {drawing.villa_type}</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{drawing.drawing_type}</span>
                  {!!drawing.revision && <span className="field-mono">{drawing.revision}</span>}
                  {!!drawing.revision_date && <span>{formatDate(drawing.revision_date)}</span>}
                  {!!drawing.file_name && <span className="truncate">{drawing.file_name}</span>}
                </p>
              </div>
              <Pill value={drawing.status} />
              {!!drawing.file_uri && (
                urls[drawing.file_uri] ? (
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <a href={urls[drawing.file_uri]} target="_blank" rel="noopener noreferrer">
                      <SquareArrowOutUpRight className="h-3.5 w-3.5" /> Open
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="gap-1.5" disabled>
                    {failed[drawing.file_uri] ? 'Unavailable' : 'Preparing…'}
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <BulkDrawingSheet open={bulkOpen} onOpenChange={setBulkOpen} location={location} floors={floors} existing={projectDrawings} onDone={load} />
      <DrawingDialog
        open={open}
        onOpenChange={setOpen}
        floors={floors}
        onSubmit={file}
        submitting={saving}
      />
    </div>
  );
}