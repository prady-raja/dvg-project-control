import React, { useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import PhotoUploader from '@/components/daily/PhotoUploader';
import { createSnag } from '@/lib/snagService';

const SEVERITIES = ['Minor', 'Major', 'Critical'];

/** Raising a snag. Photos stay optional so a routine snag takes seconds. */
export default function SnagDialog({ open, onOpenChange, projectId, phaseId, locationId, disciplines = [], contractors = [], onSaved }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    discipline: '',
    contractor_id: '',
    severity: 'Minor',
    target_date: '',
    handover_blocker: false,
  });
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) {
      setError('Describe the snag in the title.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createSnag({
        project_id: projectId,
        phase_id: phaseId || null,
        location_id: locationId || null,
        title: form.title.trim(),
        description: form.description.trim(),
        discipline: form.discipline || null,
        contractor_id: form.contractor_id || null,
        severity: form.severity,
        target_date: form.target_date || null,
        handover_blocker: !!form.handover_blocker,
        photo_uris: photos.map((photo) => photo.file_uri),
      });
      setForm({ title: '', description: '', discipline: '', contractor_id: '', severity: 'Minor', target_date: '', handover_blocker: false });
      setPhotos([]);
      onSaved();
    } catch (e) {
      setError(e?.message || 'Could not raise the snag.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Raise a snag"
      description="A snag is tracked separately from the task it was raised against."
      onSubmit={save}
      submitting={saving || busy}
      submitLabel="Raise snag"
      error={error}
    >
      <Field label="What is wrong" required>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Wardrobe shutter not aligned" />
      </Field>
      <Field label="Detail">
        <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Discipline">
          <EnumSelect
            value={form.discipline}
            onChange={(value) => setForm((f) => ({ ...f, discipline: value }))}
            options={[{ value: '', label: 'Not specified' }, ...disciplines.map((d) => ({ value: d.code, label: d.name }))]}
          />
        </Field>
        <Field label="Contractor responsible">
          <EnumSelect
            value={form.contractor_id}
            onChange={(value) => setForm((f) => ({ ...f, contractor_id: value }))}
            options={[{ value: '', label: 'Not assigned' }, ...contractors.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </Field>
        <Field label="Severity">
          <EnumSelect value={form.severity} onChange={(value) => setForm((f) => ({ ...f, severity: value }))} options={SEVERITIES} />
        </Field>
        <Field label="Target rectification date">
          <Input type="date" value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="snag-handover"
          checked={form.handover_blocker}
          onCheckedChange={(value) => setForm((f) => ({ ...f, handover_blocker: value }))}
        />
        <Label htmlFor="snag-handover" className="text-sm">Must be closed before handover</Label>
      </div>
      <Field label="Photographs (optional)">
        <PhotoUploader photos={photos} onChange={setPhotos} onBusy={setBusy} />
      </Field>
    </FormDialog>
  );
}