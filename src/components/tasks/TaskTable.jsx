import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Pill from '@/components/common/Pill';
import ProgressMeter from '@/components/tasks/ProgressMeter';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const th = 'whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export default function TaskTable({ tasks, cat, onOpen }) {
  return (
    <div className="scroll-slim hidden overflow-x-auto md:block">
      <Table className="min-w-[1180px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={th}>Task Ref</TableHead>
            <TableHead className={th}>Villa / Location</TableHead>
            <TableHead className={th}>Discipline</TableHead>
            <TableHead className={th}>Work Package</TableHead>
            <TableHead className={cn(th, 'min-w-[220px]')}>Task Name</TableHead>
            <TableHead className={th}>Contractor</TableHead>
            <TableHead className={th}>Engineer</TableHead>
            <TableHead className={th}>Status</TableHead>
            <TableHead className={th}>Progress</TableHead>
            <TableHead className={th}>Baseline Finish</TableHead>
            <TableHead className={th}>Forecast Finish</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const location = cat.locationById(task.location_id);
            return (
              <TableRow
                key={task.id}
                onClick={() => onOpen(task)}
                className="cursor-pointer align-middle transition-colors hover:bg-accent/60"
              >
                <TableCell className="field-mono whitespace-nowrap text-xs font-medium text-foreground">
                  {task.task_ref}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {location?.villa_code || <span className="text-muted-foreground">—</span>}
                  {location?.location_type === 'Villa' && (
                    <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {task.area_label || (task.scope_type === 'Entire Villa' ? 'Entire villa' : 'Scope not stated')}
                    </div>
                  )}
                  {task.is_demo && (
                    <span className="ml-2 rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                      demo
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {cat.disciplineName(task.discipline)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {task.work_package || '—'}
                </TableCell>
                <TableCell className="text-sm font-medium text-foreground">
                  <span className="line-clamp-2 max-w-[280px]">{task.name}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {cat.contractorById(task.contractor_id)?.name || '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {task.responsible_engineer || '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Pill value={task.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <ProgressMeter value={task.progress_percent} />
                </TableCell>
                <TableCell className="field-mono whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(task.baseline_finish)}
                </TableCell>
                <TableCell className="field-mono whitespace-nowrap text-xs text-foreground">
                  {formatDate(task.current_forecast_finish)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}