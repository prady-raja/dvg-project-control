import React, { useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const AREA_TYPES = ['Room', 'Bathroom', 'Kitchen', 'Living', 'Balcony', 'Terrace', 'Exterior', 'Utility', 'Staircase', 'Common', 'Other'];

/** One room or area of a villa: the register a work list and a drawing can both be read against. */
export default function AreaDialog({ open, onOpenChange, initial, floors = [], onSubmit, submitting, error }) {
  const [values, setValues] = useState(null);
  const [localError, setLocalError] = useState('');

  const current = values || {
    area_name: initial?.area_name || '',
    area_code: initial?.area_code || '',
    area_type: initial?.area_type || 'Room',
    floor_id: initial?.floor_id || '',
    aliases: (initial?.aliases || []).join(', '),
    source_name: initial?.source_name || '',
    notes: initial?.notes || '',
  };

  const set = (patch) => setValues({ ...current, ...patch });

  const submit = () => {
    if (!String(current.area_name || '').trim()) {
      setLocalError('Give the room the name used on site, e.g. Master Bedroom.');
      return;
    }
    setLocalError('');
    onSubmit({
      area_name: current.area_name.trim(),
      area_code: String(current.area_code || '').trim() || null,
      area_type: current.area_type,
      floor_id: current.floor_id || null,
      aliases: String(current.aliases || '')
        .split(',')
        .map((alias) => alias.trim())
        .filter(Boolean),
      source_name: String(current.source_name || '').trim() || null,
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
      title={initial?.id ? 'Edit room or area' : 'Add room or area'}
      description="Only what is registered here can be matched from a work list or a site message — nothing is guessed."
      onSubmit={submit}
      submitting={submitting}
      submitLabel={initial?.id ? 'Save room' : 'Add room'}
      error={localError || error}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Room/area name" required hint="e.g. Master Bedroom">
          <Input value={current.area_name} onChange={(e) => set({ area_name: e.target.value })} />
        </Field>
        <Field label="Code" hint="Short code, e.g. F1-MBR">
          <Input value={current.area_code} onChange={(e) => set({ area_code: e.target.value })} />
        </Field>
        <Field label="Type">
          <EnumSelect value={current.area_type} onChange={(value) => set({ area_type: value })} options={AREA_TYPES} />
        </Field>
        <Field label="Floor" hint="Leave blank until the floors are listed.">
          <EnumSelect
            value={current.floor_id}
            onChange={(value) => set({ floor_id: value })}
            options={[{ value: '', label: 'Not assigned yet' }, ...floors.map((floor) => ({ value: floor.id, label: floor.floor_name }))]}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Other names accepted" hint="Comma separated — e.g. Main Bedroom. Only list names that are genuinely the same room.">
            <Input value={current.aliases} onChange={(e) => set({ aliases: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Name as written in the source document" hint="Kept exactly as it appeared, for tracing back to the plan.">
            <Input value={current.source_name} onChange={(e) => set({ source_name: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={current.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </FormDialog>
  );
}