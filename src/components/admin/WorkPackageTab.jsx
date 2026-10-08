import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { createRecord, updateRecord } from '@/lib/recordService';

export default function WorkPackageTab({ cat }) {
  const [projectId, setProjectId] = useState(cat.projects[0]?.id || '');
  const [discipline, setDiscipline] = useState(cat.disciplines[0]?.code || '');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ package_name: '', sort_order: '', active: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const activeProjectId = projectId || cat.projects[0]?.id || '';
  const activeDiscipline = discipline || cat.disciplines[0]?.code || '';

  const packages = cat.workPackages
    .filter((w) => w.project_id === activeProjectId && w.discipline === activeDiscipline)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const openDialog = (workPackage) => {
    setEditing(workPackage || null);
    setForm(
      workPackage
        ? { package_name: workPackage.package_name, sort_order: workPackage.sort_order ?? '', active: workPackage.active !== false }
        : { package_name: '', sort_order: packages.length + 1, active: true },
    );
    setError('');
    setOpen(true);
  };

  const save = async () => {
    if (!form.package_name.trim()) {
      setError('A work package name is required.');
      return;
    }
    if (!activeProjectId || !activeDiscipline) {
      setError('Select a project and discipline first.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        project_id: activeProjectId,
        discipline: activeDiscipline,
        package_name: form.package_name.trim(),
        sort_order: form.sort_order === '' ? null : Number(form.sort_order),
        active: form.active !== false,
      };
      if (editing) await updateRecord('WorkPackage', editing.id, payload);
      else await createRecord('WorkPackage', payload);
      await cat.refresh();
      setOpen(false);
    } catch (e) {
      setError(e?.message || 'Could not save the work package.');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (workPackage, active) => {
    await updateRecord('WorkPackage', workPackage.id, { active });
    await cat.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <EnumSelect
          value={activeProjectId}
          onChange={setProjectId}
          options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Select project"
        />
        <EnumSelect
          value={activeDiscipline}
          onChange={setDiscipline}
          options={cat.disciplines.map((d) => ({ value: d.code, label: d.name }))}
          placeholder="Select discipline"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {packages.length} work packages under{' '}
          <span className="font-medium text-foreground">{cat.disciplineName(activeDiscipline)}</span>
        </p>
        <Button size="sm" className="gap-2" onClick={() => openDialog(null)}>
          <Plus className="h-4 w-4" /> Add work package
        </Button>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {packages.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No work packages yet for this project and discipline.
          </p>
        )}
        {packages.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{w.package_name}</p>
              <p className="field-mono text-[11px] text-muted-foreground">Order {w.sort_order ?? '—'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Switch checked={w.active !== false} onCheckedChange={(v) => setActive(w, v)} />
              <Button variant="ghost" size="icon" onClick={() => openDialog(w)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit work package' : 'New work package'}
        description={`${cat.disciplineName(activeDiscipline)} work packages can be added without any code change.`}
        onSubmit={save}
        submitting={saving}
        error={error}
      >
        <Field label="Package name" required>
          <Input
            value={form.package_name}
            onChange={(e) => setForm((f) => ({ ...f, package_name: e.target.value }))}
            placeholder="e.g. False Ceiling"
          />
        </Field>
        <Field label="Display order">
          <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
        </Field>
      </FormDialog>
    </div>
  );
}