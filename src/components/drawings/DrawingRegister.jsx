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

  const load = useCallback(async () => {
    if (!location?.id) return;
    setLoading(true);
    const [drawingRes, floorRes] = await Promise.all([
      base44.entities.Drawing.filter({ location_id: location.id }, { sort: '-uploaded_date', limit: 100 }),
      base44.entities.VillaFloor.filter({ location_id: location.id }, { sort: 'level_order', limit: 100 }),
    ]);
    setDrawings(items(drawingRes));
    setFloors(items(floorRes));
    setLoading(false);
  }, [location?.id]);

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

  const openFile = async (drawing) => {
    setError('');
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: drawing.file_uri, expires_in: 300 });
      window.open(signed_url, '_blank', 'noopener');
    } catch (e) {
      setError(e?.message || 'The drawing file could not be opened.');
    }
  };

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-4 w-4" /> Drawing register
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {drawings.length} file{drawings.length === 1 ? '' : 's'} filed · every revision kept, newest shown as current.
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> File drawing
          </Button>
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
          {drawings.map((drawing) => (
            <li key={drawing.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{drawing.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>{drawing.drawing_type}</span>
                  {!!drawing.revision && <span className="field-mono">{drawing.revision}</span>}
                  {!!drawing.revision_date && <span>{formatDate(drawing.revision_date)}</span>}
                  {!!drawing.file_name && <span className="truncate">{drawing.file_name}</span>}
                </p>
              </div>
              <Pill value={drawing.status} />
              {!!drawing.file_uri && (
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openFile(drawing)}>
                  <SquareArrowOutUpRight className="h-3.5 w-3.5" /> Open
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

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