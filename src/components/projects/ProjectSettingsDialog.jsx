import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { updateRecord } from '@/lib/recordService';
import { projectSettings, settingsProblems } from '@shared/calendar.ts';

const WEEKDAYS = [
  [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun'],
];

const formFor = (project) => {
  const s = projectSettings(project);
  return {
    working_days: s.working_days,
    holidays: s.holidays.join('\n'),
    stale_days: String(s.stale_days),
    at_risk_window_days: String(s.at_risk_window_days),
    backdate_limit_days: String(s.backdate_limit_days),
    report_cutoff_time: s.report_cutoff_time,
    site_lat: s.site_lat ?? '',
    site_lng: s.site_lng ?? '',
  };
};

/** S-01: the working week, holidays and thresholds every stale, at-risk and overdue rule reads. */
export default function ProjectSettingsDialog({ open, onOpenChange, project, onSaved }) {
  const [form, setForm] = useState(formFor(project));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(formFor(project));
    setError('');
  }, [open, project]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleDay = (day) =>
    set({ working_days: form.working_days.includes(day) ? form.working_days.filter((d) => d !== day) : [...form.working_days, day].sort() });

  const save = async () => {
    const payload = {
      working_days: form.working_days,
      holidays: form.holidays.split(/[\s,]+/).filter(Boolean),
      stale_days: Number(form.stale_days),
      at_risk_window_days: Number(form.at_risk_window_days),
      backdate_limit_days: Number(form.backdate_limit_days),
      report_cutoff_time: form.report_cutoff_time,
      site_lat: form.site_lat === '' ? null : Number(form.site_lat),
      site_lng: form.site_lng === '' ? null : Number(form.site_lng),
    };
    const problems = settingsProblems(payload);
    if (problems.length) {
      setError(problems.join(' '));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateRecord('Project', project.id, payload);
      await onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'The settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Project settings"
      description="The working calendar and thresholds. Stale, at-risk and overdue are all counted in working days, so a Sunday or a festival never makes work look neglected."
      onSubmit={save}
      submitting={saving}
      submitLabel="Save settings"
      error={error}
    >
      <Field label="Working days">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map(([day, label]) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.working_days.includes(day) ? 'border-primary bg-secondary' : 'border-border text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Holidays and site closures" hint="One date per line, as YYYY-MM-DD.">
        <Textarea rows={3} value={form.holidays} onChange={(e) => set({ holidays: e.target.value })} placeholder="2026-11-08" />
      </Field>
      <Field label="Stale after (working days)" hint="No site report for longer than this makes work stale.">
        <Input type="number" min={1} value={form.stale_days} onChange={(e) => set({ stale_days: e.target.value })} />
      </Field>
      <Field label="At-risk window (working days)" hint="Unfinished work due within this window is checked for risk.">
        <Input type="number" min={0} value={form.at_risk_window_days} onChange={(e) => set({ at_risk_window_days: e.target.value })} />
      </Field>
      <Field label="Report backdating limit (days)">
        <Input type="number" min={0} value={form.backdate_limit_days} onChange={(e) => set({ backdate_limit_days: e.target.value })} />
      </Field>
      <Field label="Daily report cut-off (IST)">
        <Input type="time" value={form.report_cutoff_time} onChange={(e) => set({ report_cutoff_time: e.target.value })} />
      </Field>
      <Field label="Site latitude">
        <Input type="number" step="any" value={form.site_lat} onChange={(e) => set({ site_lat: e.target.value })} />
      </Field>
      <Field label="Site longitude">
        <Input type="number" step="any" value={form.site_lng} onChange={(e) => set({ site_lng: e.target.value })} />
      </Field>
    </FormDialog>
  );
}
