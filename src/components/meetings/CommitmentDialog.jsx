import React, { useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TaskPickerDialog from '@/components/daily/TaskPickerDialog';
import { createRecord } from '@/lib/recordService';
import { toDateInput } from '@/lib/format';

/**
 * Recording what a contractor promised. A commitment always points at a task
 * that already exists — meeting notes never create construction work — and each
 * commitment is its own record, so earlier promises are never overwritten.
 */
export default function CommitmentDialog({ open, onOpenChange, projectId, phaseId, contractorId, meetingDate, contractorName, onSaved }) {
  const [form, setForm] = useState({
    task_ref: '',
    task_id: '',
    commitment: '',
    responsible_person: '',
    promised_date: '',
    remarks: '',
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.task_id) {
      setError('Link the commitment to the task it belongs to.');
      return;
    }
    if (!form.commitment.trim()) {
      setError('Record what was committed.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createRecord('MeetingCommitment', {
        project_id: projectId,
        phase_id: phaseId || null,
        contractor_id: contractorId || null,
        task_id: form.task_id,
        meeting_date: meetingDate,
        commitment: form.commitment.trim(),
        responsible_person: form.responsible_person.trim(),
        promised_date: form.promised_date || null,
        remarks: form.remarks.trim(),
        status: 'Open',
      });
      setForm({ task_ref: '', task_id: '', commitment: '', responsible_person: '', promised_date: '', remarks: '' });
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not record the commitment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Record a meeting commitment"
        description={`${contractorName || 'Contractor'} · meeting of ${toDateInput(meetingDate) || meetingDate}`}
        onSubmit={save}
        submitting={saving}
        submitLabel="Record commitment"
        error={error}
      >
        <Field label="Existing task" required hint="Commitments attach to work already on the register.">
          <div className="flex gap-2">
            <Input value={form.task_ref} readOnly placeholder="No task selected" />
            <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>Choose task</Button>
          </div>
        </Field>
        <Field label="What was committed" required>
          <Input
            value={form.commitment}
            onChange={(e) => setForm((f) => ({ ...f, commitment: e.target.value }))}
            placeholder="e.g. Complete false ceiling at B-05-06 by Friday"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsible person">
            <Input value={form.responsible_person} onChange={(e) => setForm((f) => ({ ...f, responsible_person: e.target.value }))} />
          </Field>
          <Field label="Promised completion">
            <Input type="date" value={form.promised_date} onChange={(e) => setForm((f) => ({ ...f, promised_date: e.target.value }))} />
          </Field>
        </div>
        <Field label="Remarks">
          <Input value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
        </Field>
        <p className="text-xs text-muted-foreground">
          Earlier commitments stay on the record: a new meeting adds rows instead of replacing them.
        </p>
      </FormDialog>

      <TaskPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projectId={projectId}
        onPick={(task) => {
          setPickerOpen(false);
          setForm((f) => ({ ...f, task_id: task.id, task_ref: task.task_ref }));
        }}
      />
    </>
  );
}