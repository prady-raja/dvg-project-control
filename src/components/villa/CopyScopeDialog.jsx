import React, { useEffect, useMemo, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { data } from '@/api/data';
import { forgetVillaScope } from '@/components/villa/VillaScopePicker';

/**
 * Copy this villa's floors and rooms to other villas. Villas of the same type are
 * listed first; rooms a target already has are skipped, never duplicated.
 */
export default function CopyScopeDialog({ open, onOpenChange, location, locations = [], onDone }) {
  const [chosen, setChosen] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState(null);

  const others = useMemo(
    () => locations
      .filter((l) => l.id !== location?.id && l.project_id === location?.project_id && l.location_type === 'Villa')
      .sort((a, b) => Number(b.villa_type === location?.villa_type && !!location?.villa_type) - Number(a.villa_type === location?.villa_type && !!location?.villa_type)
        || String(a.villa_code).localeCompare(String(b.villa_code))),
    [locations, location],
  );

  useEffect(() => {
    if (!open) return;
    setChosen(location?.villa_type ? others.filter((l) => l.villa_type === location.villa_type).map((l) => l.id) : []);
    setError('');
    setReport(null);
  }, [open, location, others]);

  const toggle = (id, on) => setChosen((c) => (on ? [...new Set([...c, id])] : c.filter((x) => x !== id)));

  const save = async () => {
    if (!chosen.length) {
      setError('Choose at least one villa to copy to.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await data.invoke('villaScopeCopy', { sourceLocationId: location.id, targetLocationIds: chosen });
      chosen.forEach(forgetVillaScope);
      setReport(result.results || []);
      await onDone?.();
    } catch (e) {
      setError(e?.message || 'The copy could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Copy floors & rooms from ${location?.villa_code || ''}`}
      description="Rooms a villa already has are skipped. Nothing is overwritten or removed."
      onSubmit={report ? () => onOpenChange(false) : save}
      submitting={saving}
      submitLabel={report ? 'Done' : 'Copy'}
      error={error}
    >
      {report ? (
        <ul className="space-y-1 text-sm">
          {report.map((row) => (
            <li key={row.location_id}>
              <span className="font-medium">{row.villa || row.location_id}</span>{' '}
              {row.error ? <span className="text-destructive">{row.error}</span>
                : <span className="text-muted-foreground">{row.floors_added} floor(s), {row.rooms_added} room(s) added, {row.rooms_skipped} already there</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
          {others.length === 0 && <p className="text-xs text-muted-foreground">There are no other villas in this project.</p>}
          {others.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={chosen.includes(l.id)} onCheckedChange={(v) => toggle(l.id, v === true)} />
              <span>{l.villa_code}</span>
              {l.villa_type && <span className="text-xs text-muted-foreground">{l.villa_type}</span>}
            </label>
          ))}
        </div>
      )}
    </FormDialog>
  );
}
