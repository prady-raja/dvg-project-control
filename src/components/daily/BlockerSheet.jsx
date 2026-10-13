import React, { useEffect, useState } from 'react';
import { data } from '@/api/data';
import { clearBlocker, raiseBlocker } from '@/lib/constraintService';
import { updateTask } from '@/lib/taskService';
import { errorMessageOf } from '@/lib/clientErrors';
import { BLOCKER_CATEGORIES, CONSTRAINT_OWNER_TYPES, defaultOwnerTypeFor } from '@/lib/shared/enums.ts';
import { useCatalogs } from '@/lib/CatalogContext';
import { useToast } from '@/components/ui/use-toast';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import UserPicker from '@/components/common/UserPicker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { todayIst } from '@/lib/format';

const EMPTY = { category: '', description: '', owner_type: 'Contractor', owner_id: '', owner_name: '', due_date: '' };

/**
 * Block and Unblock in one place (F-02). Blocking names what is holding the work
 * up, who must clear it and by when; unblocking asks which status the work moves
 * to. One save writes the blocker record and the task together.
 */
export default function BlockerSheet({ task, onClose, onSaved }) {
  const cat = useCatalogs();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(null); // the open constraint, when the task is already blocked
  const [next, setNext] = useState('In Progress');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const blocked = task?.status === 'Blocked';

  useEffect(() => {
    if (!task) return undefined;
    setError('');
    setNote('');
    setNext('In Progress');
    setOpen(null);
    setForm({ ...EMPTY, owner_type: 'Contractor', owner_id: task.contractor_id || '', owner_name: '' });
    if (!blocked) return undefined;
    let alive = true;
    data.list('TaskConstraint', { task_id: task.id, status: 'Open' }, { limit: 1 })
      .then((rows) => alive && setOpen(rows[0] || null))
      .catch(() => {});
    return () => { alive = false; };
  }, [task, blocked]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const chooseCategory = (category) => {
    const ownerType = defaultOwnerTypeFor(category);
    set({ category, owner_type: ownerType, owner_id: ownerType === 'Contractor' ? task?.contractor_id || '' : '', owner_name: '' });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (blocked) {
        if (open) await clearBlocker(open.id, next, note);
        else await updateTask(task.id, { status: next });
        toast({ description: `${task.task_ref || task.ref} unblocked — now ${next}.` });
      } else {
        if (!form.category) throw new Error('Choose what is holding the work up.');
        if (!form.description.trim()) throw new Error('Say what is holding the work up.');
        if (form.due_date && form.due_date < todayIst()) throw new Error('Choose a date from today onward.');
        const contractor = form.owner_type === 'Contractor' ? cat.contractorById(form.owner_id) : null;
        await raiseBlocker({
          task_id: task.id,
          ...form,
          owner_name: form.owner_name.trim() || contractor?.name || '',
        });
        toast({ description: `${task.task_ref || task.ref} blocked. ${form.due_date ? '' : 'No clear-by date was set.'}`.trim() });
      }
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(errorMessageOf(e, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;
  const ref = task.task_ref || task.ref;

  return (
    <FormDialog
      open={!!task}
      onOpenChange={(v) => !v && onClose()}
      title={blocked ? `Unblock ${ref}` : `Block ${ref}`}
      description={task.name}
      onSubmit={save}
      submitting={saving}
      submitLabel={blocked ? 'Unblock' : 'Block this task'}
      error={error}
    >
      {blocked ? (
        <>
          {open && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Blocked by {open.category}: {open.description}. Owner {open.owner_name || open.owner_type}{open.due_date ? `, to clear by ${open.due_date}` : ''}.
            </p>
          )}
          <Field label="Work moves to" required>
            <EnumSelect value={next} onChange={setNext} options={['In Progress', 'Not Started']} />
          </Field>
          <Field label="What cleared it (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Tiles delivered" />
          </Field>
        </>
      ) : (
        <>
          <Field label="What is holding it up?" required>
            <EnumSelect value={form.category} onChange={chooseCategory} options={BLOCKER_CATEGORIES} placeholder="Choose a reason" />
          </Field>
          <Field label="Details" required>
            <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Wardrobe hardware not on site" />
          </Field>
          <Field label="Who must clear it?" required>
            <EnumSelect value={form.owner_type} onChange={(v) => set({ owner_type: v, owner_id: '', owner_name: '' })} options={CONSTRAINT_OWNER_TYPES} />
          </Field>
          {form.owner_type === 'Contractor' && (
            <Field label="Contractor">
              <EnumSelect
                value={form.owner_id}
                onChange={(v) => set({ owner_id: v, owner_name: '' })}
                options={[{ value: '', label: 'Not named' }, ...cat.contractors.filter((c) => c.active !== false).map((c) => ({ value: c.id, label: c.name }))]}
              />
            </Field>
          )}
          {form.owner_type === 'DVG' && (
            <Field label="DVG team member">
              <UserPicker projectId={task.project_id} value={form.owner_id} onChange={(v) => set({ owner_id: v })} placeholder="Not named" />
            </Field>
          )}
          {['Villa owner', 'Consultant', 'Authority'].includes(form.owner_type) && (
            <Field label={form.owner_type === 'Villa owner' ? 'Owner’s name (optional)' : 'Name'}>
              <Input value={form.owner_name} onChange={(e) => set({ owner_name: e.target.value })} />
            </Field>
          )}
          <Field label="Should clear by" hint="Without a date the blocker cannot be chased.">
            <Input type="date" min={todayIst()} value={form.due_date} onChange={(e) => set({ due_date: e.target.value })} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}