import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, MessageCircle, UserCog } from 'lucide-react';
import { CONSTRAINT_OWNER_TYPES } from '@shared/enums.ts';
import { chaseOnWhatsApp, updateBlocker } from '@/lib/constraintService';
import { errorMessageOf } from '@/lib/clientErrors';
import { formatDate } from '@/lib/format';
import { useCatalogs } from '@/lib/CatalogContext';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import StatusPill from '@/components/common/StatusPill';
import { useQuickActions } from '@/components/layout/QuickActions';

/** Change who must clear a blocker and by when. */
function EditDialog({ row, onClose, onSaved }) {
  const [form, setForm] = useState({ owner_type: row.constraint?.owner_type || 'Contractor', owner_name: row.constraint?.owner_name || '', due_date: row.constraint?.due_date || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await updateBlocker(row.constraint.id, form);
      await onSaved();
      onClose();
    } catch (e) {
      setError(errorMessageOf(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <FormDialog open onOpenChange={(v) => !v && onClose()} title={`Owner and date — ${row.ref}`} description={row.blocker} onSubmit={save} submitting={saving} error={error}>
      <Field label="Who must clear it?">
        <EnumSelect value={form.owner_type} onChange={(v) => setForm((f) => ({ ...f, owner_type: v }))} options={CONSTRAINT_OWNER_TYPES} />
      </Field>
      <Field label="Name">
        <Input value={form.owner_name} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} />
      </Field>
      <Field label="Should clear by">
        <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
      </Field>
    </FormDialog>
  );
}

function BlockerRow({ row, onChanged }) {
  const cat = useCatalogs();
  const { members } = useProjectMembers(row.project_id);
  const { toast } = useToast();
  const quick = useQuickActions();
  const [editing, setEditing] = useState(false);

  // The number to chase: the contractor, the DVG member, or none (then the text is copied).
  const phoneFor = () => {
    const c = row.constraint;
    if (c?.owner_type === 'Contractor') return cat.contractorById(c.owner_id || row.contractor_id)?.phone || '';
    if (c?.owner_type === 'DVG') return members.find((m) => m.user_id === c.owner_id)?.phone || '';
    if (!c) return cat.contractorById(row.contractor_id)?.phone || '';
    return '';
  };

  const chase = async () => {
    const result = await chaseOnWhatsApp({ row, phone: phoneFor() });
    if (result.copied) toast({ description: 'No phone number on record — the message was copied. Paste it into WhatsApp.' });
    else if (!result.sent) toast({ description: result.message || 'Could not open WhatsApp.', variant: 'destructive' });
    onChanged();
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/tasks/${row.id}`} className="field-mono text-xs font-semibold hover:underline">{row.ref}</Link>
          <span className="ml-2 text-xs text-muted-foreground">{row.villa}</span>
          <p className="mt-0.5 text-sm">{row.blocker || row.name}</p>
          <p className="text-xs text-muted-foreground">{row.blocker_category || 'Not categorised'}{row.days_blocked != null ? ` · blocked ${row.days_blocked}d` : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={row.status} />
          <span className={`inline-flex items-center gap-1 text-[11px] ${row.constraint?.past_due ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
            <CalendarClock className="h-3 w-3" aria-hidden />
            {row.expected_resolution_date ? `clear by ${formatDate(row.expected_resolution_date)}${row.constraint?.past_due ? ' — past due' : ''}` : 'no date set'}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => quick.openBlocker({ ...row, status: 'Blocked' })}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
        </Button>
        {row.constraint && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
            <UserCog className="h-3.5 w-3.5" /> Set owner / date
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={chase}>
          <MessageCircle className="h-3.5 w-3.5" /> Chase
        </Button>
        {row.constraint?.chase_count > 0 && (
          <span className="self-center text-[11px] text-muted-foreground">chased {row.constraint.chase_count}×{row.constraint.last_chased_at ? `, last ${formatDate(row.constraint.last_chased_at)}` : ''}</span>
        )}
      </div>
      {editing && <EditDialog row={row} onClose={() => setEditing(false)} onSaved={onChanged} />}
    </li>
  );
}

/** Blockers grouped by who must clear them, past-due groups first, each row with Resolve, Set owner / date and Chase. */
export default function BlockerOwnerGroups({ groups = [], onChanged }) {
  if (!groups.length) return <p className="px-1 py-8 text-center text-sm text-muted-foreground">No blocker is recorded in this scope.</p>;
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.owner} className="rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold">{group.owner}</h3>
            <span className="text-xs text-muted-foreground">
              {group.rows.length} blocker{group.rows.length === 1 ? '' : 's'}
              {group.past_due > 0 && <span className="ml-2 font-semibold text-destructive">{group.past_due} past due</span>}
              {group.no_date > 0 && <span className="ml-2">{group.no_date} without a date</span>}
            </span>
          </header>
          <ul className="divide-y divide-border px-4">
            {group.rows.map((row) => <BlockerRow key={row.id} row={row} onChanged={onChanged} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
