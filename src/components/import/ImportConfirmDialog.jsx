import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** The confirmation that stands between a reviewed file and a written batch. */
export default function ImportConfirmDialog({ open, onOpenChange, counts, fileName, busy, error, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  const ready = counts.attention === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setConfirmed(false);
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm this import</DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="rounded-lg border border-border bg-muted/40 p-3 font-medium">
            {counts.created} new task{counts.created === 1 ? '' : 's'} will be created, {counts.updated} agreed change
            {counts.updated === 1 ? '' : 's'} applied to existing tasks, {counts.unchanged} row(s) already match the
            register, {counts.rejected} rejected, {counts.deferred} deferred, {counts.attention} still need a decision.
          </p>
          {counts.updated > 0 && (
            <p className="text-xs text-muted-foreground">
              {counts.updated} existing task(s) will change — only in the fields you accepted. Each change is recorded in
              that task's history with the file and row it came from, and a cell the file left blank changes nothing.
            </p>
          )}
          {counts.linked > 0 && (
            <p className="text-xs text-muted-foreground">
              {counts.linked} row(s) will be linked to tasks already on the register — no new task is created for them, and
              nothing on the existing task is overwritten.
            </p>
          )}
          {!ready && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              Rows that require attention must be corrected or marked as skipped before the import can run.
            </p>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Every created task gets its own permanent task reference.</li>
            <li>Each one is written with its import batch, source file and row number, and logged in the task history.</li>
            <li>Existing records change only where you accepted a change, and every change is logged on that task.</li>
            <li>Approved baselines, approval separation and the reason rule for a revised forecast all still apply.</li>
          </ul>

          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" />
            <span>I have reviewed these rows and confirm the accepted changes and new tasks.</span>
          </label>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!confirmed || !ready || !!busy}>
            {busy ? 'Importing…' : 'Import now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}