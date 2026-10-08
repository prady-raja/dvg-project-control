import React from 'react';
import { Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Completion is shown only when it is real: every outstanding task in the set
 * must carry measured progress. Otherwise the screen shows status counts and
 * says why, rather than publishing an average of unrelated percentages.
 */
export default function ProgressNote({ progress, counts, label = 'Measured completion', className }) {
  const reliable = progress?.reliable;
  return (
    <div className={cn('rounded-xl border border-border bg-card px-4 py-3', className)}>
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      {reliable ? (
        <>
          <p className="field-mono mt-1 text-2xl font-semibold tnum">{progress.percent}%</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
            Weighted by {progress.basis?.toLowerCase() || 'estimated man-hours'} · {progress.measured} of {progress.total} outstanding tasks measured
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 font-display text-base font-semibold text-muted-foreground">
            {progress?.total ? 'Insufficient data' : 'Not yet measured'}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
            {progress?.reason || 'No measured progress has been recorded for this scope.'}
          </p>
        </>
      )}
      {counts && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded border border-border px-1.5 py-0.5">{counts.open} open</span>
          <span className="rounded border border-border px-1.5 py-0.5">{counts.overdue} overdue</span>
          <span className="rounded border border-border px-1.5 py-0.5">{counts.blocked} blocked</span>
          <span className="rounded border border-border px-1.5 py-0.5">{counts.awaitingVerification} awaiting verification</span>
        </div>
      )}
    </div>
  );
}