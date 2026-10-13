import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateTask } from '@/lib/taskService';
import { useAccess } from '@/lib/AccessContext';
import OwnerAckDialog from '@/components/common/OwnerAckDialog';
import { needsAck } from '@/lib/shared/ownerSignoff.ts';
import { useCatalogs } from '@/lib/CatalogContext';
import { isRework } from '@/lib/shared/rework.ts';
import RejectDialog from '@/components/tasks/RejectDialog';

const OPEN_FOR_EXECUTION = ['Not Started', 'In Progress', 'Blocked'];
const AWAITING_APPROVAL = ['Execution Complete', 'Under Inspection'];

/**
 * Execution completion and approval are two separate steps by two different
 * people. The server enforces both; these buttons only appear when allowed.
 */
export default function TaskApprovalActions({ task, canEdit, canApprove, onChanged }) {
  const access = useAccess();
  const cat = useCatalogs();
  const [asking, setAsking] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (!task) return null;

  const completedById = task.execution_completed_by_id;
  const awaiting = AWAITING_APPROVAL.includes(task.status);
  const markComplete = canEdit && OPEN_FOR_EXECUTION.includes(task.status);
  const approveNow = canApprove && awaiting && completedById && completedById !== access.user?.id;
  const startInspection = canApprove && task.status === 'Execution Complete';
  const rejectNow = canApprove && awaiting;
  const selfCompleted = canApprove && awaiting && completedById === access.user?.id;

  if (!markComplete && !approveNow && !selfCompleted && !rejectNow && !completedById) return null;

  const ackNeeded = needsAck({ location: cat.locationById(task.location_id), project: cat.projectById(task.project_id) });

  const apply = async (label, status, ownerAck, rejection) => {
    setBusy(label);
    setError('');
    try {
      await updateTask(task.id, { expected_version: task.updated_date, status, ...(ownerAck ? { owner_ack: ownerAck } : {}), ...(rejection ? { rejection } : {}) });
      onChanged?.();
    } catch (e) {
      setError(e?.message || 'The change was refused.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {markComplete && (
          <Button size="sm" className="gap-2" disabled={!!busy} onClick={() => apply('complete', 'Execution Complete')}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {busy === 'complete' ? 'Saving…' : 'Mark execution complete'}
          </Button>
        )}
        {startInspection && (
          <Button size="sm" variant="outline" className="gap-2" disabled={!!busy} onClick={() => apply('inspect', 'Under Inspection')}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            {busy === 'inspect' ? 'Saving…' : 'Start inspection'}
          </Button>
        )}
        {rejectNow && (
          <Button size="sm" variant="outline" className="gap-2" disabled={!!busy} onClick={() => setRejecting(true)}>
            <Undo2 className="h-3.5 w-3.5" />
            Reject for rework
          </Button>
        )}
        {approveNow && (
          <>
            <Button size="sm" className="gap-2" disabled={!!busy} onClick={() => apply('approve', 'Approved')}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {busy === 'approve' ? 'Saving…' : 'Approve work'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => (ackNeeded ? setAsking(true) : apply('close', 'Closed'))}
            >
              {busy === 'close' ? 'Saving…' : 'Close work'}
            </Button>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {completedById
            ? `Execution completed by ${task.execution_completed_by_name || 'a site engineer'}`
            : 'Execution completion and approval are recorded separately.'}
          {selfCompleted
            ? ' — a different Project Editor must approve or close this work.'
            : ''}
          {task.approved_by_name ? ` · Approved by ${task.approved_by_name}` : ''}
          {isRework(task) ? ` · Sent back for rework ${task.rejection_count} time${task.rejection_count === 1 ? '' : 's'}: ${task.last_rejection_category} — ${task.last_rejection_reason}` : ''}
        </p>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        submitting={busy === 'reject'}
        error={error}
        onSubmit={async (rejection) => { await apply('reject', 'In Progress', null, rejection); setRejecting(false); }}
      />
      <OwnerAckDialog open={asking} onOpenChange={setAsking} submitting={!!busy} onSubmit={async (ack) => { await apply('close', 'Closed', ack); setAsking(false); }} />
    </div>
  );
}