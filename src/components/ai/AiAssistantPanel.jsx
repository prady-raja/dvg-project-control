import React, { useEffect, useState } from 'react';
import { Bot, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  SITE_MESSAGE_EXAMPLES, aiAssist, aiAssistCancel, aiAssistConfirm, aiAssistFinish, newProposalKey,
} from '@/lib/aiService';
import { applyProposalActions } from '@/lib/assistApply';
import { items } from '@/lib/dataHelpers';
import AiProposalReview from '@/components/ai/AiProposalReview';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * Describe what happened on site in plain words. The server reads the message,
 * resolves the villas, rooms and tasks from the registers, and prepares a
 * proposal. Nothing is written until the proposal is reviewed and confirmed —
 * and confirming the same proposal twice can never write twice.
 */
export default function AiAssistantPanel({ projectId, phaseId, date, onWritten }) {
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [floors, setFloors] = useState([]);
  const [areas, setAreas] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [contractors, setContractors] = useState([]);

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    (async () => {
      const [floorRes, areaRes, disciplineRes, contractorRes] = await Promise.all([
        base44.entities.VillaFloor.filter({ project_id: projectId }, { sort: 'level_order', limit: 300 }),
        base44.entities.VillaArea.filter({ project_id: projectId }, { sort: 'sort_order', limit: 500 }),
        base44.entities.Discipline.list(),
        base44.entities.Contractor.list(),
      ]);
      if (cancelled) return;
      setFloors(items(floorRes));
      setAreas(items(areaRes));
      setDisciplines(items(disciplineRes).filter((row) => row.active !== false));
      setContractors(items(contractorRes).filter((row) => row.active !== false));
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const patchTurn = (key, updates) =>
    setTurns((current) => current.map((turn) => (turn.key === key ? { ...turn, ...updates } : turn)));

  const send = async (text) => {
    const message = String(text || draft).trim();
    if (!message || !projectId) return;
    const key = newProposalKey();
    setBusy(true);
    setError('');
    try {
      const proposal = await aiAssist({ projectId, phaseId, text: message, date, key });
      setTurns((current) => [...current, { key, text: message, proposal, outcome: null }]);
      setDraft('');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'That message could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (turn, actionIds, edits) => {
    setBusy(true);
    setError('');
    try {
      const step = await aiAssistConfirm({ projectId, phaseId, key: turn.key, actionIds, edits });
      if (step.replay || !(step.actions || []).length) {
        patchTurn(turn.key, {
          outcome: {
            status: step.replay ? step.status || 'Applied' : 'Failed',
            message: step.message || (step.refused || []).map((row) => row.reason).join(' ') || 'Nothing was written.',
            results: (step.refused || []).map((row) => ({ action_id: row.action_id, summary: row.summary, ok: false, error: row.reason })),
          },
        });
        return;
      }
      const results = await applyProposalActions(step.actions);
      const finish = await aiAssistFinish({ projectId, phaseId, key: turn.key, results });
      patchTurn(turn.key, {
        outcome: {
          status: finish.status || 'Applied',
          message: finish.message || '',
          results: (finish.results || []).length ? finish.results : results,
        },
      });
      onWritten?.();
    } catch (e) {
      patchTurn(turn.key, {
        outcome: {
          status: 'Failed',
          message: e?.response?.data?.error || e?.message || 'The confirmation was refused.',
          results: [],
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (turn) => {
    setBusy(true);
    try {
      await aiAssistCancel({ projectId, phaseId, key: turn.key });
      patchTurn(turn.key, { outcome: { status: 'Cancelled', message: 'Proposal cancelled — nothing was written.', results: [] } });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'The proposal could not be cancelled.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Site message assistant</h3>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Write what happened the way you would tell a colleague. The assistant resolves the villa, the floor and room, and the task,
        then shows a proposal you edit and confirm. Nothing is saved before that confirmation.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {SITE_MESSAGE_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setDraft(example)}
            className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>

      <Textarea
        className="mt-3"
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Villa B-05-06 first floor master bedroom painting 60% complete, four painters today."
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button className="gap-2" disabled={busy || !draft.trim() || !projectId} onClick={() => send()}>
          {busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          {busy ? 'Reading the records…' : 'Read and prepare proposal'}
        </Button>
        <span className="text-[11px] text-muted-foreground">Nothing is written until you confirm the proposal.</span>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {!!turns.length && (
        <div className="mt-4 space-y-4">
          {[...turns].reverse().map((turn) => (
            <div key={turn.key} className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 text-sm">{turn.text}</p>
              </div>
              <AiProposalReview
                proposal={turn.proposal}
                busy={busy}
                outcome={turn.outcome}
                onConfirm={(actionIds, edits) => confirm(turn, actionIds, edits)}
                onCancel={() => cancel(turn)}
                floors={floors}
                areas={areas}
                disciplines={disciplines}
                contractors={contractors}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}