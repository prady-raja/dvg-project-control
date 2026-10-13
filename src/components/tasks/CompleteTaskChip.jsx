import React, { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { updateTask } from '@/lib/taskService';
import { errorMessageOf } from '@/lib/clientErrors';
import { missingFieldsOf } from '@/lib/shared/dataHealth.ts';
import { TASK_PRIORITIES } from '@/lib/constants';
import { useAccess } from '@/lib/AccessContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import UserPicker from '@/components/common/UserPicker';
import DelayCategorySelect from '@/components/common/DelayCategorySelect';
import { cn } from '@/lib/utils';

/**
 * "Complete this task (3 fields)": one optional prompt for what the source list left
 * out — the responsible engineer, a forecast finish and a priority. Only the missing
 * fields are offered. Skipping saves nothing; nothing is filled in for anyone.
 * A forecast never touches the baseline, and goes through the normal task rules, so
 * it carries a reason and a delay category like any other forecast.
 */
export default function CompleteTaskChip({ task, onSaved, compact = false, className }) {
  const access = useAccess();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ assignee_user_id: '', current_forecast_finish: '', priority: '', date_revision_reason: '', date_revision_category: '' });

  const missing = task ? missingFieldsOf(task) : [];
  if (!task || skipped || !missing.length || task.status === 'Closed' || !access.can(task.project_id, 'edit_tasks')) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const has = (key) => missing.includes(key);

  const save = async () => {
    const changes = {};
    if (has('engineer') && form.assignee_user_id) changes.assignee_user_id = form.assignee_user_id;
    if (has('priority') && form.priority) changes.priority = form.priority;
    if (has('forecast') && form.current_forecast_finish) {
      if (!form.date_revision_reason.trim()) { setError('Say in a few words where the forecast comes from.'); return; }
      if (!form.date_revision_category) { setError('Choose the delay category — "Other" is fine when nothing slipped.'); return; }
      Object.assign(changes, {
        current_forecast_finish: form.current_forecast_finish,
        date_revision_reason: form.date_revision_reason.trim(),
        date_revision_category: form.date_revision_category,
      });
    }
    if (!Object.keys(changes).length) { setError('Fill in at least one field, or skip.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateTask(task.id, changes);
      toast({ description: `${Object.keys(changes).length >= 1 ? 'Saved.' : ''} Only what you filled in was changed.` });
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setError(errorMessageOf(e, 'It could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-primary/50 bg-primary/5 px-3 text-sm font-medium text-primary', className)}
      >
        <ClipboardCheck className="h-4 w-4" aria-hidden /> Complete this task ({missing.length} field{missing.length === 1 ? '' : 's'})
      </button>
    );
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-card p-3', className)} role="group" aria-label="Complete this task">
      <p className="text-sm font-medium">Complete this task <span className="font-normal text-muted-foreground">— optional, only what is missing</span></p>
      {has('engineer') && (
        <Field label="Responsible engineer"><UserPicker projectId={task.project_id} value={form.assignee_user_id} onChange={(id) => set({ assignee_user_id: id })} /></Field>
      )}
      {has('priority') && (
        <Field label="Priority"><EnumSelect value={form.priority} onChange={(v) => set({ priority: v })} options={TASK_PRIORITIES} placeholder="Not set" /></Field>
      )}
      {has('forecast') && (
        <>
          <Field label="Forecast finish" hint="The baseline dates are not changed."><Input type="date" value={form.current_forecast_finish} onChange={(e) => set({ current_forecast_finish: e.target.value })} /></Field>
          {form.current_forecast_finish && (
            <>
              <Field label="Where does this date come from?" required><Input value={form.date_revision_reason} onChange={(e) => set({ date_revision_reason: e.target.value })} placeholder="e.g. Contractor's plan, agreed on site" /></Field>
              <DelayCategorySelect value={form.date_revision_category} onChange={(v) => set({ date_revision_category: v })} />
            </>
          )}
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setSkipped(true); setOpen(false); }}>Skip</Button>
      </div>
      {compact ? null : <p className="text-xs text-muted-foreground">Skipping saves nothing. You can come back to it from the task page.</p>}
    </div>
  );
}
