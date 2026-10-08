import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { base44 } from '@/api/base44Client';

export default function ContractorDefaultTab({ cat }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ project_id: '', phase_id: '', discipline: '', contractor_id: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const phases = form.project_id ? cat.phasesFor(form.project_id) : [];

  const openDialog = (record) => {
    setEditing(record || null);
    setForm(
      record
        ? {
            project_id: record.project_id || '',
            phase_id: record.phase_id || '',
            discipline: record.discipline || '',
            contractor_id: record.contractor_id || '',
            notes: record.notes || '',
          }
        : { project_id: cat.projects[0]?.id || '', phase_id: '', discipline: '', contractor_id: '', notes: '' },
    );
    setError('');
    setOpen(true);
  };

  const save = async () => {
    if (!form.project_id || !form.discipline || !form.contractor_id) {
      setError('Project, discipline and contractor are all required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, active: true };
      if (editing) await base44.entities.ContractorDefault.update(editing.id, payload);
      else await base44.entities.ContractorDefault.create(payload);
      await cat.refresh();
      setOpen(false);
    } catch (e) {
      setError(e?.message || 'Could not save the default.');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (record, active) => {
    await base44.entities.ContractorDefault.update(record.id, { active });
    await cat.refresh();
  };

  const rows = [...cat.contractorDefaults].sort((a, b) => {
    const pa = cat.projectById(a.project_id)?.name || '';
    const pb = cat.projectById(b.project_id)?.name || '';
    return pa.localeCompare(pb) || String(a.discipline).localeCompare(String(b.discipline));
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The suggested contractor is applied automatically when a discipline is chosen on a task. A phase-specific rule
          beats a project-wide one.
        </p>
        <Button size="sm" className="shrink-0 gap-2" onClick={() => openDialog(null)}>
          <Plus className="h-4 w-4" /> Add default
        </Button>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No contractor defaults yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {cat.disciplineName(r.discipline)} → {cat.contractorById(r.contractor_id)?.name || 'Unassigned'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {cat.projectById(r.project_id)?.name || '—'} ·{' '}
                {r.phase_id ? cat.phaseById(r.phase_id)?.name || 'Phase' : 'All phases'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Switch checked={r.active !== false} onCheckedChange={(v) => setActive(r, v)} />
              <Button variant="ghost" size="icon" onClick={() => openDialog(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit contractor default' : 'New contractor default'}
        onSubmit={save}
        submitting={saving}
        error={error}
      >
        <Field label="Project" required>
          <EnumSelect
            value={form.project_id}
            onChange={(v) => setForm((f) => ({ ...f, project_id: v, phase_id: '' }))}
            options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
        <Field label="Phase" hint="Leave blank to apply to every phase of the project.">
          <EnumSelect
            value={form.phase_id}
            onChange={(v) => setForm((f) => ({ ...f, phase_id: v }))}
            options={phases.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="All phases"
            disabled={!phases.length}
          />
        </Field>
        <Field label="Discipline" required>
          <EnumSelect
            value={form.discipline}
            onChange={(v) => setForm((f) => ({ ...f, discipline: v }))}
            options={cat.disciplines.map((d) => ({ value: d.code, label: d.name }))}
          />
        </Field>
        <Field label="Contractor" required>
          <EnumSelect
            value={form.contractor_id}
            onChange={(v) => setForm((f) => ({ ...f, contractor_id: v }))}
            options={cat.contractors.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>
      </FormDialog>
    </div>
  );
}