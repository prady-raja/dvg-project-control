import React from 'react';
import { cn } from '@/lib/utils';

const Stat = ({ label, value, tone }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2.5">
    <p
      className={cn(
        'field-mono text-lg font-semibold tnum',
        tone === 'error' && value > 0 ? 'text-destructive' : tone === 'warn' && value > 0 ? 'text-warning' : '',
      )}
    >
      {value}
    </p>
    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
  </div>
);

export default function ImportSummary({ summary, priorBatches }) {
  if (!summary) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Total rows" value={summary.total} />
        <Stat label="Valid tasks" value={summary.valid} />
        <Stat label="Possible duplicates" value={summary.duplicates} tone="warn" />
        <Stat label="Invalid records" value={summary.invalid} tone="error" />
        <Stat label="Villas needing a choice" value={summary.ambiguous_locations} tone="warn" />
        <Stat label="Unmatched villas" value={summary.unmatched_villas} tone="error" />
        <Stat label="Unmatched contractors" value={summary.unmatched_contractors} tone="error" />
        <Stat label="Missing disciplines" value={summary.missing_disciplines} tone="error" />
        <Stat label="Unknown disciplines" value={summary.unknown_disciplines} tone="error" />
        <Stat label="Without a contractor" value={summary.without_contractor} tone="warn" />
        <Stat label="Rows with a caution" value={summary.warnings} tone="warn" />
        <Stat label="Rows needing attention" value={summary.blocking} tone="error" />
      </div>

      {priorBatches?.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
          <p className="font-medium text-foreground">This file was already imported</p>
          <ul className="mt-1.5 space-y-1 text-muted-foreground">
            {priorBatches.map((batch) => (
              <li key={batch.batch_ref}>
                <span className="field-mono">{batch.batch_ref}</span> · {batch.source_file} · {batch.created_count} created,{' '}
                {batch.skipped_count} skipped · {batch.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}