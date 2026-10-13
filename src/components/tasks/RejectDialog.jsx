import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Textarea } from '@/components/ui/textarea';
import { REJECTION_CATEGORIES } from '@/lib/shared/rework.ts';

/**
 * Reject for rework (Q-04): why the finished work failed inspection and what has
 * to be redone. Returns { category, note } to onSubmit.
 */
export default function RejectDialog({ open, onOpenChange, onSubmit, submitting = false, error = '' }) {
  const [form, setForm] = useState({ category: REJECTION_CATEGORIES[0], note: '' });
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (open) { setForm({ category: REJECTION_CATEGORIES[0], note: '' }); setProblem(''); }
  }, [open]);

  const submit = () => {
    if (!form.note.trim()) { setProblem('Say what has to be redone, so the contractor knows.'); return; }
    setProblem('');
    onSubmit({ category: form.category, note: form.note.trim() });
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Reject for rework" description="The work goes back to In Progress. The reason stays on the task and in its history." onSubmit={submit} submitLabel="Reject for rework" submitting={submitting} error={problem || error}>
      <Field label="Why" required><EnumSelect value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={REJECTION_CATEGORIES} /></Field>
      <Field label="What has to be redone" required><Textarea rows={3} maxLength={1000} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
    </FormDialog>
  );
}
