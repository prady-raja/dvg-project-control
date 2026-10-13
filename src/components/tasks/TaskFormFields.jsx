import React from 'react';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import UserPicker from '@/components/common/UserPicker';
import VillaScopePicker from '@/components/villa/VillaScopePicker';
import { TASK_PRIORITIES, TASK_STATUSES, WORK_PACKAGE_REQUIRED_DISCIPLINES } from '@/lib/constants';

export default function TaskFormFields({
  form,
  update,
  cat,
  suggestedContractorId,
  onContractorChange,
  onProjectChange,
  onPhaseChange,
  onDisciplineChange,
}) {
  const project = cat.projectById(form.project_id);
  const phases = form.project_id ? cat.phasesFor(form.project_id) : [];
  const isCommonProject = project && cat.villasFor(form.project_id).length === 0;

  const locations = cat.locations
    .filter((l) => !form.project_id || l.project_id === form.project_id)
    .filter((l) => !form.phase_id || l.phase_id === form.phase_id || l.location_type !== 'Villa')
    .map((l) => ({ value: l.id, label: `${l.villa_code}${l.location_type !== 'Villa' ? ` · ${l.location_type}` : ''}` }));

  const disciplines = cat.enabledDisciplines(project).map((d) => ({ value: d.code, label: d.name }));
  const workPackages = cat.workPackagesFor(form.project_id, form.discipline).map((w) => ({
    value: w.package_name,
    label: w.package_name,
  }));
  const contractors = cat.contractors
    .filter((c) => c.active !== false)
    .map((c) => ({ value: c.id, label: c.name }));

  const workPackageRequired = WORK_PACKAGE_REQUIRED_DISCIPLINES.includes(form.discipline);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Project" required>
          <EnumSelect value={form.project_id} onChange={onProjectChange} options={cat.projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Select project" />
        </Field>
        <Field label="Phase">
          <EnumSelect
            value={form.phase_id}
            onChange={onPhaseChange}
            options={phases.map((p) => ({ value: p.id, label: `${p.code ? `${p.code} — ` : ''}${p.name}` }))}
            placeholder={phases.length ? 'Select phase' : 'No phases'}
            disabled={!phases.length}
          />
        </Field>
        <Field label="Villa / Location" hint={isCommonProject ? 'Choose project, phase or common-work level.' : undefined}>
          <EnumSelect value={form.location_id} onChange={(v) => update({ location_id: v, floor_id: '', area_ids: [] })} options={locations} placeholder="Select villa or location" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Discipline" required>
          <EnumSelect value={form.discipline} onChange={onDisciplineChange} options={disciplines} placeholder="Select discipline" />
        </Field>
        <Field
          label="Work Package"
          required={workPackageRequired}
          hint={workPackageRequired && !form.work_package ? 'Mandatory for Finishes tasks.' : undefined}
        >
          <EnumSelect
            value={form.work_package}
            onChange={(v) => update({ work_package: v })}
            options={workPackages}
            placeholder={form.discipline ? 'Select work package' : 'Select a discipline first'}
            disabled={!form.discipline}
          />
        </Field>
      </div>

      <Field label="Task Name" required>
        <Input
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Second coat plaster — living and dining"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Assigned Contractor"
          hint={
            suggestedContractorId && form.contractor_id === suggestedContractorId
              ? 'Suggested automatically from the project defaults — you can override it.'
              : 'Override the contractor for this task if needed.'
          }
        >
          <EnumSelect value={form.contractor_id} onChange={onContractorChange} options={contractors} placeholder="Select contractor" />
        </Field>
        <Field
          label="Assigned to"
          hint={form.responsible_engineer && !form.assignee_user_id ? `Recorded earlier as “${form.responsible_engineer}” — choose the person to link it.` : undefined}
        >
          <UserPicker
            projectId={form.project_id}
            value={form.assignee_user_id}
            onChange={(userId) => update({ assignee_user_id: userId, ...(userId ? { responsible_engineer: '' } : {}) })}
            placeholder="Unassigned"
          />
        </Field>
      </div>

      {form.location_id && cat.locationById(form.location_id)?.location_type === 'Villa' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <VillaScopePicker
            key={form.location_id}
            locationId={form.location_id}
            villaLabel={cat.locationById(form.location_id)?.villa_code}
            floorId={form.floor_id}
            areaIds={form.area_ids}
            onChange={(patch) => update(patch)}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status">
          <EnumSelect value={form.status} onChange={(v) => update({ status: v })} options={TASK_STATUSES} />
        </Field>
        <Field label="Priority">
          <EnumSelect value={form.priority} onChange={(v) => update({ priority: v })} options={TASK_PRIORITIES} />
        </Field>
        <Field label="Progress %" hint="Leave blank when progress is unknown.">
          <Input
            type="number"
            min="0"
            max="100"
            inputMode="numeric"
            value={form.progress_percent}
            onChange={(e) => update({ progress_percent: e.target.value })}
            placeholder="Not measured"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current Forecast Finish">
          <Input
            type="date"
            value={form.current_forecast_finish}
            onChange={(e) => update({ current_forecast_finish: e.target.value })}
          />
        </Field>
        <Field label="Remarks">
          <Textarea
            rows={2}
            value={form.remarks}
            onChange={(e) => update({ remarks: e.target.value })}
            placeholder="Anything the site team should know"
          />
        </Field>
      </div>
    </div>
  );
}