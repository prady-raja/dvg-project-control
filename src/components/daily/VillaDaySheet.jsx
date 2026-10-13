import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { data } from '@/api/data';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { errorMessageOf } from '@/lib/clientErrors';
import { daySheetRows, orderTasks, statusChips } from '@/lib/logUpdate';
import { submitDailyBatch } from '@/lib/dailyService';
import { REPORTABLE_STATUSES } from '@/lib/taskForm';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import SearchableSelect from '@/components/common/SearchableSelect';
import DataState from '@/components/common/DataState';
import { cn } from '@/lib/utils';

/**
 * The Villa Day Sheet (F-04): every open task of one villa on one screen, with a status
 * and a progress stepper and a "done today" note each, saved together. The crews on
 * site go into that day's site diary once. Blockers are raised from Log update, which
 * asks for an owner and a date.
 */
export default function VillaDaySheet({ open, onOpenChange, locationId, date, onSaved }) {
  const cat = useCatalogs();
  const { user } = useAuth();
  const { toast } = useToast();
  const location = locationId ? cat.locationById(locationId) : null;
  const [tasks, setTasks] = useState([]);
  const [edits, setEdits] = useState({});
  const [crews, setCrews] = useState([]);
  const [diary, setDiary] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState({});

  const load = useCallback(async () => {
    if (!locationId) return;
    setState({ loading: true, error: '' });
    try {
      const [res, diaries] = await Promise.all([
        data.readAll('Task', { location_id: locationId, archived: { $ne: true }, is_villa_work_parent: { $ne: true }, status: { $in: REPORTABLE_STATUSES } }, { max: 500 }),
        location ? data.list('SiteDiary', { project_id: location.project_id, diary_date: date }, { limit: 1 }) : Promise.resolve([]),
      ]);
      setTasks(orderTasks(res.items, { id: user?.id }));
      setDiary(diaries[0] || null);
      setCrews([]);
      setEdits({});
      setFailed({});
      setState({ loading: false, error: '' });
    } catch (e) {
      setState({ loading: false, error: errorMessageOf(e, 'The tasks could not be loaded.') });
    }
  }, [locationId, location, date, user?.id]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const edit = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }));
  const rows = useMemo(() => daySheetRows(edits, tasks), [edits, tasks]);
  const contractors = cat.contractors.filter((c) => c.active !== false);
  const crewRows = crews.filter((c) => c.contractor_id && c.heads !== '');

  const save = async () => {
    setSaving(true);
    setFailed({});
    try {
      if (rows.length) {
        const out = await submitDailyBatch({ updateDate: date, rows });
        const bad = Object.fromEntries((out.results || []).filter((r) => !r.ok).map((r) => [r.client_ref, r.error]));
        setFailed(bad);
        if (out.failed) {
          toast({ description: `${out.saved} saved, ${out.failed} not saved. The rows that failed are marked.`, variant: 'destructive' });
          onSaved?.();
          // Keep only the failed rows so they can be corrected and saved again.
          setEdits((e) => Object.fromEntries(Object.entries(e).filter(([id]) => bad[id])));
          return;
        }
      }
      if (crewRows.length && location) {
        const labour = [...(diary?.labour || []).filter((l) => !crewRows.some((c) => c.contractor_id === l.contractor_id)), ...crewRows.map((c) => ({ contractor_id: c.contractor_id, contractor_name: c.contractor_name, heads: Number(c.heads), villa_ids: [locationId] }))];
        await data.invoke('siteDiary', { action: 'save', project_id: location.project_id, diary_date: date, ...(diary || {}), labour });
      }
      toast({ description: `${rows.length} task${rows.length === 1 ? '' : 's'} saved${crewRows.length ? ' and the crews added to the site diary' : ''}.` });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ description: errorMessageOf(e, 'The day sheet could not be saved.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Day sheet — {location?.villa_code || 'villa'}</DrawerTitle>
          <DrawerDescription>{date}. Change what moved today; the rest stays as it is.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-4">
          <DataState loading={state.loading} error={state.error} onRetry={load} empty={!state.loading && !tasks.length} emptyTitle="No open tasks" emptyDescription="Everything in this villa is finished or not yet reportable.">
            {tasks.map((task) => {
              const e = edits[task.id] || {};
              const progress = e.progress === undefined ? (task.progress_percent ?? '') : e.progress;
              const status = e.status || task.status;
              return (
                <article key={task.id} className={cn('rounded-lg border p-3', failed[task.id] ? 'border-destructive/60' : 'border-border')}>
                  <p className="text-sm font-medium"><span className="field-mono text-xs text-muted-foreground">{task.task_ref}</span> {task.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {statusChips(task).filter((c) => !c.opensBlockSheet).map((c) => (
                      <button key={c.status} type="button" onClick={() => edit(task.id, { status: c.status })}
                        className={cn('min-h-9 rounded-full border px-3 text-xs font-medium', status === c.status ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}>{c.status}</button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label="Less progress" onClick={() => edit(task.id, { progress: Math.max(0, (Number(progress) || 0) - 10) })}><Minus className="h-4 w-4" /></Button>
                    <span className="field-mono w-16 text-center text-sm tnum" aria-live="polite">{progress === '' ? '—' : `${progress}%`}</span>
                    <Button type="button" variant="outline" size="icon" aria-label="More progress" onClick={() => edit(task.id, { progress: Math.min(100, (Number(progress) || 0) + 10) })}><Plus className="h-4 w-4" /></Button>
                    <Input className="min-w-0 flex-1" placeholder="Done today (optional)" aria-label={`Done today on ${task.task_ref}`} value={e.note || ''} onChange={(ev) => edit(task.id, { note: ev.target.value })} />
                  </div>
                  {failed[task.id] && <p role="alert" className="mt-2 text-xs text-destructive">{failed[task.id]}</p>}
                </article>
              );
            })}

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Crews on site today (counted once, in the site diary)</p>
              {crews.map((c, i) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchableSelect value={c.contractor_id} options={contractors.map((x) => ({ value: x.id, label: x.name }))} placeholder="Contractor"
                      onChange={(id) => setCrews(crews.map((x, j) => (j === i ? { ...x, contractor_id: id, contractor_name: contractors.find((k) => k.id === id)?.name || '' } : x)))} />
                  </div>
                  <Input type="number" inputMode="numeric" min="0" className="w-24" aria-label="People" value={c.heads} onChange={(ev) => setCrews(crews.map((x, j) => (j === i ? { ...x, heads: ev.target.value } : x)))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setCrews([...crews, { contractor_id: '', contractor_name: '', heads: '' }])}><Plus className="h-3.5 w-3.5" /> Add a crew</Button>
            </div>
          </DataState>
        </div>
        <DrawerFooter className="border-t border-border bg-background">
          <Button size="lg" className="h-12 gap-2 text-base" disabled={saving || (!rows.length && !crewRows.length)} onClick={save}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : `Save ${rows.length} task${rows.length === 1 ? '' : 's'}${crewRows.length ? ' and crews' : ''}`}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
