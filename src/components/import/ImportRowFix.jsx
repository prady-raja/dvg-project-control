import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

/**
 * Corrections for one row. Values are pre-filled from what the server read, and
 * whatever is applied is re-checked by the server before it is trusted.
 */
export default function ImportRowFix({ row, cat, projectId, onApply, onClear, busy }) {
  const [draft, setDraft] = useState(() => ({
    location_id: row.resolved.location_id || '',
    discipline: row.resolved.discipline || '',
    work_package: row.resolved.work_package || '',
    contractor_id: row.resolved.contractor_id || '',
    status: row.resolved.status_value || '',
    priority: row.resolved.priority_value || '',
    name: row.values.name || '',
    baseline_start: row.resolved.baseline_start || '',
    baseline_finish: row.resolved.baseline_finish || '',
    current_forecast_finish: row.resolved.current_forecast_finish || '',
    progress_percent: row.resolved.progress_percent === null ? '' : String(row.resolved.progress_percent),
    estimated_manhours: row.resolved.estimated_manhours === null ? '' : String(row.resolved.estimated_manhours),
    responsible_engineer: row.values.responsible_engineer || '',
    remarks: row.values.remarks || '',
  }));

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const locations = cat.locationsFor(projectId);
  const packages = draft.discipline ? cat.workPackagesFor(projectId, draft.discipline) : [];

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Wand2 className="h-3.5 w-3.5" /> Correct row {row.row_number}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => onClear(row.row_number)} disabled={!!busy}>
            Reset row
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => onApply(row.row_number, draft)} disabled={!!busy}>
            Apply corrections
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Task description" required>
          <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
        </Field>

        <Field label="Villa / location" hint={row.resolved.location_state === 'ambiguous' ? 'The file matched more than one villa' : ''}>
          <EnumSelect
            value={draft.location_id}
            onChange={(value) => set({ location_id: value })}
            options={locations.map((location) => ({
              value: location.id,
              label: `${location.villa_code}${location.location_type === 'Villa' ? '' : ` — ${location.location_type}`}`,
            }))}
            placeholder={row.values.villa_code ? `${row.values.villa_code} (unmatched)` : 'No villa (site-wide)'}
          />
        </Field>

        <Field label="Discipline" required>
          <EnumSelect
            value={draft.discipline}
            onChange={(value) => set({ discipline: value, work_package: '' })}
            options={cat.disciplines.map((discipline) => ({ value: discipline.code, label: discipline.name }))}
            placeholder={row.values.discipline || 'Choose a discipline'}
          />
        </Field>

        <Field label="Work package">
          <EnumSelect
            value={draft.work_package}
            onChange={(value) => set({ work_package: value })}
            options={packages.map((item) => ({ value: item.package_name, label: item.package_name }))}
            placeholder={row.values.work_package || 'Choose a work package'}
            disabled={!draft.discipline}
          />
        </Field>

        <Field label="Contractor">
          <EnumSelect
            value={draft.contractor_id}
            onChange={(value) => set({ contractor_id: value })}
            options={cat.contractors.map((contractor) => ({ value: contractor.id, label: contractor.name }))}
            placeholder={row.values.contractor ? `${row.values.contractor} (unmatched)` : 'Project default'}
          />
        </Field>

        <Field label="Responsible engineer">
          <Input
            value={draft.responsible_engineer}
            onChange={(event) => set({ responsible_engineer: event.target.value })}
          />
        </Field>

        <Field label="Status">
          <EnumSelect
            value={draft.status}
            onChange={(value) => set({ status: value })}
            options={TASK_STATUSES}
            placeholder={row.values.status || 'Not Started'}
          />
        </Field>

        <Field label="Priority">
          <EnumSelect
            value={draft.priority}
            onChange={(value) => set({ priority: value })}
            options={TASK_PRIORITIES}
            placeholder={row.values.priority || 'Medium'}
          />
        </Field>

        <Field label="Progress %">
          <Input
            type="number"
            min="0"
            max="100"
            value={draft.progress_percent}
            onChange={(event) => set({ progress_percent: event.target.value })}
            placeholder="Blank when unknown"
          />
        </Field>

        <Field label="Baseline start">
          <Input type="date" value={draft.baseline_start} onChange={(event) => set({ baseline_start: event.target.value })} />
        </Field>

        <Field label="Baseline finish">
          <Input type="date" value={draft.baseline_finish} onChange={(event) => set({ baseline_finish: event.target.value })} />
        </Field>

        <Field label="Forecast finish">
          <Input
            type="date"
            value={draft.current_forecast_finish}
            onChange={(event) => set({ current_forecast_finish: event.target.value })}
          />
        </Field>

        <Field label="Estimated man-hours">
          <Input
            type="number"
            min="0"
            value={draft.estimated_manhours}
            onChange={(event) => set({ estimated_manhours: event.target.value })}
          />
        </Field>

        <Field label="Remarks" className="sm:col-span-2">
          <Input value={draft.remarks} onChange={(event) => set({ remarks: event.target.value })} />
        </Field>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Corrections are held in this window only. Nothing is written to a task until you confirm the import.
      </p>
    </div>
  );
}