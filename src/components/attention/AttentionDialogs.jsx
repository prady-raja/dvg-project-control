import React, { useEffect, useState } from 'react';
import { bulkFix, dismissItems } from '@/lib/attentionService';
import { errorMessageOf } from '@/lib/clientErrors';
import { SNOOZE_CHOICES } from '@shared/attentionActions.ts';
import { useCatalogs } from '@/lib/CatalogContext';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import UserPicker from '@/components/common/UserPicker';
import { Input } from '@/components/ui/input';

/** Set one thing on one or many tasks: contractor, assignee or dates. */
export function FixDialog({ kind, projectId, taskIds, label, onClose, onDone }) {
  const cat = useCatalogs();
  const [form, setForm] = useState({ contractor_id: '', assignee_user_id: '', baseline_start: '', baseline_finish: '', current_forecast_finish: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { setError(''); setResult(null); }, [kind, taskIds]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const changes = kind === 'contractor' ? { contractor_id: form.contractor_id }
        : kind === 'assignee' ? { assignee_user_id: form.assignee_user_id }
          : { baseline_start: form.baseline_start, baseline_finish: form.baseline_finish, current_forecast_finish: form.current_forecast_finish };
      const res = await bulkFix(projectId, taskIds, changes);
      setResult(res);
      await onDone();
    } catch (e) {
      setError(errorMessageOf(e, 'Could not make the change.'));
    } finally {
      setSaving(false);
    }
  };

  const failures = (result?.results || []).filter((r) => !r.ok);
  return (
    <FormDialog
      open={!!kind}
      onOpenChange={(v) => !v && onClose()}
      title={kind === 'contractor' ? 'Set the contractor' : kind === 'assignee' ? 'Assign to' : 'Set the dates'}
      description={`${label}. Each task keeps its own history row.`}
      onSubmit={result ? onClose : save}
      submitting={saving}
      submitLabel={result ? 'Done' : 'Apply'}
      error={error}
    >
      {result ? (
        <div className="space-y-1 text-sm">
          <p>Changed {result.changed}, already as asked {result.unchanged}{result.failed ? `, ${result.failed} refused` : ''}.</p>
          {failures.slice(0, 8).map((f) => <p key={f.task_id} className="text-xs text-destructive">{f.ref || f.task_id}: {f.error}</p>)}
        </div>
      ) : kind === 'contractor' ? (
        <Field label="Contractor" required>
          <EnumSelect value={form.contractor_id} onChange={(v) => setForm((f) => ({ ...f, contractor_id: v }))}
            options={cat.contractors.filter((c) => c.active !== false).map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose a contractor" />
        </Field>
      ) : kind === 'assignee' ? (
        <Field label="Person" required>
          <UserPicker projectId={projectId} value={form.assignee_user_id} onChange={(v) => setForm((f) => ({ ...f, assignee_user_id: v }))} placeholder="Choose a person" />
        </Field>
      ) : (
        <>
          <Field label="Baseline start"><Input type="date" value={form.baseline_start} onChange={(e) => setForm((f) => ({ ...f, baseline_start: e.target.value }))} /></Field>
          <Field label="Baseline finish" hint="Dates under an approved baseline are refused — they change only through a baseline revision.">
            <Input type="date" value={form.baseline_finish} onChange={(e) => setForm((f) => ({ ...f, baseline_finish: e.target.value }))} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Dismiss with a reason, for good or until a date. */
export function DismissDialog({ open, projectId, items, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [snooze, setSnooze] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setReason(''); setSnooze(''); setError(''); } }, [open]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await dismissItems(projectId, items.map((i) => ({ code: i.code, task_id: i.task_id, villa: i.villa })), reason, snooze);
      await onDone();
      onClose();
    } catch (e) {
      setError(errorMessageOf(e, 'Could not dismiss.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <FormDialog open={open} onOpenChange={(v) => !v && onClose()} title={`Dismiss ${items.length} item${items.length === 1 ? '' : 's'}`}
      description="A dismissed item leaves the list. The reason is kept, and it comes back after a snooze ends." onSubmit={save} submitting={saving} submitLabel="Dismiss" error={error}>
      <Field label="Why?" required><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Contractor is TBC until the next meeting" /></Field>
      <Field label="Hide it"><EnumSelect value={snooze} onChange={setSnooze} options={SNOOZE_CHOICES} /></Field>
    </FormDialog>
  );
}
