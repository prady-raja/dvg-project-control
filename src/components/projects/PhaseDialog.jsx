import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PHASE_STATUSES } from '@/lib/constants';
import { createRecord, updateRecord } from '@/lib/recordService';

const empty = { name: '', code: '', planned_villa_count: '', status: 'Not Started', sort_order: '', notes: '' };

export default function PhaseDialog({ open, onOpenChange, phase, projectId, cat, onSaved }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      phase
        ? {
            name: phase.name || '',
            code: phase.code || '',
            planned_villa_count: phase.planned_villa_count ?? '',
            status: phase.status || 'Not Started',
            sort_order: phase.sort_order ?? '',
            notes: phase.notes || '',
          }
        : empty,
    );
    setError('');
  }, [open, phase]);

  const save = async () => {
    if (!form.name.trim()) {
      setError('A phase name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, project_id: projectId, code: (form.code || '').trim().toUpperCase() };
      const { record: saved } = phase
        ? await updateRecord('Phase', phase.id, payload)
        : await createRecord('Phase', payload);
      await cat.refresh();
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'Could not save the phase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={phase ? 'Edit phase' : 'New phase'}
      description="The phase code appears in task references, e.g. IMG-A-0001."
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phase name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Phase A" />
        </Field>
        <Field label="Phase code" hint="Short code, e.g. A">
          <Input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="field-mono"
          />
        </Field>
        <Field label="Planned villa count">
          <Input
            type="number"
            min="0"
            value={form.planned_villa_count}
            onChange={(e) => setForm((f) => ({ ...f, planned_villa_count: e.target.value }))}
          />
        </Field>
        <Field label="Status">
          <EnumSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={PHASE_STATUSES} />
        </Field>
        <Field label="Display order">
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </Field>
    </FormDialog>
  );
}