import React, { useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/** One floor of a villa. Floors are created deliberately, from the drawings. */
export default function FloorDialog({ open, onOpenChange, initial, onSubmit, submitting, error }) {
  const [values, setValues] = useState(null);
  const [localError, setLocalError] = useState('');

  const current = values || {
    floor_name: initial?.floor_name || '',
    floor_code: initial?.floor_code || '',
    level_order: initial?.level_order ?? '',
    notes: initial?.notes || '',
  };

  const set = (patch) => setValues({ ...current, ...patch });

  const submit = () => {
    if (!String(current.floor_name || '').trim()) {
      setLocalError('Give the floor the name people say on site, e.g. First Floor.');
      return;
    }
    setLocalError('');
    onSubmit({
      floor_name: current.floor_name.trim(),
      floor_code: String(current.floor_code || '').trim() || null,
      level_order: current.level_order === '' ? null : Number(current.level_order),
      notes: String(current.notes || '').trim() || null,
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        setValues(null);
        setLocalError('');
        onOpenChange(next);
      }}
      title={initial?.id ? 'Edit floor' : 'Add floor'}
      description="Floors are what room scopes are built on, and what a task is filed against."
      onSubmit={submit}
      submitting={submitting}
      submitLabel={initial?.id ? 'Save floor' : 'Add floor'}
      error={localError || error}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Floor name" required hint="As said on site — Ground Floor, First Floor, Terrace.">
          <Input value={current.floor_name} onChange={(e) => set({ floor_name: e.target.value })} />
        </Field>
        <Field label="Floor code" hint="Short code used in references, e.g. GF, F1, TF.">
          <Input value={current.floor_code} onChange={(e) => set({ floor_code: e.target.value })} />
        </Field>
        <Field label="Level order" hint="Lowest floor first. Leave blank when it is not known.">
          <Input type="number" value={current.level_order} onChange={(e) => set({ level_order: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={current.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </FormDialog>
  );
}