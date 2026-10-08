import React, { useState } from 'react';
import { KeyRound, MailPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Field from '@/components/common/Field';
import FormDialog from '@/components/common/FormDialog';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { createRecord } from '@/lib/recordService';
import { MEMBERSHIP_ROLES } from '@/lib/constants';

/**
 * Invites a genuine application user and records their project membership at the
 * same time. Base44 sends the invitation; the person sets their own password,
 * so no password is ever created or stored here.
 */
export default function InviteUserDialog({ open, onOpenChange, projects, defaultProjectId, onInvited }) {
  const [form, setForm] = useState({ email: '', full_name: '', designation: '', role: 'Project Editor', project_id: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setForm({
        email: '',
        full_name: '',
        designation: '',
        role: 'Project Editor',
        project_id: defaultProjectId || projects[0]?.id || '',
      });
      setError('');
    }
  }, [open, defaultProjectId, projects]);

  const save = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email || !form.project_id) {
      setError('An email address and a project are both required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await base44.users.inviteUser(email, 'user');
      await createRecord('ProjectMembership', {
        user_email: email,
        user_name: form.full_name.trim(),
        project_id: form.project_id,
        role: form.role,
        active: true,
        notes: `Invited by ${base44.auth?.me ? 'the application administrator' : 'administrator'}.`,
      });
      // The designation is a label on the person; it is stored once their
      // profile exists, which may be when they accept the invitation.
      if (form.designation.trim()) {
        try {
          const found = await base44.entities.User.filter({ email });
          const record = (Array.isArray(found) ? found : found?.items || [])[0];
          if (record?.id) await base44.entities.User.update(record.id, { designation: form.designation.trim() });
        } catch {
          // Not yet visible in the app — it can be set here once they appear.
        }
      }
      onInvited?.();
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'The invitation could not be sent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite a user"
      description="An invitation email is sent by the platform. The person sets their own password — no password is created or stored here."
      onSubmit={save}
      submitting={saving}
      error={error}
      submitLabel="Send invitation"
    >
      <Field label="Email address" required hint="The address that receives the invitation and signs in.">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="name@dreamvalleygroup.com"
        />
      </Field>
      <Field label="Display name">
        <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Full name" />
      </Field>
      <Field label="Designation" hint="A descriptive label only — it does not change what the person may do.">
        <Input
          value={form.designation}
          onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
          placeholder="Site Engineer, MEP Engineer, Procurement, Planning, Management"
        />
      </Field>
      <Field label="Project" required>
        <EnumSelect
          value={form.project_id}
          onChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Field>
      <Field label="Permission level" required hint="All five staff users use Project Editor.">
        <EnumSelect value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={MEMBERSHIP_ROLES} />
      </Field>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <MailPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        The account shows as Pending Setup until the invitation is accepted.
      </p>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Password reset is triggered from the user list, not here.
      </p>
    </FormDialog>
  );
}