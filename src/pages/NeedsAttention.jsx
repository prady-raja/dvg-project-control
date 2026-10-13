import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { loadDashboard } from '@/lib/dashboardService';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate, todayIst } from '@/lib/format';
import { data as api } from '@/api/data';
import { useAccess } from '@/lib/AccessContext';
import { FIX_FOR, isTaskItem } from '@/lib/attentionService';
import { useInvalidateWork } from '@/hooks/useDashboardQuery';
import { FixDialog, DismissDialog } from '@/components/attention/AttentionDialogs';
import ResolveScopeDialog from '@/components/tasks/ResolveScopeDialog';
import { Checkbox } from '@/components/ui/checkbox';

const PAGE = 100;

const SEVERITY_TONE = {
  invalid: 'bg-red-50 text-red-700 border-red-200',
  incomplete: 'bg-amber-50 text-amber-800 border-amber-200',
};

const Stat = ({ label, value, tone = '' }) => (
  <div className="rounded-lg border border-border p-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn('mt-1 text-xl font-semibold tnum', tone)}>{value}</p>
  </div>
);

/**
 * The review screen that goes with the register: what is missing, what is
 * contradictory, and what is ready to start. Everything here is calculated by
 * the server from the stored records — nothing is inferred on the screen.
 */
export default function NeedsAttention() {
  const cat = useCatalogs();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [date, setDate] = useState(todayIst());
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const access = useAccess();
  const invalidateWork = useInvalidateWork();
  const [picked, setPicked] = useState({});
  const [fix, setFix] = useState(null); // { kind, taskIds, label }
  const [dismiss, setDismiss] = useState(null); // items
  const [scopeTask, setScopeTask] = useState(null);

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await loadDashboard('attention', { projectId, phaseId, date, code, itemLimit: PAGE });
      setData(payload);
      setMore([]);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'The review could not be prepared.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, phaseId, date, code]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const shown = (data?.items?.length || 0) + more.length;
      const payload = await loadDashboard('attention', { projectId, phaseId, date, code, itemLimit: PAGE, offset: shown });
      setMore((prev) => [...prev, ...(payload.items || [])]);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'More rows could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const after = async () => {
    setPicked({});
    await invalidateWork();
    await load();
  };

  const keyOf = (item) => `${item.code}|${item.task_id || item.villa || ''}`;
  const openScope = async (item) => {
    try {
      setScopeTask(await api.get('Task', item.task_id));
    } catch (e) {
      setError(e?.message || 'The task could not be opened.');
    }
  };

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  const phases = projectId ? cat.phasesFor(projectId) : [];
  const counts = data?.counts || {};
  const readiness = data?.readiness || {};
  const items = [...(data?.items || []), ...more];
  const total = data?.page?.total ?? items.length;
  const canAct = projectId ? access.can(projectId, 'manage_project') : false;
  const chosen = items.filter((item) => picked[keyOf(item)]);
  const chosenTasks = [...new Set(chosen.filter(isTaskItem).map((i) => i.task_id))];

  return (
    <>
      <PageHeader
        eyebrow="Data quality"
        title="Needs Attention"
        description="What the register is missing, what contradicts itself, and what is ready to start. Fix a row in place, assign it, or dismiss it with a reason."
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Project</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPhaseId('');
                setCode('');
              }}
            >
              {cat.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Phase</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
            >
              <option value="">All phases</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>{phase.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Issue</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            >
              <option value="">Everything</option>
              {(data?.by_code || []).map((entry) => (
                <option key={entry.code} value={entry.code}>{entry.label} ({entry.count})</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Data date</p>
            <input
              type="date"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Recalculate
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {data?.data_date ? `Calculated for ${formatDate(data.data_date)}. ` : ''}
            Progress is never shown as measured when it is not, so this list is expected to stay long until the registers are filled in.
          </span>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading && !data ? (
        <Skeleton className="mt-5 h-72 rounded-xl" />
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Outstanding tasks reviewed" value={counts.tasks_reviewed ?? 0} />
            <Stat label="Need a decision (invalid)" value={counts.invalid ?? 0} tone="text-destructive" />
            <Stat label="Acceptable, fill in later" value={counts.incomplete ?? 0} tone="text-[hsl(var(--warning))]" />
            <Stat label="Total flags" value={counts.total ?? 0} />
          </div>

          <p className={cn('mt-3 rounded-lg border px-4 py-2.5 text-sm', (counts.invalid ?? 0) === 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900')} role="status">
            Go-live gate: <strong>{counts.invalid ?? 0}</strong> item{counts.invalid === 1 ? '' : 's'} need a decision. Go live only when this is 0.
            {counts.dismissed > 0 && <span className="ml-2 text-xs">{counts.dismissed} dismissed with a reason.</span>}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Stat label="Ready to start" value={readiness.Ready ?? 0} tone="text-[hsl(var(--success))]" />
            <Stat label="Waiting on something recorded" value={readiness.Waiting ?? 0} tone="text-[hsl(var(--warning))]" />
            <Stat label="Readiness unknown" value={readiness.Unknown ?? 0} />
          </div>

          <BoardSection
            title="What is missing, by issue"
            description="Invalid rows need a decision before the record can be trusted; incomplete rows are acceptable to carry forward."
            className="mt-5"
          >
            {!data?.by_code?.length ? (
              <p className="text-sm text-muted-foreground">Nothing is flagged on this scope.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.by_code.map((entry) => (
                  <li key={entry.code}>
                    <button
                      type="button"
                      onClick={() => setCode(code === entry.code ? '' : entry.code)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs transition-colors',
                        code === entry.code ? 'border-primary/50 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {entry.label} · {entry.count}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </BoardSection>

          {!!(data?.readiness_reasons || []).length && (
            <BoardSection title="Why work is not ready" description="Recorded reasons, counted — nothing is added to this list by the screen." className="mt-5">
              <ul className="space-y-1 text-sm">
                {data.readiness_reasons.map((reason) => (
                  <li key={reason.code} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate">{reason.label}</span>
                    <span className="tnum text-muted-foreground">{reason.count}</span>
                  </li>
                ))}
              </ul>
            </BoardSection>
          )}

          <BoardSection
            title={`Flagged records · ${total}`}
            description="Most serious first, then oldest first — open a record to correct it."
            className="mt-5"
          >
            {canAct && chosen.length > 0 && (
              <div className="sticky top-14 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/95 p-2 backdrop-blur lg:top-0" role="toolbar" aria-label="Actions for the selected items">
                <span className="text-xs font-medium">{chosen.length} selected</span>
                {chosenTasks.length > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setFix({ kind: 'contractor', taskIds: chosenTasks, label: `${chosenTasks.length} task(s)` })}>Set contractor</Button>
                    <Button size="sm" variant="outline" onClick={() => setFix({ kind: 'dates', taskIds: chosenTasks, label: `${chosenTasks.length} task(s)` })}>Set dates</Button>
                    <Button size="sm" variant="outline" onClick={() => setFix({ kind: 'assignee', taskIds: chosenTasks, label: `${chosenTasks.length} task(s)` })}>Assign</Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => setDismiss(chosen)}>Dismiss</Button>
                <Button size="sm" variant="ghost" onClick={() => setPicked({})}>Clear</Button>
              </div>
            )}
            {!items.length ? (
              <EmptyState
                icon={ClipboardCheck}
                title="Nothing flagged here"
                description="Either the register is complete for this scope, or no tasks are outstanding yet."
                action={<Button asChild variant="outline"><Link to="/import">Import work</Link></Button>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const kind = FIX_FOR[item.code];
                  return (
                    <li key={keyOf(item) + item.detail} className="flex flex-wrap items-start gap-2 py-2.5">
                      {canAct && (
                        <Checkbox className="mt-1" checked={!!picked[keyOf(item)]} onCheckedChange={(v) => setPicked((p) => ({ ...p, [keyOf(item)]: v === true }))} aria-label={`Select ${item.task_ref || item.villa}`} />
                      )}
                      <span className={cn('mt-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', SEVERITY_TONE[item.severity] || 'border-border text-muted-foreground')}>
                        {item.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {item.link || item.task_id ? (
                            <Link to={item.link || `/tasks/${item.task_id}`} className="hover:underline">
                              {item.task_ref ? `${item.task_ref} · ` : ''}{item.task_name || 'Register gap'}
                            </Link>
                          ) : (
                            <span>{item.task_name || 'Register gap'}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {item.villa || 'Site-wide'}{item.detail ? ` · ${item.detail}` : ''}
                        </p>
                        {canAct && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {kind && kind !== 'scope' && item.task_id && (
                              <Button size="sm" variant="outline" className="h-7" onClick={() => setFix({ kind, taskIds: [item.task_id], label: item.task_ref })}>Fix</Button>
                            )}
                            {kind === 'scope' && item.task_id && <Button size="sm" variant="outline" className="h-7" onClick={() => openScope(item)}>Fix</Button>}
                            {item.task_id && <Button size="sm" variant="ghost" className="h-7" onClick={() => setFix({ kind: 'assignee', taskIds: [item.task_id], label: item.task_ref })}>Assign</Button>}
                            <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => setDismiss([item])}>Dismiss</Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {items.length < total && (
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Showing {items.length} of {total}.</span>
                <Button size="sm" variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </BoardSection>
        </>
      )}

      <FixDialog kind={fix?.kind} projectId={projectId} taskIds={fix?.taskIds || []} label={fix?.label || ''} onClose={() => setFix(null)} onDone={after} />
      <DismissDialog open={!!dismiss} projectId={projectId} items={dismiss || []} onClose={() => setDismiss(null)} onDone={after} />
      <ResolveScopeDialog task={scopeTask} open={!!scopeTask} onOpenChange={(v) => !v && setScopeTask(null)} onSaved={after} />
    </>
  );
}