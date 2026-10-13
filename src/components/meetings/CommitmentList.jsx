import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import Pill from '@/components/common/Pill';
import { Button } from '@/components/ui/button';
import { formatDate, todayIst } from '@/lib/format';

/** Every promise on record, newest first — nothing is overwritten. */
export default function CommitmentList({ rows = [], canEdit = false, onUpdate, emptyLabel = 'No commitment has been recorded for this filter yet.' }) {
  if (!rows.length) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const overdue = row.status === 'Open' && row.promised_date && row.promised_date < todayIst();
        return (
          <article key={row.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="field-mono text-xs font-semibold">{row.task_ref || 'No task link'}</span>
                <Pill value={row.status} />
                {overdue && (
                  <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                    past the promised date
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Meeting {formatDate(row.meeting_date)} · promised {formatDate(row.promised_date)}
              </span>
            </div>
            <p className="mt-2 text-sm">{row.commitment}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.recorded_by_name || 'Recorded'} · {row.responsible_person || 'responsible person not stated'}
              {row.fulfilled_date ? ` · fulfilled ${formatDate(row.fulfilled_date)}` : ''}
            </p>
            {row.remarks && <p className="mt-1 text-xs text-muted-foreground">{row.remarks}</p>}
            {canEdit && row.status === 'Open' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onUpdate(row, 'Fulfilled')}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark fulfilled
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onUpdate(row, 'Missed')}>
                  <XCircle className="h-3.5 w-3.5" /> Mark missed
                </Button>
              </div>
            )}
            {row.task_id && (
              <Link to={`/tasks/${row.task_id}`} className="mt-2 inline-block text-xs underline">
                Open the task
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}