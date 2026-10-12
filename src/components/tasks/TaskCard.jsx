import { useQuickActions } from '@/components/layout/QuickActions';
import React from 'react';
import { CalendarClock, MapPin, Zap } from 'lucide-react';
import Pill from '@/components/common/Pill';
import ProgressMeter from '@/components/tasks/ProgressMeter';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';

export default function TaskCard({ task, cat, onOpen }) {
  const quick = useQuickActions();
  const location = cat.locationById(task.location_id);
  const phase = cat.phaseById(task.phase_id);
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors">
      <button type="button" onClick={() => onOpen(task)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="field-mono truncate text-[11px] font-medium text-muted-foreground">{task.task_ref}</p>
            <p className="mt-1 line-clamp-2 font-display text-sm font-semibold text-foreground">{task.name}</p>
          </div>
          <Pill value={task.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {location?.villa_code || '—'}
            {phase ? ` · ${phase.code || phase.name}` : ''}
          </span>
          <span>{cat.disciplineName(task.discipline)}</span>
          {task.work_package && <span className="truncate">{task.work_package}</span>}
        </div>
        {location?.location_type === 'Villa' && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {task.area_label || (task.scope_type === 'Entire Villa' ? 'Entire villa' : 'Scope not stated')}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <ProgressMeter value={task.progress_percent} />
          <span className="field-mono inline-flex items-center gap-1 text-xs text-foreground">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            {formatDate(task.current_forecast_finish)}
          </span>
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {cat.contractorById(task.contractor_id)?.name || 'No contractor'} ·{' '}
          {task.responsible_engineer || 'No engineer'}
        </p>
      </button>
      {quick.canReport && !['Approved', 'Closed', 'Under Inspection'].includes(task.status) && !task.is_villa_work_parent && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => quick.openLogUpdate({ taskId: task.id })}
          className="mt-3 w-full gap-2"
        >
          <Zap className="h-3.5 w-3.5" /> Log update
        </Button>
      )}
    </div>
  );
}