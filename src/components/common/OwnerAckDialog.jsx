import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ACK_METHODS } from '@/lib/shared/ownerSignoff.ts';
import { uploadPhotos } from '@/lib/photoUpload';
import { todayIst } from '@/lib/format';

/**
 * The owner's acknowledgement (Q-08): who accepted the work, when, and how — a photo of
 * the signed sheet, a screenshot of their WhatsApp, or told to the engineer. Returns
 * { name, date, method, evidence_uri } to onSubmit.
 */
export default function OwnerAckDialog({ open, onOpenChange, onSubmit, title = "Record the owner's acknowledgement", description, submitLabel = 'Record and continue', defaultName = '', submitting = false, error = '' }) {
  const [form, setForm] = useState({ name: defaultName, date: todayIst(), method: ACK_METHODS[2], evidence_uri: '', preview: '' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const fileRef = useRef(null);
  const needsEvidence = form.method !== ACK_METHODS[2];

  useEffect(() => {
    if (open) { setForm({ name: defaultName, date: todayIst(), method: ACK_METHODS[2], evidence_uri: '', preview: '' }); setProblem(''); }
  }, [open, defaultName]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setProblem('');
    const { photos, failed } = await uploadPhotos([file]);
    if (failed.length || !photos.length) setProblem('The photo did not upload. Try again.');
    else setForm((f) => ({ ...f, evidence_uri: photos[0].file_uri, preview: photos[0].preview }));
    setBusy(false);
  };

  const submit = () => {
    if (!form.name.trim()) { setProblem("Enter the owner's name."); return; }
    if (needsEvidence && !form.evidence_uri) { setProblem('Attach the photo or screenshot that shows it.'); return; }
    setProblem('');
    onSubmit({ name: form.name.trim(), date: form.date, method: form.method, evidence_uri: form.evidence_uri });
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title} description={description || 'This villa has been handed over, so the owner accepts the work before it is closed.'} onSubmit={submit} submitLabel={submitLabel} submitting={submitting || busy} error={problem || error}>
      <Field label="Owner's name" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
      <Field label="Date accepted" required><Input type="date" max={todayIst()} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
      <Field label="How was it acknowledged?" required><EnumSelect value={form.method} onChange={(v) => setForm((f) => ({ ...f, method: v, evidence_uri: v === ACK_METHODS[2] ? '' : f.evidence_uri }))} options={ACK_METHODS} /></Field>
      {needsEvidence && (
        <Field label="Photo or screenshot" required>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {form.evidence_uri ? 'Replace' : 'Attach'}
            </Button>
            {form.preview && <img src={form.preview} alt="Evidence" className="h-12 w-12 rounded border border-border object-cover" />}
            {form.evidence_uri && !form.preview && <span className="text-xs text-muted-foreground">Attached</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        </Field>
      )}
    </FormDialog>
  );
}
