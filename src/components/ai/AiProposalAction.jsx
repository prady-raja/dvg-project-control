import React from 'react';
import { Check } from 'lucide-react';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import Pill from '@/components/common/Pill';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const SEVERITIES = ['Minor', 'Major', 'Critical'];

const ValueRows = ({ heading, rows }) =>
  !rows?.length ? null : (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{heading}</p>
      <dl className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <div key={`${heading}-${row.label}`} className="flex gap-2 text-xs">
            <dt className="w-28 shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 flex-1 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

/** One proposed action: what the assistant understood, and every value a person may change before saving. */
export default function AiProposalAction({
  action, selected, onToggle, draft, onChange, floors = [], areas = [], disciplines = [], contractors = [], busy = false,
}) {
  const review = action.review || {};
  const villaFloors = floors.filter((floor) => floor.location_id === review.villa_id);
  const villaAreas = areas.filter((area) => area.location_id === review.villa_id);
  const shownAreas = draft?.floor_id
    ? villaAreas.filter((area) => area.floor_id === draft.floor_id || !area.floor_id)
    : villaAreas;

  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <div className={cn('rounded-lg border p-3', selected ? 'border-primary/40 bg-primary/[0.03]' : 'border-border bg-muted/20')}>
      <div className="flex items-start gap-2.5">
        <Checkbox className="mt-0.5" checked={selected} disabled={busy} onCheckedChange={(value) => onToggle(value === true)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{action.summary}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wide">{review.villa}</span>
            {!!review.scope_label && <span>· {review.scope_label}</span>}
            {!!review.scope_type && <span>· {review.scope_type}</span>}
            {!!review.task_ref && (
              <span>· task <span className="field-mono">{review.task_ref}</span></span>
            )}
            {review.is_new && <span>· new record</span>}
            {!!review.readiness && <Pill value={review.readiness} />}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ValueRows heading="Currently recorded" rows={review.previous} />
        <ValueRows heading="Proposed" rows={review.proposed} />
      </div>

      {!!review.dates?.length && (
        <div className="mt-2">
          <ValueRows
            heading="Dates"
            rows={review.dates.map((row) => ({ label: row.label, value: `${row.value}${row.reason ? ` — ${row.reason}` : ''}` }))}
          />
        </div>
      )}

      {!!review.note && <p className="mt-2 text-[11px] text-muted-foreground">{review.note}</p>}

      {action.type === 'record_progress' && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <Field label="Status" hint="Leave blank to keep the status the message suggested.">
            <EnumSelect
              value={draft.status || ''}
              onChange={(value) => set({ status: value })}
              options={[{ value: '', label: 'Leave unchanged' }, ...['Not Started', 'In Progress', 'Blocked', 'Execution Complete', 'Under Inspection', 'Approved'].map((s) => ({ value: s, label: s }))]}
            />
          </Field>
          <Field label="Progress %" hint="Leave blank when progress was not measured.">
            <Input
              type="number"
              min="0"
              max="100"
              value={draft.progress_percent ?? ''}
              onChange={(e) => set({ progress_percent: e.target.value })}
            />
          </Field>
          <Field label="Manpower today">
            <Input type="number" min="0" value={draft.manpower ?? ''} onChange={(e) => set({ manpower: e.target.value })} />
          </Field>
          <Field label="Forecast finish">
            <Input type="date" value={draft.forecast ?? ''} onChange={(e) => set({ forecast: e.target.value })} />
          </Field>
          <Field label="Forecast change reason" hint="Required whenever the forecast date moves.">
            <Input value={draft.reason ?? ''} onChange={(e) => set({ reason: e.target.value })} />
          </Field>
          <Field label="Blocker category">
            <EnumSelect
              value={draft.blocker_category ?? ''}
              onChange={(value) => set({ blocker_category: value })}
              options={[
                { value: '', label: 'No blocker' },
                ...['Previous Work Incomplete', 'Materials Pending', 'Client Selection Pending', 'Owner Access Pending', 'Drawing / Design Clarification', 'Contractor Manpower', 'DVG Approval', 'External Utility / Authority', 'Other'].map((c) => ({ value: c, label: c })),
              ]}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Work done">
              <Textarea rows={2} value={draft.work_done ?? ''} onChange={(e) => set({ work_done: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {action.type === 'create_task' && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Task" required>
              <Input value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
            </Field>
          </div>
          <Field label="Discipline" required>
            <EnumSelect
              value={draft.discipline ?? ''}
              onChange={(value) => set({ discipline: value })}
              options={disciplines.map((d) => ({ value: d.code, label: d.name }))}
            />
          </Field>
          <Field label="Contractor">
            <EnumSelect
              value={draft.contractor_id ?? ''}
              onChange={(value) => set({ contractor_id: value })}
              options={[{ value: '', label: 'Unassigned' }, ...contractors.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          <Field label="Priority">
            <EnumSelect value={draft.priority ?? 'Medium'} onChange={(value) => set({ priority: value })} options={PRIORITIES} />
          </Field>
          <Field label="Work package">
            <Input value={draft.work_package ?? ''} onChange={(e) => set({ work_package: e.target.value })} />
          </Field>
          <Field label="Floor" hint="Registered floors of this villa only.">
            <EnumSelect
              value={draft.floor_id ?? ''}
              onChange={(value) => set({ floor_id: value, area_ids: [] })}
              options={[{ value: '', label: 'Whole villa' }, ...villaFloors.map((f) => ({ value: f.id, label: f.floor_name }))]}
            />
          </Field>
          <Field label="Forecast finish">
            <Input type="date" value={draft.forecast ?? ''} onChange={(e) => set({ forecast: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Rooms/areas" hint="Tick every room this one task covers — several rooms stay one task.">
              {shownAreas.length ? (
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                  {shownAreas.map((area) => {
                    const checked = (draft.area_ids || []).includes(area.id);
                    return (
                      <label key={area.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            set({
                              area_ids: value === true
                                ? [...(draft.area_ids || []), area.id]
                                : (draft.area_ids || []).filter((id) => id !== area.id),
                            })
                          }
                        />
                        <span className="min-w-0 truncate">{area.area_name}</span>
                        {!!area.floor_id && (
                          <span className="text-[11px] text-muted-foreground">
                            {villaFloors.find((f) => f.id === area.floor_id)?.floor_name || ''}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  No rooms are registered for {review.villa} yet — add them on the villa page, or leave the task at villa level.
                </p>
              )}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Remarks">
              <Textarea rows={2} value={draft.remarks ?? ''} onChange={(e) => set({ remarks: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {action.type === 'raise_snag' && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Snag" required>
              <Input value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
            </Field>
          </div>
          <Field label="Severity">
            <EnumSelect value={draft.severity ?? 'Minor'} onChange={(value) => set({ severity: value })} options={SEVERITIES} />
          </Field>
          <Field label="Target date">
            <Input type="date" value={draft.target_date ?? ''} onChange={(e) => set({ target_date: e.target.value })} />
          </Field>
          <Field label="Contractor responsible">
            <EnumSelect
              value={draft.contractor_id ?? ''}
              onChange={(value) => set({ contractor_id: value })}
              options={[{ value: '', label: 'Unassigned' }, ...contractors.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          <label className="flex items-center gap-2 self-end text-sm">
            <Checkbox checked={!!draft.handover_blocker} onCheckedChange={(value) => set({ handover_blocker: value === true })} />
            Must be closed before handover
          </label>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea rows={2} value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {action.type === 'link_dependency' && (
        <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> The link is recorded exactly as shown — change the wording of the message to record a different one.
        </p>
      )}
    </div>
  );
}