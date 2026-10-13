import React, { useCallback, useEffect, useState } from 'react';
import { GitBranch, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { runBaselineAction } from '@/lib/taskService';
import Pill from '@/components/common/Pill';
import FormDialog from '@/components/common/FormDialog';
import Field from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateTime } from '@/lib/format';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StackTable from '@/components/common/StackTable';

const FIELD_LABELS = {
  baseline_start: 'Start',
  baseline_finish: 'Finish',
  task: 'Scope',
};

/**
 * Baseline versions for one phase. A draft is editable; once approved it is
 * frozen for good and any later change is a new numbered version that records
 * what moved, who approved it and why.
 */
export default function BaselineSection({ projectId, phaseId, canManage, onChanged }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    if (!projectId || !phaseId) return;
    setLoading(true);
    const res = await base44.entities.BaselineVersion.filter(
      { project_id: projectId, phase_id: phaseId },
      { sort: '-version_number', limit: 50 },
    );
    setVersions(items(res));
    setLoading(false);
  }, [projectId, phaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (label, payload) => {
    setBusy(label);
    setError('');
    try {
      await runBaselineAction({ project_id: projectId, phase_id: phaseId, ...payload });
      await load();
      onChanged?.();
      return true;
    } catch (e) {
      setError(e?.message || 'The baseline action was refused.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const draft = versions.find((v) => v.status === 'Draft' || v.status === 'Submitted');
  const approved = versions.find((v) => v.status === 'Approved');
  const superseded = versions.filter((v) => v.status === 'Superseded');

  // The dates a revision proposes. Approved dates are frozen on the tasks, so the
  // revised ones are entered here and only take effect when the version is approved.
  const [dates, setDates] = useState({});
  const covered = approved?.snapshot || [];
  const setDate = (taskId, field, value) =>
    setDates((current) => ({ ...current, [taskId]: { ...(current[taskId] || {}), [field]: value } }));
  const proposedDates = () =>
    covered.map((item) => ({
      task_id: item.task_id,
      baseline_start: (dates[item.task_id]?.baseline_start ?? item.baseline_start ?? '') || null,
      baseline_finish: (dates[item.task_id]?.baseline_finish ?? item.baseline_finish ?? '') || null,
    }));

  const [askApprove, setAskApprove] = React.useState(false);
  const approve = () => setAskApprove(true);
  const doApprove = () => act('approve', { action: 'approve', baseline_version_id: draft.id });

  const saveRebaseline = async () => {
    if (!reason.trim()) {
      setError('A rebaseline needs a reason.');
      return;
    }
    const ok = await act('rebaseline', {
      action: 'rebaseline',
      reason: reason.trim(),
      name: name.trim(),
      dates: proposedDates(),
    });
    if (ok) {
      setReasonOpen(false);
      setReason('');
      setName('');
    }
  };

  if (loading) return <Skeleton className="mt-4 h-20 rounded-lg" />;

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <ConfirmDialog
        open={askApprove}
        onOpenChange={setAskApprove}
        title="Approve this baseline?"
        description="The dates are frozen onto every covered task and can only be changed afterwards by creating a new baseline version."
        confirmLabel="Approve baseline"
        destructive={false}
        onConfirm={doApprove}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          Baseline
          {approved ? (
            <span className="text-muted-foreground">
              v{approved.version_number} approved · {approved.task_count || 0} tasks
              {approved.approved_by_name ? ` by ${approved.approved_by_name}` : ''}
              {approved.approved_at ? ` on ${formatDateTime(approved.approved_at)}` : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">not approved yet</span>
          )}
        </p>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {!draft && !approved && (
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => act('capture', { action: 'capture_draft' })}
              >
                {busy === 'capture' ? 'Capturing…' : 'Capture baseline draft'}
              </Button>
            )}
            {!draft && approved && (
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setReasonOpen(true)}>
                Rebaseline
              </Button>
            )}
            {draft && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() =>
                    act('refresh', { action: 'update_draft', baseline_version_id: draft.id })
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh draft
                </Button>
                <Button size="sm" className="gap-2" disabled={!!busy} onClick={approve}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {busy === 'approve' ? 'Approving…' : `Approve v${draft.version_number}`}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {draft && (
        <div className="mt-3 rounded-md border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <p className="font-medium">
              v{draft.version_number} · {draft.name}
            </p>
            <Pill value={draft.status} />
            <span className="text-muted-foreground">
              {draft.task_count || 0} tasks · captured by {draft.created_by_name || 'unknown'}
            </span>
          </div>

          {draft.reason && <p className="mt-2 text-xs text-muted-foreground">Reason: {draft.reason}</p>}

          {(draft.changes || []).length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-md border border-border">
              <StackTable><table className="w-full text-xs">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Task</th>
                    <th className="px-2 py-1.5 font-medium">Villa</th>
                    <th className="px-2 py-1.5 font-medium">Field</th>
                    <th className="px-2 py-1.5 font-medium">Previous</th>
                    <th className="px-2 py-1.5 font-medium">New</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {draft.changes.slice(0, 12).map((change, index) => (
                    <tr key={`${change.task_ref}-${change.field}-${index}`}>
                      <td className="field-mono px-2 py-1.5">{change.task_ref || '—'}</td>
                      <td className="px-2 py-1.5">{change.location_code || '—'}</td>
                      <td className="px-2 py-1.5">{FIELD_LABELS[change.field] || change.field}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {change.previous ? formatDate(change.previous) : change.previous || '—'}
                      </td>
                      <td className="px-2 py-1.5 font-medium">
                        {change.next && change.next.includes('-') ? formatDate(change.next) : change.next}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></StackTable>
              {draft.changes.length > 12 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {draft.changes.length - 12} further change(s) not shown.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              This draft holds the current baseline dates of {draft.task_count || 0} tasks.
            </p>
          )}
        </div>
      )}

      {superseded.length > 0 && (
        <div className="mt-3 space-y-1">
          {superseded.map((version) => (
            <p key={version.id} className="text-xs text-muted-foreground">
              v{version.version_number} · {version.name} — superseded
              {version.approved_by_name ? ` (approved by ${version.approved_by_name})` : ''}
              {version.reason ? ` · ${version.reason}` : ''}
            </p>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <FormDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="New baseline version"
        description="Approved baselines are never edited. This creates the next numbered version and records what moved."
        submitLabel="Create draft"
        onSubmit={saveRebaseline}
        submitting={busy === 'rebaseline'}
        error={error}
      >
        {covered.length > 0 && (
          <Field
            label="Revised dates"
            hint="Only what you change here is recorded as a difference. Nothing moves on the tasks until this version is approved, and the approved baseline stays in force until then."
          >
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {covered.slice(0, 60).map((item) => (
                <div key={item.task_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <span className="truncate text-xs">
                    <span className="field-mono">{item.task_ref}</span>{' '}
                    <span className="text-muted-foreground">{item.location_code}</span>
                  </span>
                  <Input
                    type="date"
                    className="h-8 w-36 text-xs"
                    value={dates[item.task_id]?.baseline_start ?? item.baseline_start ?? ''}
                    onChange={(e) => setDate(item.task_id, 'baseline_start', e.target.value)}
                  />
                  <Input
                    type="date"
                    className="h-8 w-36 text-xs"
                    value={dates[item.task_id]?.baseline_finish ?? item.baseline_finish ?? ''}
                    onChange={(e) => setDate(item.task_id, 'baseline_finish', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </Field>
        )}

        <Field label="Why is the baseline being revised?" required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Client added a swimming pool and the plastering sequence moved"
          />
        </Field>
        <Field label="Version name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </Field>
      </FormDialog>
    </div>
  );
}