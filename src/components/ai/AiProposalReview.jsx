import React, { useMemo, useState } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AiProposalAction from '@/components/ai/AiProposalAction';
import { cn } from '@/lib/utils';

/** The starting values of every editable field, taken from the stored proposal. */
const initialDraft = (action) => {
  const payload = action.payload || {};
  if (action.type === 'record_progress') {
    return {
      status: payload.status || '',
      progress_percent: payload.progress_percent ?? '',
      manpower: payload.manpower_items?.[0]?.count ?? '',
      forecast: payload.current_forecast_finish || '',
      reason: payload.date_revision_reason || '',
      blocker_category: payload.blocker_category || '',
      blocker_description: payload.blocker_description || '',
      work_done: payload.work_done || '',
    };
  }
  if (action.type === 'create_task') {
    const changes = payload.changes || {};
    return {
      name: changes.name || '',
      discipline: changes.discipline || '',
      contractor_id: changes.contractor_id || '',
      priority: changes.priority || 'Medium',
      work_package: changes.work_package || '',
      floor_id: changes.floor_id || '',
      area_ids: changes.area_ids || [],
      forecast: changes.current_forecast_finish || '',
      remarks: changes.remarks || '',
    };
  }
  if (action.type === 'raise_snag') {
    const snag = payload.snag || {};
    return {
      title: snag.title || '',
      description: snag.description || '',
      severity: snag.severity || 'Minor',
      target_date: snag.target_date || '',
      contractor_id: snag.contractor_id || '',
      handover_blocker: snag.handover_blocker === true,
    };
  }
  return {};
};

/** Every change the person made, as the patch the server merges into the stored action. */
const patchFor = (action, draft) => {
  if (action.type === 'record_progress') {
    const patch = {};
    if (String(draft.work_done || '').trim()) patch.work_done = draft.work_done.trim();
    if (draft.status) patch.status = draft.status;
    if (draft.progress_percent !== '' && draft.progress_percent !== undefined && draft.progress_percent !== null) {
      patch.progress_percent = Number(draft.progress_percent);
    }
    if (draft.manpower !== '' && draft.manpower !== undefined && draft.manpower !== null && Number(draft.manpower) > 0) {
      patch.manpower_items = [{
        discipline: action.payload?.manpower_items?.[0]?.discipline || 'Site work',
        count: Number(draft.manpower),
      }];
    }
    if (draft.forecast) {
      patch.current_forecast_finish = draft.forecast;
      patch.date_revision_reason = String(draft.reason || '').trim() || `Site message: ${String(action.payload?.work_done || '').slice(0, 200)}`;
    }
    if (draft.blocker_category) {
      patch.blocker_reported = true;
      patch.blocker_category = draft.blocker_category;
      patch.blocker_description = String(draft.blocker_description || draft.work_done || '').slice(0, 800);
    }
    return patch;
  }
  if (action.type === 'create_task') {
    return {
      changes: {
        ...(action.payload?.changes || {}),
        name: String(draft.name || '').trim(),
        discipline: draft.discipline,
        contractor_id: draft.contractor_id || null,
        priority: draft.priority,
        work_package: String(draft.work_package || '').trim() || null,
        floor_id: draft.floor_id || null,
        area_ids: draft.area_ids || [],
        ...(draft.forecast ? { current_forecast_finish: draft.forecast } : {}),
        remarks: String(draft.remarks || '').trim(),
      },
    };
  }
  if (action.type === 'raise_snag') {
    return {
      snag: {
        ...(action.payload?.snag || {}),
        title: String(draft.title || '').trim(),
        description: String(draft.description || '').trim(),
        severity: draft.severity,
        target_date: draft.target_date || null,
        contractor_id: draft.contractor_id || null,
        handover_blocker: draft.handover_blocker === true,
      },
    };
  }
  return {};
};

/**
 * The mandatory review step. Nothing has been written when this card appears:
 * every action can be edited, deselected, confirmed or cancelled, and the
 * outcome of each one is reported underneath afterwards.
 */
export default function AiProposalReview({
  proposal, busy, outcome, onConfirm, onCancel, floors = [], areas = [], disciplines = [], contractors = [],
}) {
  const actions = proposal?.actions || [];
  const questions = proposal?.questions || [];
  const notes = proposal?.notes || [];
  const [draftEdits, setDraftEdits] = useState(() => Object.fromEntries(actions.map((a) => [a.action_id, initialDraft(a)])));
  const [deselected, setDeselected] = useState(() => new Set());

  const selected = useMemo(
    () => actions.filter((action) => !deselected.has(action.action_id)),
    [actions, deselected],
  );

  // Partial and Failed can be confirmed again: the server retries only what was not written.
  const settled = ['Applied', 'Cancelled'].includes(outcome?.status);
  const retry = ['Partial', 'Failed'].includes(outcome?.status);

  const confirm = () => {
    const edits = {};
    selected.forEach((action) => {
      const patch = patchFor(action, draftEdits[action.action_id] || {});
      if (Object.keys(patch).length) edits[action.action_id] = patch;
    });
    onConfirm(selected.map((action) => action.action_id), edits);
  };

  const missing = selected.some((action) => {
    const draft = draftEdits[action.action_id] || {};
    if (action.type === 'create_task') return !String(draft.name || '').trim() || !draft.discipline;
    if (action.type === 'raise_snag') return !String(draft.title || '').trim();
    return false;
  });

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.02] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
          Review before saving
        </span>
        <span className="text-[11px] text-muted-foreground">
          {proposal?.source === 'ai'
            ? 'The reading was tidied by the model; every record was resolved by the server.'
            : 'Read by rule on the server — no model was used.'}
          {proposal?.data_date ? ` · data date ${proposal.data_date}` : ''}
        </span>
      </div>

      {!!proposal?.ai_note && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{proposal.ai_note}</span>
        </p>
      )}

      {!!questions.length && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 px-3 py-2 text-xs">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" />
          <div>
            <p className="font-medium">Before this can be saved</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {questions.map((question) => <li key={question}>{question}</li>)}
            </ul>
          </div>
        </div>
      )}

      {!!notes.length && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
          {notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}

      {!!actions.length ? (
        <div className="mt-3 space-y-3">
          {actions.map((action) => (
            <AiProposalAction
              key={action.action_id}
              action={action}
              selected={!deselected.has(action.action_id)}
              busy={busy || settled}
              draft={draftEdits[action.action_id] || {}}
              onChange={(next) => setDraftEdits((current) => ({ ...current, [action.action_id]: next }))}
              onToggle={(on) =>
                setDeselected((current) => {
                  const next = new Set(current);
                  if (on) next.delete(action.action_id);
                  else next.add(action.action_id);
                  return next;
                })}
              floors={floors}
              areas={areas}
              disciplines={disciplines}
              contractors={contractors}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          No record can be prepared from that message. Answer the points above and send it again — nothing has been written.
        </p>
      )}

      {!!proposal?.candidates?.length && (
        <div className="mt-3 rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tasks the words matched</p>
          <ul className="mt-1 space-y-1 text-xs">
            {proposal.candidates.map((candidate) => (
              <li key={candidate.task_ref} className={cn('flex flex-wrap gap-2', candidate.chosen && 'font-medium')}>
                <span className="field-mono">{candidate.task_ref}</span>
                <span className="min-w-0 flex-1 truncate">{candidate.task_name}</span>
                <span className="text-muted-foreground">{candidate.villa}{candidate.chosen ? ' · proposed' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          disabled={busy || settled || !selected.length || missing}
          onClick={confirm}
        >
          {settled ? 'Saved' : busy ? 'Saving…' : retry ? 'Retry what was not saved' : `Confirm and save ${selected.length} record${selected.length === 1 ? '' : 's'}`}
        </Button>
        <Button variant="ghost" disabled={busy || settled} onClick={onCancel}>
          Cancel
        </Button>
        {missing && <span className="text-[11px] text-muted-foreground">Complete the required fields, or deselect that action.</span>}
      </div>

      {!!outcome?.message && (
        <p
          className={cn(
            'mt-3 rounded-lg border px-3 py-2 text-xs',
            outcome.status === 'Applied'
              ? 'border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/5'
              : 'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5',
          )}
        >
          {outcome.message}
        </p>
      )}

      {!!(outcome?.results || []).length && (
        <ul className="mt-2 space-y-1 text-xs">
          {outcome.results.map((row) => (
            <li key={`${row.action_id}-${row.ok}`} className="flex flex-wrap items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', row.ok ? 'bg-[hsl(var(--success))]' : 'bg-destructive')} />
              <span className="min-w-0 flex-1">{row.summary}</span>
              <span className="text-muted-foreground">
                {row.ok ? `Written${row.task_ref ? ` · ${row.task_ref}` : ''}` : row.error || 'Refused'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}