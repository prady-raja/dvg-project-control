import React from 'react';
import { CheckCircle2, Download, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Pill from '@/components/common/Pill';
import { formatDateTimeIst } from '@/lib/format';

const Stat = ({ label, value, tone }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2.5">
    <p className={`field-mono text-lg font-semibold tnum ${tone && value > 0 ? tone : ''}`}>{value}</p>
    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
  </div>
);

const Tally = ({ title, rows }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    {rows.length === 0 ? (
      <p className="mt-2 text-xs text-muted-foreground">None.</p>
    ) : (
      <ul className="mt-2 space-y-1 text-xs">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="truncate">{row.label}</span>
            <span className="field-mono tnum text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const RowList = ({ title, rows, empty }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    {rows.length === 0 ? (
      <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
    ) : (
      <ul className="mt-2 space-y-2 text-xs">
        {rows.map((row) => (
          <li key={`${row.row_number}-${row.task_ref}`} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="field-mono text-muted-foreground">row {row.row_number}</span>
              {row.task_ref && <span className="field-mono font-medium">{row.task_ref}</span>}
              <span className="truncate">{row.name}</span>
            </p>
            {row.note && <p className="mt-0.5 text-muted-foreground">{row.note}</p>}
            {row.missing?.length > 0 && <p className="mt-0.5 text-warning">Still needed: {row.missing.join(', ')}</p>}
            {row.issues?.length > 0 && <p className="mt-0.5 text-muted-foreground">{row.issues.join('; ')}</p>}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default function ImportResultPanel({ result, projectName, onDownload, onRestart }) {
  if (!result) return null;
  const { counts } = result;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-success" /> Import finished
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Batch <span className="field-mono">{result.batch_ref}</span> · {result.batch?.source_file} ·{' '}
              {formatDateTimeIst(result.batch?.imported_at)} · {projectName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Status: {result.batch?.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={onDownload}>
              <Download className="h-4 w-4" /> Reconciliation report (CSV)
            </Button>
            <Button variant="ghost" className="gap-2" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" /> Start another import
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Rows in file" value={counts.rows} />
          <Stat label="Created tasks" value={counts.created} />
          <Stat label="Skipped" value={counts.skipped} />
          <Stat label="Linked to existing" value={counts.linked} />
          <Stat label="Failed rows" value={counts.failed} tone="text-destructive" />
          <Stat label="Reference corrections" value={(result.created || []).filter((row) => row.note?.includes('re-issued')).length} tone="text-warning" />
        </div>
      </section>

      {result.failed?.length > 0 && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" /> Rows that were not imported
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.failed.map((row) => (
              <li key={row.row_number}>
                row {row.row_number} · {row.name} — {row.note || row.issues.join('; ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tally title="Tasks by villa" rows={result.by_villa || []} />
        <Tally title="Tasks by contractor" rows={result.by_contractor || []} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RowList
          title="Tasks that still need information"
          rows={result.needs_info || []}
          empty="Every imported task has a contractor, baseline dates and progress."
        />
        <RowList
          title="Skipped rows"
          rows={result.skipped || []}
          empty="Nothing was skipped."
        />
      </div>

      <section className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Pill value={result.batch?.status} /> What happens next
        </p>
        <p className="mt-1.5">
          These tasks are on the register now and behave like every other task: daily updates, quick updates, approvals and
          history. The reconciliation report carries the same rows in a spreadsheet, including the row in the file each task
          came from.
        </p>
      </section>
    </div>
  );
}