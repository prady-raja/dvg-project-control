import React, { useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TASK_STATUSES } from '@/lib/constants';
import { updateTask } from '@/lib/taskService';
import { toDateInput } from '@/lib/format';

/** Sub-minute on-site update: status, progress, forecast finish, remarks. */
export default function QuickUpdateDialog({ task, open, onOpenChange, user, onSaved }) {
  const [form, setForm] = useState({
    status: task?.status || 'Not Started',
    progress_percent: task?.progress_percent ?? '',
    current_forecast_finish: toDateInput(task?.current_forecast_finish),
    date_revision_reason: task?.date_revision_reason || '',
    remarks: task?.remarks || '',
    latest_update: task?.latest_update || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const forecastChanged = (form.current_forecast_finish || '') !== toDateInput(task?.current_forecast_finish);

  const save = async () => {
    if (form.progress_percent !== '' && (Number(form.progress_percent) < 0 || Number(form.progress_percent) > 100)) {
      setError('Progress must be between 0 and 100.');
      return;
    }
    if (forecastChanged && !form.date_revision_reason.trim()) {
      setError('A forecast date change needs a date revision reason.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Send only the fields this dialog owns.
      await updateTask(
        task.id,
        {
          status: form.status,
          progress_percent: form.progress_percent,
          current_forecast_finish: form.current_forecast_finish,
          date_revision_reason: form.date_revision_reason,
          latest_update: form.latest_update,
          remarks: form.remarks,
        },
        user,
      );
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not save the update.');
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Quick update — ${task.task_ref}`}
      description={task.name}
      onSubmit={save}
      submitting={saving}
      submitLabel="Save update"
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <EnumSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={TASK_STATUSES} />
        </Field>
        <Field label="Progress %" hint="Leave blank when progress is unknown.">
          <Input
            type="number"
            min="0"
            max="100"
            value={form.progress_percent}
            onChange={(e) => setForm((f) => ({ ...f, progress_percent: e.target.value }))}
          />
        </Field>
        <Field label="Current Forecast Finish">
          <Input
            type="date"
            value={form.current_forecast_finish}
            onChange={(e) => setForm((f) => ({ ...f, current_forecast_finish: e.target.value }))}
          />
        </Field>
        {forecastChanged && (
          <Field label="Date Revision Reason" required>
            <Input
              value={form.date_revision_reason}
              onChange={(e) => setForm((f) => ({ ...f, date_revision_reason: e.target.value }))}
              placeholder="Why the finish date moved"
            />
          </Field>
        )}
      </div>
      <Field label="Latest Update">
        <Input
          value={form.latest_update}
          onChange={(e) => setForm((f) => ({ ...f, latest_update: e.target.value }))}
          placeholder="One line on what changed"
        />
      </Field>
      <Field label="Remarks">
        <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
      </Field>
    </FormDialog>
  );
}