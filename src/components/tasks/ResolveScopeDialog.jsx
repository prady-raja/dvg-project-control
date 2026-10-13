import React, { useEffect, useState } from 'react';
import FormDialog from '@/components/common/FormDialog';
import VillaScopePicker, { forgetVillaScope } from '@/components/villa/VillaScopePicker';
import { updateTask } from '@/lib/taskService';

/** Say where in the villa a task is, for work that arrived without a floor or room. */
export default function ResolveScopeDialog({ task, open, onOpenChange, onSaved }) {
  const [scope, setScope] = useState({ floor_id: '', area_ids: [] });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setScope({ floor_id: task.floor_id || '', area_ids: task.area_ids || [] });
    setError('');
    forgetVillaScope(task.location_id);
  }, [open, task]);

  const save = async () => {
    if (!scope.floor_id && !scope.area_ids.length) {
      setError('Choose a floor or at least one room, or close this and leave the work at villa level.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateTask(task.id, { floor_id: scope.floor_id || null, area_ids: scope.area_ids });
      await onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || 'The scope could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Where in the villa?"
      description={task ? `${task.task_ref} · ${task.name}` : ''}
      onSubmit={save}
      submitting={saving}
      submitLabel="Save scope"
      error={error}
    >
      {task && (
        <div className="grid gap-4">
          <VillaScopePicker
            locationId={task.location_id}
            floorId={scope.floor_id}
            areaIds={scope.area_ids}
            onChange={(patch) => setScope((s) => ({ ...s, ...patch }))}
          />
        </div>
      )}
    </FormDialog>
  );
}
