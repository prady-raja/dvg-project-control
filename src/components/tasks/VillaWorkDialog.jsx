import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAccess } from '@/lib/AccessContext';
import { createVillaWork } from '@/lib/taskService';
import { WORK_PACKAGE_REQUIRED_DISCIPLINES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const SCOPES = [
  { value: 'one', label: 'One Villa' },
  { value: 'selected', label: 'Selected Villas' },
  { value: 'all', label: 'All Active Villas' },
];

const empty = {
  project_id: '',
  name: '',
  discipline: '',
  work_package: '',
  contractor_id: '',
  priority: 'Medium',
  baseline_start: '',
  baseline_finish: '',
  current_forecast_finish: '',
  responsible_engineer: '',
  description: '',
};

/**
 * One Villa Work activity across one, several or all active villas of a phase.
 * Every villa gets its own independently editable task; on-hold villas are left
 * out unless a Project Manager explicitly includes them.
 */
export default function VillaWorkDialog({ open, onOpenChange, cat, projectId, phaseId, onCreated }) {
  const navigate = useNavigate();
  const access = useAccess();
  const [form, setForm] = useState(empty);
  const [phase, setPhase] = useState('');
  const [scope, setScope] = useState('all');
  const [selected, setSelected] = useState([]);
  const [singleVilla, setSingleVilla] = useState('');
  const [includeOnHold, setIncludeOnHold] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const projects = access.appAdmin ? cat.projects : cat.projects.filter((p) => access.rankFor(p.id) >= 0);
  const canIncludeOnHold = access.can(form.project_id, 'manage_project');

  useEffect(() => {
    if (!open) return;
    // Default to a project that can actually hold villa work.
    const withPhases = projects.find((p) => cat.phasesFor(p.id).length > 0);
    const startProject = projectId || withPhases?.id || projects[0]?.id || '';
    const startPhase = phaseId || cat.phasesFor(startProject)[0]?.id || '';
    setForm({ ...empty, project_id: startProject });
    setPhase(startPhase);
    setScope('all');
    setSelected([]);
    setSingleVilla('');
    setIncludeOnHold(false);
    setKey(crypto.randomUUID());
    setError('');
    setNotice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, phaseId]);

  // Keep a valid phase selected for the chosen project: an empty or stale phase
  // never blocks the dialog on a project that does have phases.
  useEffect(() => {
    if (!open) return;
    const options = cat.phasesFor(form.project_id);
    if (!options.some((p) => p.id === phase)) setPhase(options[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.project_id, phase]);

  const phases = cat.phasesFor(form.project_id);
  const villas = useMemo(
    () => (phase ? cat.locationsFor(form.project_id, phase).filter((l) => l.location_type === 'Villa') : []),
    [cat, form.project_id, phase],
  );
  const activeVillas = villas.filter((v) => v.active_status !== 'On Hold');
  const onHoldVillas = villas.filter((v) => v.active_status === 'On Hold');

  const targets =
    scope === 'one'
      ? villas.filter((v) => v.id === singleVilla)
      : scope === 'selected'
        ? villas.filter((v) => selected.includes(v.id) && (v.active_status !== 'On Hold' || includeOnHold))
        : activeVillas.concat(includeOnHold ? onHoldVillas : []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim()) return setError('Give the work a name, for example “External painting”.');
    if (!form.project_id) return setError('Select a project.');
    if (!phase) return setError('Select a phase — villa work is created for one phase at a time.');
    if (!form.discipline) return setError('A discipline is required.');
    if (WORK_PACKAGE_REQUIRED_DISCIPLINES.includes(form.discipline) && !form.work_package) {
      return setError(`${form.discipline} tasks require a work package.`);
    }
    if (!targets.length) return setError('No villas match that selection.');

    setSaving(true);
    setError('');
    try {
      const result = await createVillaWork({
        project_id: form.project_id,
        phase_id: phase,
        scope,
        location_ids: scope === 'one' ? [singleVilla] : selected,
        include_on_hold: includeOnHold,
        idempotency_key: key,
        work: {
          name: form.name,
          discipline: form.discipline,
          work_package: form.work_package,
          contractor_id: form.contractor_id,
          priority: form.priority,
          baseline_start: form.baseline_start,
          baseline_finish: form.baseline_finish,
          current_forecast_finish: form.current_forecast_finish,
          responsible_engineer: form.responsible_engineer,
          description: form.description,
        },
      });
      setNotice(
        `${result.reused ? 'This activity already existed' : 'Created'} — ${
          result.children?.length || 0
        } villa task(s)${
          result.skipped_on_hold?.length
            ? `, ${result.skipped_on_hold.length} on-hold villa(s) left out (${result.skipped_on_hold.join(', ')})`
            : ''
        }.`,
      );
      onCreated?.(result.parent);
      if (result.parent) navigate(`/tasks/${result.parent.id}`);
    } catch (e) {
      setError(e?.message || 'Could not create the villa work.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Villa Work"
      description="One activity, one task per villa. Each villa task can be updated on its own."
      onSubmit={save}
      submitting={saving}
      error={error}
      size="sm:max-w-3xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project" required>
          <EnumSelect
            value={form.project_id}
            onChange={(v) => {
              set({ project_id: v, discipline: '', work_package: '', contractor_id: '' });
              setPhase(cat.phasesFor(v)[0]?.id || '');
              setSelected([]);
              setSingleVilla('');
            }}
            options={projects.map((p) => ({ value: p.id, label: `${p.code ? `${p.code} — ` : ''}${p.name}` }))}
          />
        </Field>
        <Field label="Phase" required>
          <EnumSelect
            value={phase}
            onChange={(v) => {
              setPhase(v);
              setSelected([]);
              setSingleVilla('');
            }}
            options={phases.map((p) => ({ value: p.id, label: `${p.code ? `${p.code} — ` : ''}${p.name}` }))}
            placeholder="Select a phase"
          />
        </Field>
      </div>

      <Field label="Work name" required>
        <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. External painting" />
      </Field>

      <Field label="Apply to">
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={scope === option.value ? 'default' : 'outline'}
              onClick={() => setScope(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Field>

      {scope === 'one' && (
        <Field label="Villa" required>
          <EnumSelect
            value={singleVilla}
            onChange={setSingleVilla}
            options={villas.map((v) => ({
              value: v.id,
              label: `${v.villa_code}${v.active_status === 'On Hold' ? ' (on hold)' : ''}`,
            }))}
            placeholder="Select a villa"
          />
        </Field>
      )}

      {scope === 'selected' && (
        <Field label="Villas" hint={`${selected.length} selected of ${villas.length} in this phase.`}>
          <div className="scroll-slim grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-3">
            {villas.map((v) => (
              <label key={v.id} className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox
                  checked={selected.includes(v.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) => (checked ? [...current, v.id] : current.filter((id) => id !== v.id)))
                  }
                />
                <span className={cn('truncate', v.active_status === 'On Hold' && 'text-muted-foreground')}>
                  {v.villa_code}
                  {v.active_status === 'On Hold' ? ' · on hold' : ''}
                </span>
              </label>
            ))}
            {villas.length === 0 && <p className="text-xs text-muted-foreground">No villas in this phase.</p>}
          </div>
        </Field>
      )}

      {scope !== 'one' && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            {villas.length === 0
              ? 'This phase has no villas yet, so there is nothing to create.'
              : scope === 'all'
                ? `${activeVillas.length} active villa(s) in this phase will each get a task.`
                : `${targets.length} villa task(s) will be created.`}
            {onHoldVillas.length > 0 && !includeOnHold
              ? ` ${onHoldVillas.length} on-hold villa(s) (${onHoldVillas
                  .map((v) => v.villa_code)
                  .join(', ')}) excluded${canIncludeOnHold ? '.' : ' — only a Project Manager can include them.'}`
              : ''}
          </p>
          {canIncludeOnHold && onHoldVillas.length > 0 && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={includeOnHold} onCheckedChange={(v) => setIncludeOnHold(!!v)} />
              Include the on-hold villas as well
            </label>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Discipline" required>
          <EnumSelect
            value={form.discipline}
            onChange={(v) => set({ discipline: v, work_package: '' })}
            options={cat
              .enabledDisciplines(cat.projectById(form.project_id))
              .map((d) => ({ value: d.code, label: d.name }))}
          />
        </Field>
        <Field label="Work package">
          <EnumSelect
            value={form.work_package}
            onChange={(v) => set({ work_package: v })}
            options={cat
              .workPackagesFor(form.project_id, form.discipline)
              .map((w) => ({ value: w.package_name, label: w.package_name }))}
            placeholder="Not set"
            disabled={!form.discipline}
          />
        </Field>
        <Field label="Contractor">
          <EnumSelect
            value={form.contractor_id}
            onChange={(v) => set({ contractor_id: v })}
            options={cat.contractors.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Unassigned"
          />
        </Field>
        <Field label="Priority">
          <EnumSelect
            value={form.priority}
            onChange={(v) => set({ priority: v })}
            options={['Low', 'Medium', 'High', 'Critical']}
          />
        </Field>
        <Field label="Baseline start">
          <Input type="date" value={form.baseline_start} onChange={(e) => set({ baseline_start: e.target.value })} />
        </Field>
        <Field label="Baseline finish">
          <Input type="date" value={form.baseline_finish} onChange={(e) => set({ baseline_finish: e.target.value })} />
        </Field>
      </div>

      <Field label="Responsible site engineer">
        <Input value={form.responsible_engineer} onChange={(e) => set({ responsible_engineer: e.target.value })} />
      </Field>
      <Field label="Description" hint="Shared by every villa task; each can be edited afterwards.">
        <Textarea
          rows={2}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Scope notes"
        />
      </Field>

      {notice && <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs">{notice}</p>}
    </FormDialog>
  );
}