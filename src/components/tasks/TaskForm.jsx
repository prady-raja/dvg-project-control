import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import TaskFormFields from '@/components/tasks/TaskFormFields';
import TaskAdvancedFields from '@/components/tasks/TaskAdvancedFields';
import { createTask, updateTask } from '@/lib/taskService';
import { formToPayload, taskToForm } from '@/lib/taskModel';
import { validateTask } from '@/lib/taskRules';
import { cn } from '@/lib/utils';

export default function TaskForm({ initial, prefill, cat, user, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({ ...taskToForm(initial), ...(prefill || {}) }));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contractorTouched, setContractorTouched] = useState(!!initial?.contractor_id);

  const update = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);

  const suggestedId = cat.suggestedContractorId(form.project_id, form.phase_id, form.discipline);

  // Keep the default contractor in step with project, phase and discipline until
  // the user overrides it for this task.
  useEffect(() => {
    if (contractorTouched) return;
    setForm((f) => (f.contractor_id === (suggestedId || '') ? f : { ...f, contractor_id: suggestedId || '' }));
  }, [suggestedId, contractorTouched]);

  const onContractorChange = (value) => {
    setContractorTouched(true);
    update({ contractor_id: value });
  };

  const onProjectChange = (projectId) => {
    setContractorTouched(false);
    setForm((f) => ({
      ...f,
      project_id: projectId,
      phase_id: '',
      location_id: '',
      discipline: '',
      work_package: '',
      contractor_id: '',
    }));
  };

  const onPhaseChange = (phaseId) => {
    setContractorTouched(false);
    setForm((f) => ({ ...f, phase_id: phaseId, location_id: '', contractor_id: '' }));
  };

  const onDisciplineChange = (code) => {
    setContractorTouched(false);
    setForm((f) => ({ ...f, discipline: code, work_package: '', contractor_id: '' }));
  };

  const save = async () => {
    const found = validateTask(form, { originalForecast: initial?.current_forecast_finish });
    setErrors(found);
    if (found.length) {
      setDetailsOpen(true);
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const saved = initial ? await updateTask(initial.id, payload, user) : await createTask(payload, user);
      onSaved(saved);
    } catch (error) {
      setErrors([error?.message || 'Could not save the task.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {initial?.baseline_locked && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          This task is covered by an approved baseline. Baseline dates can only be changed by a Project Editor or an
          administrator, or by approving a new baseline version — every other change saves normally.
        </p>
      )}

      <TaskFormFields
        form={form}
        update={update}
        cat={cat}
        suggestedContractorId={suggestedId}
        onContractorChange={onContractorChange}
        onProjectChange={onProjectChange}
        onPhaseChange={onPhaseChange}
        onDisciplineChange={onDisciplineChange}
      />

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            More Details
            <ChevronDown className={cn('h-4 w-4 transition-transform', detailsOpen && 'rotate-180')} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <TaskAdvancedFields form={form} update={update} />
        </CollapsibleContent>
      </Collapsible>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create task'}
        </Button>
      </div>
    </div>
  );
}