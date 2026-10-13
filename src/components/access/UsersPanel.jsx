import React, { useState } from 'react';
import { KeyRound, MailPlus, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Pill from '@/components/common/Pill';
import InviteUserDialog from '@/components/access/InviteUserDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const membershipsOf = (memberships, email) =>
  (memberships || []).filter((m) => (m.user_email || '').toLowerCase() === (email || '').toLowerCase());

/**
 * Administration → Users & Access: the application administrator's view of who
 * may sign in, what they are called, their permission level and their status.
 */
export default function UsersPanel({ users, memberships, projects, onChanged }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const saveDesignation = async (user) => {
    const value = (draft[user.id] ?? user.designation ?? '').trim();
    setBusy(user.id);
    setNote('');
    try {
      await base44.entities.User.update(user.id, { designation: value || null });
      await onChanged?.();
    } catch (e) {
      setNote(e?.message || 'The designation could not be saved.');
    } finally {
      setBusy('');
    }
  };

  const sendReset = async (user) => {
    setBusy(user.id);
    setNote('');
    try {
      await base44.auth.resetPasswordRequest(user.email);
      setNote(`A password reset email was requested for ${user.email}.`);
    } catch (e) {
      setNote(e?.message || 'The reset could not be requested.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">Users</h2>
          <p className="text-xs text-muted-foreground">Invite, name and reset the people who may sign in.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
          <MailPlus className="h-3.5 w-3.5" /> Invite user
        </Button>
      </header>

      <ul className="divide-y divide-border">
        {users.map((user) => {
          const rows = membershipsOf(memberships, user.email);
          const value = draft[user.id] ?? user.designation ?? '';
          return (
            <li key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.full_name || user.email}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Pill value={user.role === 'admin' ? 'Approved' : 'Active'} />
                  <span className="text-xs text-muted-foreground">
                    {user.role === 'admin' ? 'Application administrator' : 'App role: user'}
                  </span>
                  {rows.length === 0 && <Pill value="Pending Setup" />}
                  {rows.map((m) => (
                    <span key={m.id} className="text-xs text-muted-foreground">
                      {m.role} · {projects.find((p) => p.id === m.project_id)?.name || 'project'}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Input
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [user.id]: e.target.value }))}
                  placeholder="Designation"
                  className="h-8 w-48"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy === user.id || value === (user.designation || '')}
                  onClick={() => saveDesignation(user)}
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5" disabled={busy === user.id} onClick={() => sendReset(user)}>
                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {users.length === 0 && <p className="px-5 py-8 text-sm text-muted-foreground">No users yet.</p>}

      {note && <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{note}</p>}

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        projects={projects}
        defaultProjectId={projects.find((p) => /imagine/i.test(p.name || ''))?.id || projects[0]?.id}
        onInvited={onChanged}
      />
    </section>
  );
}