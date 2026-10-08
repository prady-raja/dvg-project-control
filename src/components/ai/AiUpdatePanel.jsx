import React, { useState } from 'react';
import { Sparkles, TriangleAlert } from 'lucide-react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TaskPickerDialog from '@/components/daily/TaskPickerDialog';
import { aiParseUpdate } from '@/lib/aiService';
import { submitDailyUpdate } from '@/lib/dailyService';
import { TASK_STATUSES, BLOCKER_CATEGORIES } from '@/lib/constants';

/**
 * Stage B / 14 — describe the site update in words; the assistant proposes
 * fields, the engineer confirms the task and every value, and only then does the
 * existing guarded daily-update path write anything. The model never writes.
 */
export default function AiUpdatePanel({ projectId, phaseId, date, canReport, onSaved }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const payload = await aiParseUpdate({ projectId, phaseId, text, date });
      setResult(payload);
      const proposed = payload.proposed || {};
      setForm({
        task_ref: proposed.task_ref || '',
        task_id: '',
        status: proposed.status || 'In Progress',
        progress_percent: proposed.progress_percent ?? '',
        manpower_total: proposed.manpower_total ?? '',
        manpower_discipline: '',
        work_done: proposed.work_done || text,
        blocker_category: proposed.blocker_category || '',
        blocker_description: proposed.blocker_description || '',
        date_revision_reason: '',
      });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not read that update.');
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!form?.task_id) {
      setError('Confirm which task this update belongs to.');
      return;
    }
    const count = Number(form.manpower_total);
    if (count > 0 && !form.manpower_discipline.trim()) {
      setError('Name the trade the manpower was deployed under, or clear the manpower figure.');
      return;
    }
    if (form.blocker_category && !form.blocker_description.trim()) {
      setError('Describe the blocker, or clear the blocker category.');
      return;
    }
    if (form.blocker_description.trim() && !form.blocker_category) {
      setError('Choose a blocker category for the blocker you described.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Only the fields the engineer confirmed are sent; a blank left alone
      // means "not measured today", never "clear the measured value".
      const payload = {
        task_id: form.task_id,
        update_date: date,
        status: form.status,
      };
      if (form.progress_percent !== '') payload.progress_percent = Number(form.progress_percent);
      if (form.work_done.trim()) payload.work_done = form.work_done.trim();
      if (count > 0) payload.manpower_items = [{ discipline: form.manpower_discipline.trim(), count }];
      if (form.blocker_category) {
        payload.blocker_reported = true;
        payload.blocker_category = form.blocker_category;
        payload.blocker_description = form.blocker_description.trim();
      }
      await submitDailyUpdate(payload);
      setResult(null);
      setForm(null);
      setText('');
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'The update was refused.');
    } finally {
      setLoading(false);
    }
  };

  if (!canReport) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Describe the update in words
        </h3>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Example: “Villa A-07 false ceiling 80% complete, four workers today, waiting for electrical points.” Nothing is written until
        you confirm the task and the fields.
      </p>

      <Textarea
        className="mt-3"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What happened on site today?"
      />
      <Button className="mt-3 gap-2" variant="outline" disabled={loading || !text.trim()} onClick={parse}>
        <Sparkles className="h-4 w-4" /> {loading ? 'Reading…' : 'Prepare update'}
      </Button>

      {error && <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {result?.message && !result.proposed && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 px-4 py-3 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" />
          <span>{result.message}</span>
        </p>
      )}

      {form && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium">
            Proposed update — {result.source === 'ai' ? 'read by the assistant' : 'read mechanically from your words'}
            {result.ambiguous ? ' · more than one task could match' : ''}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Task" required hint={result.ambiguous ? 'Choose the correct task — the match was ambiguous.' : 'Confirm this is the right task.'}>
              <div className="flex gap-2">
                <Input value={form.task_ref} readOnly placeholder="No task selected" />
                <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>Choose</Button>
              </div>
            </Field>
            <Field label="Status">
              <EnumSelect value={form.status} onChange={(value) => setForm((f) => ({ ...f, status: value }))} options={TASK_STATUSES} />
            </Field>
            <Field label="Progress %" hint="Leave blank when progress is unknown.">
              <Input
                type="number"
                min="0"
                max="100"
                value={form.progress_percent ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, progress_percent: e.target.value }))}
              />
            </Field>
            <Field label="Manpower today" hint="Trade the manpower was deployed under, and how many.">
              <div className="flex gap-2">
                <Input
                  placeholder="Trade, e.g. Finishes"
                  value={form.manpower_discipline}
                  onChange={(e) => setForm((f) => ({ ...f, manpower_discipline: e.target.value }))}
                />
                <Input
                  type="number"
                  min="0"
                  className="w-24"
                  value={form.manpower_total ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, manpower_total: e.target.value }))}
                />
              </div>
            </Field>
            <Field label="Blocker category" hint="Leave blank if there is no blocker.">
              <EnumSelect
                value={form.blocker_category}
                onChange={(value) => setForm((f) => ({ ...f, blocker_category: value }))}
                options={[{ value: '', label: 'No blocker' }, ...BLOCKER_CATEGORIES.map((c) => ({ value: c, label: c }))]}
              />
            </Field>
            <Field label="Forecast finish change reason" hint="Only needed if the forecast date moves.">
              <Input value={form.date_revision_reason} onChange={(e) => setForm((f) => ({ ...f, date_revision_reason: e.target.value }))} />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Work done">
              <Textarea rows={2} value={form.work_done} onChange={(e) => setForm((f) => ({ ...f, work_done: e.target.value }))} />
            </Field>
          </div>

          {!!(result.proposed?.needs_clarification || []).length && (
            <p className="mt-3 text-xs text-muted-foreground">
              The assistant could not determine: {result.proposed.needs_clarification.join('; ')}.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="gap-2" disabled={loading || !form.task_id} onClick={apply}>
              Confirm and record update
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setForm(null);
                setResult(null);
              }}
            >
              Discard
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Recorded through the same guarded daily-update path as a typed report: the report, the task and the change trail are
            written together, and a forecast date change still needs its reason.
          </p>
        </div>
      )}

      <TaskPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projectId={projectId}
        onPick={(task) => {
          setPickerOpen(false);
          setForm((f) => ({ ...f, task_id: task.id, task_ref: task.task_ref }));
        }}
      />
    </div>
  );
}