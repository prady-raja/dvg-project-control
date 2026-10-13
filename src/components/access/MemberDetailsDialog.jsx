import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import { Input } from '@/components/ui/input';
import { updateRecord } from '@/lib/recordService';
import { forgetProjectMembers } from '@/hooks/useProjectMembers';

/** Phone (for Chase on WhatsApp) and initials (for avatars and name matching). */
export default function MemberDetailsDialog({ open, onOpenChange, member, onSaved }) {
  const [form, setForm] = useState({ user_name: '', phone: '', initials: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !member) return;
    setForm({ user_name: member.user_name || '', phone: member.phone || '', initials: member.initials || '' });
    setError('');
  }, [open, member]);

  const save = async () => {
    const phone = form.phone.replace(/[^\d+]/g, '');
    if (phone && phone.replace(/\D/g, '').length < 8) {
      setError('Enter the phone number with its country code, for example +91 98xxxxxxxx.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateRecord('ProjectMembership', member.id, {
        user_name: form.user_name.trim(),
        phone: phone || null,
        initials: form.initials.trim().toUpperCase().slice(0, 3) || null,
      });
      forgetProjectMembers(member.project_id);
      await onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={member?.user_name || member?.user_email || 'Member'} description="Used when work is assigned and when someone is chased on WhatsApp." onSubmit={save} submitting={saving} error={error}>
      <Field label="Name">
        <Input value={form.user_name} onChange={(e) => setForm((f) => ({ ...f, user_name: e.target.value }))} />
      </Field>
      <Field label="Mobile (with country code)">
        <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98xxxxxxxx" />
      </Field>
      <Field label="Initials">
        <Input value={form.initials} maxLength={3} onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))} placeholder="PR" />
      </Field>
    </FormDialog>
  );
}
