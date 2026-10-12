import DelayCategorySelect from '@/components/common/DelayCategorySelect';
import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import { Input } from '@/components/ui/input';
import { updateTask } from '@/lib/taskService';
import { forecastOf } from '@/lib/taskForm';

/**
 * Revising a forecast finish. The reason is mandatory and the approved baseline
 * is never touched — the guarded writer decides whether the caller may move the
 * date at all.
 */
export default function ForecastRevisionDialog({ task, open, onOpenChange, user, onSaved }) {
  const [date, setDate] = useState(() => forecastOf(task));
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Mounted while closed: start from the chosen row's dates on every open.
  useEffect(() => {
    if (!open) return;
    setDate(forecastOf(task));
    setReason('');
    setCategory('');
    setError('');
  }, [open, task?.id]);

  if (!task) return null;

  const save = async () => {
    if (!date) {
      setError('Choose the new forecast finish date.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required for every forecast date change.');
      return;
    }
    if (!category) {
      setError('Choose the delay category.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateTask(task.id, { current_forecast_finish: date, date_revision_reason: reason.trim(), date_revision_category: category }, user);
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not revise the forecast date.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Revise forecast — ${task.ref || task.task_ref}`}
      description={`${task.name} · current forecast ${task.current_forecast_finish || task.forecast_finish || 'not set'}`}
      onSubmit={save}
      submitting={saving}
      submitLabel="Save revision"
      error={error}
    >
      <Field label="New forecast finish" required>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <DelayCategorySelect value={category} onChange={setCategory} />
      <Field label="Reason for the change" required hint="Recorded in the task history against this revision.">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the finish date is moving" />
      </Field>
      <p className="text-xs text-muted-foreground">
        The approved baseline finish ({task.baseline_finish || 'not set'}) is never changed here. Only a Project Editor or an
        administrator may move a baseline, and only through the baseline process.
      </p>
    </FormDialog>
  );
}