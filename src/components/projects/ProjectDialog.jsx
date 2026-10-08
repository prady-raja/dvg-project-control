import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PROJECT_STATUSES } from '@/lib/constants';
import { createRecord, updateRecord } from '@/lib/recordService';

const empty = {
  name: '',
  code: '',
  location: '',
  status: 'Active',
  planned_villa_count: '',
  enabled_disciplines: [],
  notes: '',
};

export default function ProjectDialog({ open, onOpenChange, project, cat, onSaved }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      project
        ? {
            name: project.name || '',
            code: project.code || '',
            location: project.location || '',
            status: project.status || 'Active',
            planned_villa_count: project.planned_villa_count ?? '',
            enabled_disciplines: project.enabled_disciplines || [],
            notes: project.notes || '',
          }
        : { ...empty, enabled_disciplines: cat.disciplines.map((d) => d.id) },
    );
    setError('');
  }, [open, project, cat.disciplines]);

  const toggleDiscipline = (id, checked) =>
    setForm((f) => ({
      ...f,
      enabled_disciplines: checked
        ? [...f.enabled_disciplines, id]
        : f.enabled_disciplines.filter((x) => x !== id),
    }));

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError('Project name and project code are both required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase() };
      const { record: saved } = project
        ? await updateRecord('Project', project.id, payload)
        : await createRecord('Project', payload);
      await cat.refresh();
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'Could not save the project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={project ? 'Edit project' : 'New project'}
      description="Project code is used in every task reference."
      onSubmit={save}
      submitting={saving}
      error={error}
      size="sm:max-w-2xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Imagine Villas" />
        </Field>
        <Field label="Project code" required hint="2–4 letters, e.g. IMG">
          <Input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="IMG"
            className="field-mono"
          />
        </Field>
        <Field label="Location">
          <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </Field>
        <Field label="Status">
          <EnumSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={PROJECT_STATUSES} />
        </Field>
        <Field label="Planned villa count">
          <Input
            type="number"
            min="0"
            value={form.planned_villa_count}
            onChange={(e) => setForm((f) => ({ ...f, planned_villa_count: e.target.value }))}
          />
        </Field>
      </div>

      <Field label="Enabled disciplines" hint="Only these disciplines can be used on the project's tasks.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cat.disciplines.map((d) => (
            <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-2 text-xs">
              <Checkbox
                checked={form.enabled_disciplines.includes(d.id)}
                onCheckedChange={(v) => toggleDiscipline(d.id, !!v)}
              />
              <span className="truncate">{d.name}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Notes">
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </Field>
    </FormDialog>
  );
}