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
            {counts.created} task{counts.created === 1 ? '' : 's'} will be created, {counts.skipped} skipped,{' '}
            {counts.attention} require attention.
          </p>
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
            <li>Existing task records are never overwritten by an import.</li>
          </ul>

          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" />
            <span>I have reviewed these tasks and confirm they should be created.</span>
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