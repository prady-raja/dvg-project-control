import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { CONTRACTOR_CLASSIFICATIONS } from '@/lib/constants';
import { nullify } from '@/lib/dataHelpers';

const empty = {
  name: '',
  classification: 'External Contractor',
  trade: '',
  contact_person: '',
  phone: '',
  email: '',
  active: true,
  notes: '',
};

export default function ContractorDialog({ open, onOpenChange, contractor, cat, onSaved }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(contractor ? { ...empty, ...contractor, active: contractor.active !== false } : empty);
    setError('');
  }, [open, contractor]);

  const save = async () => {
    if (!form.name.trim()) {
      setError('A contractor name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = contractor
        ? await base44.entities.Contractor.update(contractor.id, nullify(form))
        : await base44.entities.Contractor.create(nullify(form));
      await cat.refresh();
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'Could not save the contractor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={contractor ? 'Edit execution team / contractor' : 'New execution team / contractor'}
      onSubmit={save}
      submitting={saving}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Classification">
          <EnumSelect
            value={form.classification}
            onChange={(v) => setForm((f) => ({ ...f, classification: v }))}
            options={CONTRACTOR_CLASSIFICATIONS}
          />
        </Field>
        <Field label="Trade / responsibility">
          <Input value={form.trade} onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))} placeholder="e.g. Finishes" />
        </Field>
        <Field label="Contact person">
          <Input value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <Checkbox checked={form.active !== false} onCheckedChange={(v) => setForm((f) => ({ ...f, active: !!v }))} />
        Active — available for new task assignments
      </label>
      <Field label="Notes">
        <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </Field>
    </FormDialog>
  );
}