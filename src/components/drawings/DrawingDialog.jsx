import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const DRAWING_TYPES = ['Floor Plan', 'Furniture Layout', 'Electrical Layout', 'Plumbing Layout', 'Elevation', 'Section', 'Site Plan', 'Detail', 'Other'];

/**
 * Files a drawing against the villa. The file is uploaded to private storage —
 * the register keeps the private reference only, and a new revision supersedes
 * the previous one instead of overwriting it.
 */
export default function DrawingDialog({ open, onOpenChange, floors = [], onSubmit, submitting, error }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [values, setValues] = useState({
    title: '',
    drawing_type: 'Floor Plan',
    floor_id: '',
    revision: '',
    revision_date: '',
    notes: '',
  });

  const set = (patch) => setValues((current) => ({ ...current, ...patch }));

  const submit = async () => {
    if (!String(values.title || '').trim()) {
      setLocalError('Give the drawing its title, e.g. First Floor Plan.');
      return;
    }
    if (!file) {
      setLocalError('Choose the drawing file to upload.');
      return;
    }
    setLocalError('');
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      onSubmit({
        title: values.title.trim(),
        drawing_type: values.drawing_type,
        floor_id: values.floor_id || null,
        revision: String(values.revision || '').trim() || null,
        revision_date: values.revision_date || null,
        uploaded_date: new Date().toISOString().slice(0, 10),
        notes: String(values.notes || '').trim() || null,
        file_uri,
        file_name: file.name,
      });
    } catch (e) {
      setLocalError(e?.message || 'The file could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFile(null);
          setLocalError('');
          setValues({ title: '', drawing_type: 'Floor Plan', floor_id: '', revision: '', revision_date: '', notes: '' });
        }
        onOpenChange(next);
      }}
      title="File a drawing"
      description="The file is stored privately; a newer revision of the same drawing supersedes this one and stays on the register."
      onSubmit={submit}
      submitting={submitting || uploading}
      submitLabel="File drawing"
      error={localError || error}
      size="sm:max-w-xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Drawing file" required hint="PDF or image of the drawing as issued.">
            <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Title" required hint="The same title across revisions keeps them on one drawing.">
            <Input value={values.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
        </div>
        <Field label="Type">
          <EnumSelect value={values.drawing_type} onChange={(value) => set({ drawing_type: value })} options={DRAWING_TYPES} />
        </Field>
        <Field label="Floor">
          <EnumSelect
            value={values.floor_id}
            onChange={(value) => set({ floor_id: value })}
            options={[{ value: '', label: 'Whole villa' }, ...floors.map((floor) => ({ value: floor.id, label: floor.floor_name }))]}
          />
        </Field>
        <Field label="Revision" hint="As written on the drawing, e.g. R0, Rev B.">
          <Input value={values.revision} onChange={(e) => set({ revision: e.target.value })} />
        </Field>
        <Field label="Revision date">
          <Input type="date" value={values.revision_date} onChange={(e) => set({ revision_date: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </FormDialog>
  );
}