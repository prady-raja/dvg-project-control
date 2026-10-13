import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2 } from 'lucide-react';
import { data } from '@/api/data';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { errorMessageOf } from '@/lib/clientErrors';
import { todayIst } from '@/lib/format';
import { submitDailyUpdate, voidDailyUpdate } from '@/lib/dailyService';
import {
  PROGRESS_CHIPS, photoMetaOf, clearDraft, isRestorable, loadDraft, loadRecentVillas, nextProgress, orderTasks, rememberVilla, saveDraft, statusChips,
} from '@/lib/logUpdate';
import { REPORTABLE_STATUSES } from '@/lib/taskForm';
import { areaLabelFor } from '@/lib/shared/villaAreas.ts';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import EnumSelect from '@/components/common/EnumSelect';
import StatusPill from '@/components/common/StatusPill';
import PhotoUploader from '@/components/daily/PhotoUploader';
import FloorRoomPicker from '@/components/villa/FloorRoomPicker';
import { useVillaScope } from '@/components/villa/VillaScopePicker';
import { cn } from '@/lib/utils';

const EMPTY = { locationId: '', taskId: '', status: '', progress: '', note: '', photos: [], floor_id: '', area_ids: [] };
const SITE_WIDE = '__site__';

const Chip = ({ active, children, onClick, tone = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'min-h-10 rounded-full border px-4 text-sm font-medium transition-colors active:scale-95',
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground',
      tone,
    )}
  >
    {children}
  </button>
);

const Step = ({ n, title, children }) => (
  <section className="space-y-2">
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs">{n}</span>{title}
    </h3>
    {children}
  </section>
);

/**
 * Log update — one path for site progress (F-01). Pick the villa, pick the task,
 * tap a status and a progress chip, add a photo, save: a few taps. It always goes
 * through the daily report on the server, starts from the task's own values, keeps
 * an unsent draft on the phone, shrinks photos before upload, and offers Undo.
 */
export default function LogUpdateDrawer({ open, onOpenChange, scope, onSaved, onBlock }) {
  const cat = useCatalogs();
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [search, setSearch] = useState('');
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const [recent, setRecent] = useState([]);

  // The day being reported, and — when correcting — the report this one replaces.
  const reportDate = scope?.date || todayIst();
  const correcting = scope?.correcting || null;
  const backdated = reportDate !== todayIst();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const task = tasks.find((t) => t.id === form.taskId) || null;
  const location = form.locationId && form.locationId !== SITE_WIDE ? cat.locationById(form.locationId) : null;
  const villaScope = useVillaScope(location?.location_type === 'Villa' ? location.id : '');

  /* ------------------------------------------------------------- opening */
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setError('');
    setSearch('');
    setRecent(loadRecentVillas());
    const draft = scope?.correcting ? null : loadDraft();
    if (scope?.taskId) {
      setRestored(false);
      data.get('Task', scope.taskId).then((t) => {
        if (!alive || !t) return;
        setTasks([t]);
        setForm({ ...EMPTY, locationId: t.location_id || SITE_WIDE, taskId: t.id, status: t.status, progress: t.progress_percent ?? '', ...(scope.prefill || {}) });
      }).catch(() => {});
    } else if (!scope?.locationId && isRestorable(draft)) {
      setRestored(true);
      setForm({ ...EMPTY, ...draft, photos: draft.photos || [] });
    } else {
      setRestored(false);
      setForm({ ...EMPTY, locationId: scope?.locationId || '' });
    }
    return () => { alive = false; };
  }, [open, scope]);

  /* ----------------------------------------------- the tasks of the villa */
  useEffect(() => {
    if (!open || !form.locationId) { if (!scope?.taskId) setTasks([]); return undefined; }
    let alive = true;
    setLoadingTasks(true);
    const filter = {
      archived: { $ne: true }, is_villa_work_parent: { $ne: true }, status: { $in: REPORTABLE_STATUSES },
      location_id: form.locationId === SITE_WIDE ? null : form.locationId,
    };
    data.readAll('Task', filter, { max: 500 })
      .then(({ items }) => {
        if (!alive) return;
        setTasks((prev) => {
          const keep = prev.find((t) => t.id === form.taskId && !items.some((x) => x.id === t.id));
          return orderTasks(keep ? [keep, ...items] : items, { id: user?.id });
        });
      })
      .catch((e) => alive && setError(errorMessageOf(e, 'The tasks could not be loaded.')))
      .finally(() => alive && setLoadingTasks(false));
    return () => { alive = false; };
  }, [open, form.locationId]);

  /* ----------------------------------------------- an unsent draft is kept */
  useEffect(() => {
    if (open && !correcting && (form.taskId || form.note || form.photos.length)) saveDraft(form);
  }, [open, form, correcting]);

  const pickTask = (t) => set({ taskId: t.id, status: t.status, progress: t.progress_percent ?? '', floor_id: '', area_ids: [] });

  const villaChips = useMemo(() => {
    const ids = recent.filter((id) => cat.locationById(id));
    return ids.map((id) => cat.locationById(id));
  }, [recent, cat]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? tasks.filter((t) => `${t.task_ref} ${t.name}`.toLowerCase().includes(q)) : tasks;
  }, [tasks, search]);

  const chips = task ? statusChips(task) : [];
  const changed = !!task && (form.status !== task.status
    || String(form.progress) !== String(task.progress_percent ?? '')
    || form.note.trim() || form.photos.length);

  /* ------------------------------------------------------------------ save */
  const save = useCallback(async (andNext = false) => {
    if (!task) return;
    setSaving(true);
    setError('');
    try {
      const siteArea = areaLabelFor(
        villaScope.areas.filter((a) => form.area_ids.includes(a.id)),
        villaScope.floors.find((f) => f.id === form.floor_id) || null,
      );
      const result = await submitDailyUpdate({
        task_id: task.id,
        update_date: reportDate,
        ...(correcting ? {
          replaces_report_id: correcting.reportId,
          manpower_items: correcting.manpower_items,
          plan_tomorrow: correcting.plan_tomorrow || undefined,
        } : {}),
        status: form.status || task.status,
        progress_percent: form.progress === '' ? undefined : Number(form.progress),
        work_done: form.note,
        site_area: siteArea || correcting?.site_area || undefined,
        photo_uris: form.photos.map((p) => p.file_uri),
        ...photoMetaOf(form.photos),
      });
      if (form.locationId && form.locationId !== SITE_WIDE) rememberVilla(form.locationId);
      clearDraft();
      const reportId = result?.update?.id;
      const label = `${task.task_ref} saved`;
      toast({
        description: result?.history_only && result.message ? result.message : `${label}${form.photos.length ? ` with ${form.photos.length} photo${form.photos.length === 1 ? '' : 's'}` : ''}.`,
        action: reportId ? (
          <ToastAction
            altText="Undo this update"
            onClick={async () => {
              try {
                await voidDailyUpdate(reportId);
                toast({ description: `${task.task_ref} put back as it was.` });
                onSaved?.();
              } catch (e) {
                toast({ description: errorMessageOf(e, 'It could not be undone.'), variant: 'destructive' });
              }
            }}
          >Undo</ToastAction>
        ) : undefined,
      });
      onSaved?.(result);
      // Save & next keeps the villa, the day and the photos and moves to the next open task of the villa.
      const index = tasks.findIndex((t) => t.id === task.id);
      const next = andNext && !correcting ? tasks.slice(index + 1).find((t) => t.id !== task.id) : null;
      if (andNext && !next) toast({ description: 'That was the last open task here.' });
      if (next) {
        setForm({ ...EMPTY, locationId: form.locationId, taskId: next.id, status: next.status, progress: next.progress_percent ?? '', photos: form.photos, floor_id: form.floor_id, area_ids: form.area_ids });
      } else {
        setForm(EMPTY);
        onOpenChange(false);
      }
    } catch (e) {
      setError(errorMessageOf(e, 'The update could not be saved.'));
    } finally {
      setSaving(false);
    }
  }, [task, tasks, form, villaScope, toast, onSaved, onOpenChange, reportDate, correcting]);

  const discard = () => { clearDraft(); setForm(EMPTY); setRestored(false); };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{correcting ? 'Correct report' : 'Log update'}</DrawerTitle>
          <DrawerDescription>
            {task ? `${task.task_ref} · ${task.name}` : 'Villa, task, status, progress, photo.'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-4">
          {restored && (
            <p className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
              Your unsent update was kept.
              <button type="button" className="font-medium underline" onClick={discard}>Start again</button>
            </p>
          )}

          {correcting && (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
              You are correcting a report. The original stays in place until you save; closing this changes nothing.
            </p>
          )}
          {backdated && !correcting && (
            <p className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-3 py-2 text-xs">
              This report will be dated <span className="font-medium">{reportDate}</span>, the day you are viewing — not today.
            </p>
          )}

          <Step n={1} title="Which villa?">
            <div className="flex flex-wrap gap-2">
              {villaChips.map((v) => (
                <Chip key={v.id} active={form.locationId === v.id} onClick={() => set({ locationId: v.id, taskId: '' })}>{v.villa_code}</Chip>
              ))}
              <Chip active={form.locationId === SITE_WIDE} onClick={() => set({ locationId: SITE_WIDE, taskId: '' })}>Site-wide</Chip>
            </div>
            <EnumSelect
              value={form.locationId && form.locationId !== SITE_WIDE ? form.locationId : ''}
              onChange={(id) => id && set({ locationId: id, taskId: '' })}
              options={cat.locations.map((l) => ({ value: l.id, label: `${l.villa_code}${l.location_type !== 'Villa' ? ` · ${l.location_type}` : ''}` }))}
              placeholder="Or search all villas…"
            />
          </Step>

          {form.locationId && (
            <Step n={2} title="Which task?">
              {loadingTasks ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…</p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open task here. <Link className="underline" to={`/tasks/new${location ? `?location=${location.id}` : ''}`}>Create one</Link>.</p>
              ) : (
                <>
                  {tasks.length > 6 && <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search these tasks" />}
                  <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                    {filtered.slice(0, 60).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => pickTask(t)}
                          className={cn('flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left', t.id === form.taskId ? 'border-primary bg-secondary/60' : 'border-border bg-card')}
                        >
                          <span className="min-w-0">
                            <span className="field-mono block text-xs text-muted-foreground">{t.task_ref}</span>
                            <span className="block truncate text-sm font-medium">{t.name}</span>
                            {t.area_label && <span className="block truncate text-xs text-muted-foreground">{t.area_label}</span>}
                          </span>
                          <StatusPill status={t.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {filtered.length > 60 && <p className="text-xs text-muted-foreground">Showing 60 of {filtered.length}. Search to narrow.</p>}
                </>
              )}
            </Step>
          )}

          {task && (
            <>
              <Step n={3} title="Status">
                <div className="flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <Chip
                      key={c.status}
                      active={form.status === c.status}
                      onClick={() => (c.opensBlockSheet ? onBlock?.(task) : set({ status: c.status }))}
                    >
                      {c.status}{c.opensBlockSheet ? ' …' : ''}
                    </Chip>
                  ))}
                </div>
              </Step>

              <Step n={4} title="Progress">
                <div className="flex flex-wrap gap-2">
                  {PROGRESS_CHIPS.map((p) => (
                    <Chip key={p} active={String(form.progress) === String(p)} onClick={() => set({ progress: nextProgress(form.progress, p) })}>{p}%</Chip>
                  ))}
                  <Chip onClick={() => set({ progress: nextProgress(form.progress, '+10') })}>+10%</Chip>
                  {form.progress !== '' && <Chip onClick={() => set({ progress: '' })}>Clear</Chip>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.progress === '' ? 'Not measured — leave it blank if you are unsure.' : `${form.progress}% complete`}
                </p>
              </Step>

              {location?.location_type === 'Villa' && (villaScope.floors.length > 0 || villaScope.areas.length > 0) && (
                <Step n={5} title="Where in the villa? (optional)">
                  <div className="grid gap-3">
                    <FloorRoomPicker
                      floors={villaScope.floors}
                      areas={villaScope.areas}
                      floorId={form.floor_id}
                      areaIds={form.area_ids}
                      onChange={(patch) => set(patch)}
                      villaLabel={location.villa_code}
                    />
                  </div>
                </Step>
              )}

              <Step n={6} title="Photo (optional)">
                <PhotoUploader photos={form.photos} onChange={(photos) => set({ photos })} onBusy={setBusyPhoto} />
              </Step>

              <Step n={7} title="One line on what was done (optional)">
                <Input value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Second coat done in living room" />
              </Step>
            </>
          )}

          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        </div>

        <DrawerFooter className="border-t border-border bg-background">
          <Button size="lg" className="h-12 gap-2 text-base" disabled={!task || saving || busyPhoto || !changed} onClick={() => save(false)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {saving ? 'Saving…' : busyPhoto ? 'Uploading photo…' : 'Save update'}
          </Button>
          {!correcting && (
            <Button size="lg" variant="outline" className="h-12 text-base" disabled={!task || saving || busyPhoto || !changed} onClick={() => save(true)}>
              Save &amp; next task
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}