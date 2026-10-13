import React, { useEffect, useState } from 'react';
import { useCatalogs } from '@/lib/CatalogContext';
import { aiAsk, aiDailyBrief, aiStatus, SUGGESTED_QUESTIONS } from '@/lib/aiService';
import { todayIst } from '@/lib/format';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import AiPanel from '@/components/ai/AiPanel';
import AiAssistantPanel from '@/components/ai/AiAssistantPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot } from 'lucide-react';
import NoProjectState from '@/components/common/NoProjectState';
import SearchSelect from '@/components/common/SearchableSelect';
import { useScopeState } from '@/lib/ScopeContext';

/** Stage B / 10 and 12 — Ask DVG AI and the daily management brief. */
export default function AskDvgAi() {
  const cat = useCatalogs();
  const [projectId, setProjectId, phaseId, setPhaseId] = useScopeState();
  const [date, setDate] = useState(todayIst());
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  useEffect(() => {
    aiStatus().then(setStatus).catch(() => setStatus({ permitted: false, reason: 'The AI settings could not be read.' }));
  }, []);

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <NoProjectState icon={Bot} description="The assistant can only read projects you are a member of." />
      </div>
    );
  }

  const phases = projectId ? cat.phasesFor(projectId) : [];
  const permitted = status?.permitted !== false;

  return (
    <>
      <PageHeader
        eyebrow="Project intelligence"
        title="Ask DVG AI"
        description="Answers are grounded in your project's own records. Every figure is calculated by the application first; the model explains those figures and nothing else."
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="lg:hidden">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
            <SearchSelect
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPhaseId('');
              }}
            >
              {cat.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </SearchSelect>
          </div>
          <div className="lg:hidden">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Phase</p>
            <SearchSelect
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
            >
              <option value="">All phases</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </SearchSelect>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Data date</p>
            <input
              type="date"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {status?.configured
            ? `Model ${status.model} · ${status.used_today} of ${status.daily_limit} request(s) used today · ${status.remaining_today} left.`
            : 'AI is not configured yet — an administrator adds the OpenAI key in Secrets. Everything else keeps working.'}
        </p>
      </div>

      <section className="mt-5">
        <AiAssistantPanel projectId={projectId} phaseId={phaseId} date={date} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <AiPanel
          title="Ask about the project"
          description="Questions are answered from the tasks, villas, contractors, blockers, dependencies, site reports and approvals you can access."
          mode="ask"
          run={(question) => aiAsk({ projectId, phaseId, question, date })}
          suggestions={SUGGESTED_QUESTIONS}
          disabled={!projectId}
          disabledReason="Choose a project first."
        />

        <AiPanel
          title="Daily management brief"
          description="Eight sections: activity, overdue works, blockers, commitments, decisions, villas needing attention, stale updates and tomorrow's priorities."
          mode="brief"
          actionLabel="Generate daily brief"
          answerTitle="Daily management brief"
          run={() => aiDailyBrief({ projectId, phaseId, date })}
          disabled={!projectId || !permitted}
          disabledReason={status?.reason || 'Choose a project first.'}
        />
      </div>

      <BoardSection
        title="What the assistant may and may not do"
        description="The boundary is enforced on the server, not by the prompt alone."
        className="mt-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">May</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Read the project records your membership already allows.</li>
              <li>Summarise progress from measured values only.</li>
              <li>Explain recorded delays, blockers and dependencies.</li>
              <li>Recommend priorities from the calculated facts.</li>
              <li>Draft meeting reports and briefs.</li>
              <li>Propose a structured site update for a human to confirm.</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">May not</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Approve or close construction work.</li>
              <li>Move a baseline or change a permission.</li>
              <li>Write to a task record — proposals need confirmation.</li>
              <li>Invent progress where none has been measured.</li>
              <li>See any project you are not a member of.</li>
            </ul>
          </div>
        </div>
      </BoardSection>
    </>
  );
}