import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateTask } from '@/lib/taskService';
import { useAccess } from '@/lib/AccessContext';

const OPEN_FOR_EXECUTION = ['Not Started', 'In Progress', 'Blocked'];
const AWAITING_APPROVAL = ['Execution Complete', 'Under Inspection'];

/**
 * Execution completion and approval are two separate steps by two different
 * people. The server enforces both; these buttons only appear when allowed.
 */
export default function TaskApprovalActions({ task, canEdit, canApprove, onChanged }) {
  const access = useAccess();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (!task) return null;

  const completedById = task.execution_completed_by_id;
  const awaiting = AWAITING_APPROVAL.includes(task.status);
  const markComplete = canEdit && OPEN_FOR_EXECUTION.includes(task.status);
  const approveNow = canApprove && awaiting && completedById && completedById !== access.user?.id;
  const selfCompleted = canApprove && awaiting && completedById === access.user?.id;

  if (!markComplete && !approveNow && !selfCompleted && !completedById) return null;

  const apply = async (label, status) => {
    setBusy(label);
    setError('');
    try {
      await updateTask(task.id, { status });
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
              onClick={() => apply('close', 'Closed')}
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
            ? ' — a different Project Manager must approve or close this work.'
            : ''}
          {task.approved_by_name ? ` · Approved by ${task.approved_by_name}` : ''}
        </p>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}