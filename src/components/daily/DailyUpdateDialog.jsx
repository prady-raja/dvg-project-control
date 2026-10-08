import React, { useEffect, useState } from 'react';
import { CalendarClock, CloudSun, HardHat, TriangleAlert, Camera } from 'lucide-react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import ManpowerEditor from '@/components/daily/ManpowerEditor';
import PhotoUploader from '@/components/daily/PhotoUploader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCatalogs } from '@/lib/CatalogContext';
import { submitDailyUpdate } from '@/lib/dailyService';
import { BLOCKER_CATEGORIES, TASK_STATUSES } from '@/lib/constants';
import { toDateInput, todayIst } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The site report. Only status and progress are on screen to begin with, so the
 * common case is three taps; manpower, tomorrow's plan, a blocker, photos and a
 * forecast change each open only when they are needed.
 */
const blankForm = (task) => ({
  update_date: todayIst(),
  status: task?.status || 'Not Started',
  progress_percent: task?.progress_percent ?? '',
  work_done: '',
  plan_tomorrow: '',
  manpower: [{ discipline: task?.discipline || '', count: '' }],
  blocker_category: '',
  blocker_description: '',
  blocker_responsible_party: '',
  expected_resolution_date: '',
  clearBlocker: false,
  forecast: toDateInput(task?.current_forecast_finish),
  reason: '',
  photos: [],
});

const NO_SECTIONS = { manpower: false, plan: false, blocker: false, photo: false, forecast: false };

function Chip({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'border-primary bg-secondary text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export default function DailyUpdateDialog({ task, open, onOpenChange, onSaved }) {
  const cat = useCatalogs();
  const [form, setForm] = useState(() => blankForm(task));
  const [show, setShow] = useState(NO_SECTIONS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(blankForm(task));
    setShow(NO_SECTIONS);
    setError('');
  }, [open, task?.id]);

  if (!task) return null;

  const location = cat.locationById(task.location_id);
  const forecastChanged = (form.forecast || '') !== toDateInput(task.current_forecast_finish);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (key) => setShow((s) => ({ ...s, [key]: !s[key] }));
  const hasBlocker = !!(task.blocker_category || task.blocker_description);

  const save = async () => {
    if (form.progress_percent !== '' && (Number(form.progress_percent) < 0 || Number(form.progress_percent) > 100)) {
      setError('Progress must be between 0 and 100.');
      return;
    }
    if (show.forecast && forecastChanged && !form.reason.trim()) {
      setError('Moving the forecast finish needs a reason.');
      return;
    }
    if (show.blocker && !form.clearBlocker) {
      if (!form.blocker_category) {
        setError('Choose a blocker category.');
        return;
      }
      if (!form.blocker_description.trim()) {
        setError('Describe the blocker.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        task_id: task.id,
        update_date: form.update_date,
        status: form.status,
        progress_percent: form.progress_percent,
        work_done: form.work_done,
        plan_tomorrow: show.plan ? form.plan_tomorrow : '',
        manpower_items: show.manpower ? form.manpower.filter((row) => Number(row.count) > 0) : [],
        blocker_reported: show.blocker && !form.clearBlocker,
        blocker_category: form.blocker_category,
        blocker_description: form.blocker_description,
        blocker_responsible_party: form.blocker_responsible_party,
        expected_resolution_date: form.expected_resolution_date,
        blocker_cleared: show.blocker && form.clearBlocker,
        photo_uris: form.photos.map((photo) => photo.file_uri),
        date_revision_reason: show.forecast ? form.reason : '',
      };
      if (show.forecast) payload.current_forecast_finish = form.forecast;
      await submitDailyUpdate(payload);
      onSaved?.();
    } catch (e) {
      setError(e?.message || 'Could not save the update.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Daily update"
      description={`${task.task_ref} · ${task.name}${location ? ` · ${location.villa_code}` : ' · Site-wide'}`}
      onSubmit={save}
      submitting={saving || photoBusy}
      submitLabel="Save update"
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day">
          <Input type="date" value={form.update_date} onChange={(e) => set({ update_date: e.target.value })} />
        </Field>
        <Field label="Status">
          <EnumSelect value={form.status} onChange={(v) => set({ status: v })} options={TASK_STATUSES} />
        </Field>
      </div>

      <Field label="Progress %" hint="Leave blank when progress is unknown.">
        <Input
          type="number"
          min="0"
          max="100"
          inputMode="numeric"
          className="h-11 text-base"
          value={form.progress_percent}
          onChange={(e) => set({ progress_percent: e.target.value })}
        />
      </Field>

      <Field label="Done today" hint="One line is enough.">
        <Textarea
          rows={2}
          value={form.work_done}
          onChange={(e) => set({ work_done: e.target.value })}
          placeholder="What was completed today"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Chip active={show.manpower} onClick={() => toggle('manpower')} icon={HardHat} label="Manpower" />
        <Chip active={show.plan} onClick={() => toggle('plan')} icon={CloudSun} label="Tomorrow" />
        <Chip active={show.blocker} onClick={() => toggle('blocker')} icon={TriangleAlert} label="Blocker" />
        <Chip active={show.photo} onClick={() => toggle('photo')} icon={Camera} label="Photos" />
        <Chip active={show.forecast} onClick={() => toggle('forecast')} icon={CalendarClock} label="Forecast date" />
      </div>

      {show.manpower && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-medium">Manpower deployed</p>
          <ManpowerEditor
            rows={form.manpower}
            onChange={(rows) => set({ manpower: rows })}
            disciplines={cat.enabledDisciplines(cat.projectById(task.project_id))}
            defaultDiscipline={task.discipline}
          />
        </div>
      )}

      {show.plan && (
        <Field label="Plan for tomorrow">
          <Textarea
            rows={2}
            value={form.plan_tomorrow}
            onChange={(e) => set({ plan_tomorrow: e.target.value })}
            placeholder="What is planned next"
          />
        </Field>
      )}

      {show.blocker && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          {hasBlocker && (
            <label className="flex items-start gap-2 text-xs">
              <Checkbox
                checked={form.clearBlocker}
                onCheckedChange={(v) => set({ clearBlocker: v === true })}
              />
              <span>
                Clear the blocker on this task
                {task.blocker_category ? ` (${task.blocker_category})` : ''}
              </span>
            </label>
          )}
          {!form.clearBlocker && (
            <>
              <Field label="Blocker category">
                <EnumSelect
                  value={form.blocker_category}
                  onChange={(v) => set({ blocker_category: v })}
                  options={BLOCKER_CATEGORIES}
                  placeholder="What is holding the work up"
                />
              </Field>
              <Field label="What is the blocker">
                <Textarea
                  rows={2}
                  value={form.blocker_description}
                  onChange={(e) => set({ blocker_description: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Responsible party">
                  <Input
                    value={form.blocker_responsible_party}
                    onChange={(e) => set({ blocker_responsible_party: e.target.value })}
                    placeholder="Who must act"
                  />
                </Field>
                <Field label="Expected by">
                  <Input
                    type="date"
                    value={form.expected_resolution_date}
                    onChange={(e) => set({ expected_resolution_date: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
        </div>
      )}

      {show.photo && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-medium">Site photos (optional)</p>
          <PhotoUploader
            photos={form.photos}
            onChange={(photos) => set({ photos })}
            onBusy={setPhotoBusy}
          />
        </div>
      )}

      {show.forecast && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Baseline finish {toDateInput(task.baseline_finish) || 'not set'} stays frozen; this moves only the forecast.
          </p>
          <Field label="New forecast finish">
            <Input type="date" value={form.forecast} onChange={(e) => set({ forecast: e.target.value })} />
          </Field>
          {forecastChanged && (
            <Field label="Reason for the change" required>
              <Input
                value={form.reason}
                onChange={(e) => set({ reason: e.target.value })}
                placeholder="Why the finish date moved"
              />
            </Field>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Saved as {cat.projectById(task.project_id)?.name || 'this project'} · recorded against your sign-in, with the change trail kept.
      </p>
    </FormDialog>
  );
}