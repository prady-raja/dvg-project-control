import DelayCategorySelect from '@/components/common/DelayCategorySelect';
import React from 'react';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ACCESS_STATUSES,
  BASELINE_APPROVAL_STATUSES,
  BLOCKER_CATEGORIES,
  MEASUREMENT_UNITS,
  OWNER_ACCESS_OPTIONS,
  PROCUREMENT_STATUSES,
  SELECTION_STATUSES,
  SUPPLIED_BY_OPTIONS,
} from '@/lib/constants';

const Section = ({ title, children }) => (
  <section className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
    <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children}
  </section>
);

export default function TaskAdvancedFields({ form, update }) {
  const completedExceedsPlanned =
    form.completed_quantity !== '' &&
    form.planned_quantity !== '' &&
    Number(form.completed_quantity) > Number(form.planned_quantity);

  return (
    <div className="space-y-4">
      <Section title="Task details">
        <Field label="Description">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Scope, location within the villa, specification notes"
          />
        </Field>
      </Section>

      <Section title="Progress measurement">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Planned Quantity">
            <Input type="number" min="0" value={form.planned_quantity} onChange={(e) => update({ planned_quantity: e.target.value })} />
          </Field>
          <Field label="Completed Quantity">
            <Input type="number" min="0" value={form.completed_quantity} onChange={(e) => update({ completed_quantity: e.target.value })} />
          </Field>
          <Field label="Measurement Unit">
            <EnumSelect value={form.measurement_unit} onChange={(v) => update({ measurement_unit: v })} options={MEASUREMENT_UNITS} placeholder="Not set" />
          </Field>
          <Field label="Parent Task">
            <Input value={form.parent_task_id} onChange={(e) => update({ parent_task_id: e.target.value })} placeholder="Optional task ID" />
          </Field>
        </div>
        {completedExceedsPlanned && (
          <label className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Checkbox
              checked={!!form.quantity_override}
              onCheckedChange={(v) => update({ quantity_override: !!v })}
              className="mt-0.5"
            />
            <span>
              Completed quantity is above the planned quantity. Tick to confirm an authorised adjustment before saving.
            </span>
          </label>
        )}
      </Section>

      <Section title="Scheduling">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Baseline Start">
            <Input type="date" value={form.baseline_start} onChange={(e) => update({ baseline_start: e.target.value })} />
          </Field>
          <Field label="Baseline Finish">
            <Input type="date" value={form.baseline_finish} onChange={(e) => update({ baseline_finish: e.target.value })} />
          </Field>
          <Field label="Baseline Approval Status">
            <EnumSelect value={form.baseline_approval_status} onChange={(v) => update({ baseline_approval_status: v })} options={BASELINE_APPROVAL_STATUSES} />
          </Field>
          <Field label="Actual Start">
            <Input type="date" value={form.actual_start} onChange={(e) => update({ actual_start: e.target.value })} />
          </Field>
          <Field label="Actual Finish">
            <Input type="date" value={form.actual_finish} onChange={(e) => update({ actual_finish: e.target.value })} />
          </Field>
          <DelayCategorySelect value={form.date_revision_category} onChange={(v) => update({ date_revision_category: v })} required={false} />
          <Field label="Date Revision Reason" hint="Required whenever the forecast finish changes.">
            <Input
              value={form.date_revision_reason}
              onChange={(e) => update({ date_revision_reason: e.target.value })}
              placeholder="e.g. Material delivery slipped"
            />
          </Field>
        </div>
      </Section>

      <Section title="Resources">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Planned Manpower">
            <Input type="number" min="0" value={form.planned_manpower} onChange={(e) => update({ planned_manpower: e.target.value })} />
          </Field>
          <Field label="Actual Manpower">
            <Input type="number" min="0" value={form.actual_manpower} onChange={(e) => update({ actual_manpower: e.target.value })} />
          </Field>
          <Field label="Estimated Man-hours">
            <Input type="number" min="0" value={form.estimated_manhours} onChange={(e) => update({ estimated_manhours: e.target.value })} />
          </Field>
          <Field label="Actual Man-hours">
            <Input type="number" min="0" value={form.actual_manhours} onChange={(e) => update({ actual_manhours: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Supply">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Supplied By">
            <EnumSelect value={form.supplied_by} onChange={(v) => update({ supplied_by: v })} options={SUPPLIED_BY_OPTIONS} placeholder="Not set" />
          </Field>
          <Field label="Selection Status">
            <EnumSelect value={form.selection_status} onChange={(v) => update({ selection_status: v })} options={SELECTION_STATUSES} />
          </Field>
          <Field label="Procurement Status">
            <EnumSelect value={form.procurement_status} onChange={(v) => update({ procurement_status: v })} options={PROCUREMENT_STATUSES} />
          </Field>
          <Field label="Expected Delivery">
            <Input type="date" value={form.expected_delivery_date} onChange={(e) => update({ expected_delivery_date: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Site access">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner Access Required">
            <EnumSelect value={form.owner_access_required} onChange={(v) => update({ owner_access_required: v })} options={OWNER_ACCESS_OPTIONS} />
          </Field>
          <Field label="Access Status">
            <EnumSelect value={form.access_status} onChange={(v) => update({ access_status: v })} options={ACCESS_STATUSES} />
          </Field>
        </div>
      </Section>

      <Section title="Blockers">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Blocker Category">
            <EnumSelect value={form.blocker_category} onChange={(v) => update({ blocker_category: v })} options={BLOCKER_CATEGORIES} placeholder="No blocker" />
          </Field>
          <Field label="Responsible Party">
            <Input
              value={form.blocker_responsible_party}
              onChange={(e) => update({ blocker_responsible_party: e.target.value })}
              placeholder="Who must clear this"
            />
          </Field>
          <Field label="Blocker Description">
            <Textarea rows={2} value={form.blocker_description} onChange={(e) => update({ blocker_description: e.target.value })} />
          </Field>
          <Field label="Blocked Since">
            <Input type="date" value={form.blocked_since} onChange={(e) => update({ blocked_since: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Other">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latest Update">
            <Textarea rows={2} value={form.latest_update} onChange={(e) => update({ latest_update: e.target.value })} placeholder="What changed most recently" />
          </Field>
          <Field label="Attachment Reference" hint="File attachments arrive in a later step.">
            <Input value={form.attachment_ref} onChange={(e) => update({ attachment_ref: e.target.value })} placeholder="Reference only" />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <Checkbox checked={!!form.archived} onCheckedChange={(v) => update({ archived: !!v })} />
          Archive this task (kept on record, hidden from the active register)
        </label>
      </Section>
    </div>
  );
}