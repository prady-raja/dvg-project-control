import React from 'react';
import { AlertTriangle, Brain, Download, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TILES = [
  { key: 'create', label: 'CREATE NEW', tone: 'text-emerald-600' },
  { key: 'update', label: 'UPDATE EXISTING', tone: 'text-amber-600' },
  { key: 'unchanged', label: 'UNCHANGED', tone: 'text-muted-foreground' },
  { key: 'duplicate', label: 'POSSIBLE DUPLICATE', tone: 'text-amber-600' },
  { key: 'clarify', label: 'CLARIFICATION REQUIRED', tone: 'text-destructive' },
];

const Stat = ({ label, value, tone }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2.5">
    <p className={cn('field-mono text-lg font-semibold tnum', value > 0 ? tone : '')}>{value}</p>
    <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{label}</p>
  </div>
);

/**
 * What the uploaded file would do, before anything is written: how many rows are
 * new work, how many would change an existing task, how many the register
 * already holds, which need a person's decision, and whether the model was able
 * to help with the unclear ones.
 */
export default function ImportClassification({ reconciliation, ai, busy, onUseAi, onDownloadWorkbook, onAcceptUpdates }) {
  if (!reconciliation) return null;
  const updates = reconciliation.update || 0;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {TILES.map((tile) => (
          <Stat key={tile.key} label={tile.label} value={reconciliation[tile.key] || 0} tone={tile.tone} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {reconciliation.changes > 0
              ? `${reconciliation.changes} field change(s) are proposed across ${updates} row(s). Nothing is written until you accept a row and confirm the import. A blank cell never clears a recorded value.`
              : 'No existing record would be changed by this file.'}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {updates > 0 && onAcceptUpdates && (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={onAcceptUpdates}>
              Accept all {updates} change(s)
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2" disabled={!!busy} onClick={onUseAi}>
            <Sparkles className="h-3.5 w-3.5" /> Interpret unclear rows
          </Button>
          {onDownloadWorkbook && (
            <Button size="sm" variant="ghost" className="gap-2" disabled={!!busy} onClick={onDownloadWorkbook}>
              <Download className="h-3.5 w-3.5" /> Reconciled workbook
            </Button>
          )}
        </div>
      </div>

      {ai && (ai.requested || ai.available) && (
        <p
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-xs',
            ai.available ? 'border-border bg-card text-muted-foreground' : 'border-amber-500/40 bg-amber-500/5 text-foreground',
          )}
        >
          {ai.available ? <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>
            {ai.available
              ? `${ai.note} Model: ${ai.model}. Suggestions are shown beside the file's own words and are never applied on their own.`
              : `${ai.note} The file itself was still read in full — the five counts above are the deterministic reading, not a model's.`}
          </span>
        </p>
      )}
    </section>
  );
}