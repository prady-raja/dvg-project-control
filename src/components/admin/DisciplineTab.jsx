import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import { createRecord, updateRecord } from '@/lib/recordService';

const empty = { name: '', code: '', sort_order: '', active: true };

export default function DisciplineTab({ cat }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const openDialog = (discipline) => {
    setEditing(discipline || null);
    setForm(
      discipline
        ? { name: discipline.name, code: discipline.code, sort_order: discipline.sort_order ?? '', active: discipline.active !== false }
        : { ...empty, sort_order: (cat.disciplines.length || 0) + 1 },
    );
    setError('');
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError('Discipline name and code are both required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        sort_order: form.sort_order === '' ? null : Number(form.sort_order),
      };
      if (editing) await updateRecord('Discipline', editing.id, payload);
      else await createRecord('Discipline', payload);
      await cat.refresh();
      setOpen(false);
    } catch (e) {
      setError(e?.message || 'Could not save the discipline.');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (discipline, active) => {
    await updateRecord('Discipline', discipline.id, { active });
    await cat.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cat.disciplines.length} disciplines. Disciplines are disabled rather than deleted so historic tasks keep their reference.
        </p>
        <Button size="sm" className="gap-2" onClick={() => openDialog(null)}>
          <Plus className="h-4 w-4" /> Add discipline
        </Button>
      </div>

      <div className="scroll-slim overflow-x-auto rounded-xl border border-border bg-card">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Discipline</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cat.disciplines.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="text-sm font-medium">{d.name}</TableCell>
                <TableCell className="field-mono text-xs text-muted-foreground">{d.code}</TableCell>
                <TableCell className="field-mono text-xs text-muted-foreground">{d.sort_order ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <Switch checked={d.active !== false} onCheckedChange={(v) => setActive(d, v)} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Edit discipline" onClick={() => openDialog(d)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit discipline' : 'New discipline'}
        onSubmit={save}
        submitting={saving}
        error={error}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Code" required hint="Permanent short code, e.g. CIVIL">
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="field-mono"
            />
          </Field>
          <Field label="Display order">
            <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
          </Field>
        </div>
      </FormDialog>
    </div>
  );
}