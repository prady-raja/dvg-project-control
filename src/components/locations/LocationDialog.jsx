import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { ACTIVE_STATUSES, LOCATION_TYPES, POSSESSION_STATUSES, WORKS_STAGES } from '@/lib/constants';
import { nullify } from '@/lib/dataHelpers';

const empty = {
  villa_code: '',
  location_type: 'Villa',
  plot_numbers: '',
  possession_status: 'Not Handed Over',
  possession_date: '',
  works_stage: 'Not Started',
  active_status: 'Active',
  planned_completion_date: '',
  assigned_engineer: '',
  sort_order: '',
  notes: '',
};

export default function LocationDialog({ open, onOpenChange, location, defaultProjectId, defaultPhaseId, cat, onSaved }) {
  const [form, setForm] = useState(empty);
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      location
        ? {
            villa_code: location.villa_code || '',
            location_type: location.location_type || 'Villa',
            plot_numbers: location.plot_numbers || '',
            possession_status: location.possession_status || 'Not Handed Over',
            possession_date: location.possession_date || '',
            works_stage: location.works_stage || 'Not Started',
            active_status: location.active_status || 'Active',
            planned_completion_date: location.planned_completion_date || '',
            assigned_engineer: location.assigned_engineer || '',
            sort_order: location.sort_order ?? '',
            notes: location.notes || '',
          }
        : empty,
    );
    setProjectId(location?.project_id || defaultProjectId || cat.projects[0]?.id || '');
    setPhaseId(location?.phase_id || defaultPhaseId || '');
    setError('');
  }, [open, location, defaultProjectId, defaultPhaseId, cat.projects]);

  const phases = projectId ? cat.phasesFor(projectId) : [];

  const save = async () => {
    if (!projectId) {
      setError('Select a project.');
      return;
    }
    if (!form.villa_code.trim()) {
      setError('A villa or location name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = nullify({ ...form, project_id: projectId, phase_id: phaseId, villa_code: form.villa_code.trim() });
      const saved = location
        ? await base44.entities.Location.update(location.id, payload)
        : await base44.entities.Location.create(payload);
      await cat.refresh();
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'Could not save the location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={location ? 'Edit villa / location' : 'New villa / location'}
      description="Possession status and construction stage are always tracked separately."
      onSubmit={save}
      submitting={saving}
      error={error}
      size="sm:max-w-2xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project" required>
          <EnumSelect
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setPhaseId('');
            }}
            options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
        <Field label="Phase" hint="Leave blank for project-wide or common work.">
          <EnumSelect
            value={phaseId}
            onChange={setPhaseId}
            options={phases.map((p) => ({ value: p.id, label: `${p.code ? `${p.code} — ` : ''}${p.name}` }))}
            placeholder="No phase"
            disabled={!phases.length}
          />
        </Field>
        <Field label="Villa code / location name" required hint="Permanent physical ID, e.g. A-01 or B-05-06">
          <Input value={form.villa_code} onChange={(e) => setForm((f) => ({ ...f, villa_code: e.target.value }))} />
        </Field>
        <Field label="Location type">
          <EnumSelect value={form.location_type} onChange={(v) => setForm((f) => ({ ...f, location_type: v }))} options={LOCATION_TYPES} />
        </Field>
        <Field label="Original plot references" hint="Stored separately from the villa ID.">
          <Input value={form.plot_numbers} onChange={(e) => setForm((f) => ({ ...f, plot_numbers: e.target.value }))} placeholder="e.g. Plots 5 & 6" />
        </Field>
        <Field label="Assigned engineer">
          <Input value={form.assigned_engineer} onChange={(e) => setForm((f) => ({ ...f, assigned_engineer: e.target.value }))} />
        </Field>
        <Field label="Possession status">
          <EnumSelect value={form.possession_status} onChange={(v) => setForm((f) => ({ ...f, possession_status: v }))} options={POSSESSION_STATUSES} />
        </Field>
        <Field label="Possession date">
          <Input type="date" value={form.possession_date} onChange={(e) => setForm((f) => ({ ...f, possession_date: e.target.value }))} />
        </Field>
        <Field label="Works stage">
          <EnumSelect value={form.works_stage} onChange={(v) => setForm((f) => ({ ...f, works_stage: v }))} options={WORKS_STAGES} />
        </Field>
        <Field label="Active status" hint="On-hold villas stay in inventory but are excluded from active-work figures.">
          <EnumSelect value={form.active_status} onChange={(v) => setForm((f) => ({ ...f, active_status: v }))} options={ACTIVE_STATUSES} />
        </Field>
        <Field label="Planned completion date">
          <Input
            type="date"
            value={form.planned_completion_date}
            onChange={(e) => setForm((f) => ({ ...f, planned_completion_date: e.target.value }))}
          />
        </Field>
        <Field label="Display order">
          <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </Field>
    </FormDialog>
  );
}