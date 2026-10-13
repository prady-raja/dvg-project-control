import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { ASSIGNABLE_ROLES } from '@/lib/shared/enums.ts';
import { createRecord } from '@/lib/recordService';

export default function MembershipDialog({ open, onOpenChange, cat, user, onSaved }) {
  const [form, setForm] = useState({ user_email: '', user_name: '', project_id: '', role: 'Project Editor' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        user_email: '',
        user_name: '',
        project_id: cat.projects[0]?.id || '',
        role: 'Project Editor',
      });
      setError('');
    }
  }, [open, cat.projects]);

  const save = async () => {
    if (!form.user_email.trim() || !form.project_id) {
      setError('An email address and a project are both required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createRecord('ProjectMembership', {
        ...form,
        user_email: form.user_email.trim().toLowerCase(),
        active: true,
        notes: `Recorded by ${user?.email || 'unknown'}. Access begins the first time they sign in.`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'Could not record the membership.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add project member"
      description="Records who belongs to the project and at what level. Access begins when they sign in with the invited address. Only an application administrator may change membership."
      onSubmit={save}
      submitting={saving}
      error={error}
      submitLabel="Record member"
    >
      <Field label="Email address" required>
        <Input
          type="email"
          value={form.user_email}
          onChange={(e) => setForm((f) => ({ ...f, user_email: e.target.value }))}
          placeholder="name@dreamvalley.example"
        />
      </Field>
      <Field label="Full name">
        <Input value={form.user_name} onChange={(e) => setForm((f) => ({ ...f, user_name: e.target.value }))} />
      </Field>
      <Field label="Project" required>
        <EnumSelect
          value={form.project_id}
          onChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
          options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Field>
      <Field label="Role on the project">
        <EnumSelect value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={ASSIGNABLE_ROLES} />
      </Field>
    </FormDialog>
  );
}