import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { loadDashboard } from '@/lib/dashboardService';
import { todayIst } from '@/lib/format';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import StatTile from '@/components/common/StatTile';
import DataCaveats from '@/components/common/DataCaveats';
import EmptyState from '@/components/common/EmptyState';
import ActivityRows from '@/components/common/ActivityRows';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import ForecastRevisionDialog from '@/components/planning/ForecastRevisionDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ACTIVITY_COLUMNS } from '@/lib/reportExport';
import ShareMenu from '@/components/common/ShareMenu';

/** Stage A / 5 — Daily and weekly planning. */
const BUCKETS = [
  { key: 'overdue', label: 'Overdue', tone: 'danger' },
  { key: 'at_risk', label: 'At risk', tone: 'warning' },
  { key: 'verification', label: 'Verification pending' },
  { key: 'today', label: "Today's activities" },
  { key: 'tomorrow', label: "Tomorrow's activities" },
  { key: 'week_7', label: '7-day look-ahead' },
  { key: 'week_14', label: '14-day look-ahead' },
  { key: 'unscheduled', label: 'Unscheduled', tone: 'warning' },
  { key: 'later', label: 'Beyond 14 days' },
];

export default function Planning() {
  const cat = useCatalogs();
  const access = useAccess();
  const { user } = useAuth();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [date, setDate] = useState(todayIst());
  const [tab, setTab] = useState('overdue');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revise, setRevise] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    loadDashboard('planning', { projectId, phaseId, contractorId, discipline, date })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Could not load the plan.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, phaseId, contractorId, discipline, date, refresh]);

  const phases = projectId ? cat.phasesFor(projectId) : [];
  const project = cat.projectById(projectId);
  const disciplines = projectId ? cat.enabledDisciplines(project) : cat.disciplines;
  const canRevise = projectId ? access.can(projectId, 'manage_project') : false;
  const buckets = data?.buckets || {};
  const counts = data?.counts || {};

  const disciplineOptions = useMemo(
    () => [{ value: '', label: 'All disciplines' }, ...disciplines.map((d) => ({ value: d.code, label: d.name }))],
    [disciplines],
  );

  const reviseButton = (row) => (
    <Button variant="outline" size="sm" onClick={() => setRevise(row)}>
      Revise forecast
    </Button>
  );

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState icon={CalendarRange} title="No project yet" description="Planning appears once you are a member of a project." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Execution planning"
        title="Planning"
        description="What is due today, tomorrow, this week and this fortnight, what is late, and what has no reliable date. Dates are shown in Asia/Kolkata."
        actions={
          <>
            <ShareMenu
              title={`Planning — ${tab}`}
              filename={`planning-${tab}`}
              rows={(tab === 'at_risk' ? data?.at_risk : data?.buckets?.[tab]) || []}
              columns={ACTIVITY_COLUMNS}
              text={() => {
                const list = (tab === 'at_risk' ? data?.at_risk : data?.buckets?.[tab]) || [];
                return [`DVG planning — ${tab} (${list.length})`, ...list.slice(0, 25).map((r) => `• ${r.ref} ${r.villa || ''} ${r.name || ''}`.trim()), list.length > 25 ? `…and ${list.length - 25} more` : ''].filter(Boolean).join('\n');
              }}
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRefresh((n) => n + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      <DashboardFilters
        projects={cat.projects}
        phases={phases}
        projectId={projectId}
        phaseId={phaseId}
        date={date}
        onProject={(value) => {
          setProjectId(value);
          setPhaseId('');
          setDiscipline('');
        }}
        onPhase={setPhaseId}
        onDate={setDate}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contractor</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
            >
              <option value="">All contractors</option>
              {cat.contractors.filter((c) => c.active !== false).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Discipline</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            >
              {disciplineOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </DashboardFilters>

      {loading ? (
        <Skeleton className="mt-5 h-96 rounded-xl" />
      ) : error ? (
        <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <DataCaveats items={data.warnings} />

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {BUCKETS.map((bucket) => (
              <StatTile
                key={bucket.key}
                label={bucket.label}
                value={counts[bucket.key] ?? 0}
                tone={bucket.tone}
                active={tab === bucket.key}
                onClick={() => setTab(bucket.key)}
              />
            ))}
          </div>

          <BoardSection
            title="Activities"
            description="Task reference, villa, work, discipline, contractor, engineer, baseline and forecast dates, status and any blocker."
          >
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                {BUCKETS.map((bucket) => (
                  <TabsTrigger key={bucket.key} value={bucket.key} className={cn(bucket.tone === 'danger' && 'text-destructive')}>
                    {bucket.label} ({counts[bucket.key] ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>
              {BUCKETS.map((bucket) => (
                <TabsContent key={bucket.key} value={bucket.key} className="mt-4">
                  <ActivityRows
                    rows={(bucket.key === 'at_risk' ? data.at_risk : buckets[bucket.key]) || []}
                    emptyLabel={
                      bucket.key === 'unscheduled'
                        ? 'Every outstanding task has a date. Nothing is hiding from the plan.'
                        : 'No activity falls in this window for the current filter.'
                    }
                    rowAction={canRevise ? reviseButton : undefined}
                    rowActionLabel="Manage"
                  />
                </TabsContent>
              ))}
            </Tabs>
            <p className="mt-4 text-xs text-muted-foreground">
              {counts.executing ?? 0} outstanding task(s) still to be executed in this scope
              {data.held_work_excluded ? ` · ${data.held_work_excluded} task(s) on villas on hold are excluded` : ''}.
            </p>
          </BoardSection>
        </div>
      )}

      <ForecastRevisionDialog
        task={revise}
        open={!!revise}
        onOpenChange={(value) => !value && setRevise(null)}
        user={user}
        onSaved={() => {
          setRevise(null);
          setRefresh((n) => n + 1);
        }}
      />
    </>
  );
}