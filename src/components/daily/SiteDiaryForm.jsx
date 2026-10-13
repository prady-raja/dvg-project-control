import React, { useCallback, useEffect, useState } from 'react';
import { CloudSun, Plus, Trash2 } from 'lucide-react';
import { data } from '@/api/data';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { errorMessageOf } from '@/lib/clientErrors';
import { fetchSiteWeather } from '@/lib/weather';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Field from '@/components/common/Field';
import SearchableSelect from '@/components/common/SearchableSelect';
import DataState from '@/components/common/DataState';

const EMPTY = { labour: [], weather_summary: '', temperature_c: '', rain_mm: '', weather_source: 'Manual', work_stopped_hours: '', work_stopped_reason: '', deliveries: [], visitors: '', incidents: '', notes: '' };

/**
 * The site's day (F-03): headcount per contractor counted once, weather (fetched from
 * the project's site location when it has one), hours lost, deliveries, visitors,
 * incidents and notes. Any engineer adds to it; a manager closes the day.
 */
export default function SiteDiaryForm({ projectId, date }) {
  const cat = useCatalogs();
  const access = useAccess();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [diary, setDiary] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canEdit = access.can(projectId, 'edit_tasks');
  const canClose = access.can(projectId, 'manage_project');
  const project = cat.projectById(projectId);
  const locked = diary?.closed === true && !canClose;

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const rows = await data.list('SiteDiary', { project_id: projectId, diary_date: date }, { limit: 1 });
      const row = rows[0] || null;
      setDiary(row);
      setForm(row ? { ...EMPTY, ...row, temperature_c: row.temperature_c ?? '', rain_mm: row.rain_mm ?? '', work_stopped_hours: row.work_stopped_hours ?? '' } : EMPTY);
      setState({ loading: false, error: '' });
    } catch (e) {
      setState({ loading: false, error: errorMessageOf(e, 'The site diary could not be loaded.') });
    }
  }, [projectId, date]);
  useEffect(() => { if (projectId) load(); }, [load, projectId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const total = form.labour.reduce((s, r) => s + (Number(r.heads) || 0), 0);
  const contractors = cat.contractors.filter((c) => c.active !== false);

  const getWeather = async () => {
    const w = await fetchSiteWeather({ lat: project?.site_lat, lng: project?.site_lng, date });
    if (!w) { toast({ description: project?.site_lat == null ? 'Set the site location in the project settings to fetch the weather.' : 'The weather could not be fetched. Type it in.', variant: 'destructive' }); return; }
    set(w);
  };

  const save = async (action = 'save', extra = {}) => {
    setSaving(true);
    setError('');
    try {
      await data.invoke('siteDiary', {
        action, project_id: projectId, diary_date: date, ...form,
        labour: form.labour.map((r) => ({ ...r, heads: r.heads === '' ? '' : Number(r.heads) })),
        ...extra,
      });
      toast({ description: action === 'close' ? 'Day closed.' : action === 'reopen' ? 'Day reopened.' : 'Site diary saved.' });
      await load();
    } catch (e) {
      setError(errorMessageOf(e, 'The diary could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold">Site diary — {date}</h2>
          <p className="text-xs text-muted-foreground">Each crew counted once for the day. {diary?.closed ? `Closed by ${diary.closed_by_name || 'an administrator'}.` : diary ? `Last saved by ${diary.updated_by_name || 'someone'}.` : 'Not written yet.'}</p>
        </div>
        <p className="field-mono text-sm tnum" aria-label="Total on site">{total} on site</p>
      </div>
      <DataState loading={state.loading} error={state.error} onRetry={load}>
        <fieldset disabled={!canEdit || locked || saving} className="mt-4 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who was on site</p>
            {form.labour.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    value={row.contractor_id}
                    onChange={(id) => set({ labour: form.labour.map((r, j) => (j === i ? { ...r, contractor_id: id, contractor_name: contractors.find((c) => c.id === id)?.name || '' } : r)) })}
                    options={contractors.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Contractor"
                  />
                </div>
                <Input type="number" inputMode="numeric" min="0" className="w-24" aria-label="People" value={row.heads} onChange={(e) => set({ labour: form.labour.map((r, j) => (j === i ? { ...r, heads: e.target.value } : r)) })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove crew" onClick={() => set({ labour: form.labour.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => set({ labour: [...form.labour, { contractor_id: '', contractor_name: '', heads: '', villa_ids: [] }] })}><Plus className="h-3.5 w-3.5" /> Add a crew</Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weather</p>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={getWeather}><CloudSun className="h-3.5 w-3.5" /> Fetch for the site</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Conditions"><Input value={form.weather_summary} onChange={(e) => set({ weather_summary: e.target.value, weather_source: 'Manual' })} /></Field>
              <Field label="High (°C)"><Input type="number" inputMode="decimal" value={form.temperature_c} onChange={(e) => set({ temperature_c: e.target.value, weather_source: 'Manual' })} /></Field>
              <Field label="Rain (mm)"><Input type="number" inputMode="decimal" value={form.rain_mm} onChange={(e) => set({ rain_mm: e.target.value, weather_source: 'Manual' })} /></Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Hours lost" hint="Work stopped for part of the day."><Input type="number" inputMode="decimal" min="0" max="24" value={form.work_stopped_hours} onChange={(e) => set({ work_stopped_hours: e.target.value })} /></Field>
              <Field label="Why" className="sm:col-span-2"><Input value={form.work_stopped_reason} onChange={(e) => set({ work_stopped_reason: e.target.value })} /></Field>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliveries</p>
            {form.deliveries.map((d, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                <Input placeholder="Material" aria-label="Material" value={d.material} onChange={(e) => set({ deliveries: form.deliveries.map((x, j) => (j === i ? { ...x, material: e.target.value } : x)) })} />
                <Input placeholder="Quantity" aria-label="Quantity" value={d.quantity} onChange={(e) => set({ deliveries: form.deliveries.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)) })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove delivery" onClick={() => set({ deliveries: form.deliveries.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => set({ deliveries: [...form.deliveries, { material: '', quantity: '' }] })}><Plus className="h-3.5 w-3.5" /> Add a delivery</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Visitors and inspections"><Textarea rows={2} value={form.visitors} onChange={(e) => set({ visitors: e.target.value })} /></Field>
            <Field label="Incidents and near misses"><Textarea rows={2} value={form.incidents} onChange={(e) => set({ incidents: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </fieldset>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {locked && <p className="mt-3 text-sm text-muted-foreground">This day is closed. A manager can reopen it.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && !locked && <Button onClick={() => save('save')} disabled={saving}>{saving ? 'Saving…' : 'Save diary'}</Button>}
          {diary && canClose && (diary.closed
            ? <Button variant="outline" onClick={() => save('reopen')} disabled={saving}>Reopen day</Button>
            : <Button variant="outline" onClick={() => save('close')} disabled={saving}>Close the day</Button>)}
        </div>
      </DataState>
    </section>
  );
}
