import { data } from '@/api/data';
import DataState from '@/components/common/DataState';
import TruncationBanner from '@/components/common/TruncationBanner';
import { errorMessageOf } from '@/lib/clientErrors';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { todayIst } from '@/lib/format';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { useQuickActions } from '@/components/layout/QuickActions';
import PageHeader from '@/components/common/PageHeader';
import EnumSelect from '@/components/common/EnumSelect';
import EmptyState from '@/components/common/EmptyState';
import DailyUpdateCard from '@/components/daily/DailyUpdateCard';
import AiUpdatePanel from '@/components/ai/AiUpdatePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** What the site did on one day, project-wide, grouped by phase and then villa. */
const SCOPES = ['All', 'Villa', 'Site-wide'];

const Stat = ({ label, value }) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="field-mono mt-1 text-xl font-semibold">{value}</p>
  </div>
);

export default function DailyActivity() {
  const cat = useCatalogs();
  const access = useAccess();
  const quick = useQuickActions();
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(todayIst());
  const [scope, setScope] = useState('All');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ updates: 0, blockers: 0, manpower: 0 });
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    if (projectId || cat.loading || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError('');
    const query = { project_id: projectId, update_date: date, voided: { $ne: true } };
    if (scope !== 'All') query.work_scope = scope;

    try {
      const [listRes, updateCount, blockerCount, agg] = await Promise.all([
        base44.entities.DailyUpdate.filter(query, { sort: '-reported_at', limit: 200 }),
        base44.entities.DailyUpdate.count(query),
        base44.entities.DailyUpdate.count({ ...query, blocker_reported: true }),
        base44.entities.DailyUpdate.aggregate({ query, sum: 'manpower_total' }),
      ]);

      setRows(items(listRes));
      setSummary({
        updates: Number(updateCount) || 0,
        blockers: Number(blockerCount) || 0,
        manpower: (agg?.rows || []).reduce(
          (sum, row) => sum + (Number(row?.sum_manpower_total ?? row?.manpower_total ?? 0) || 0),
          0,
        ),
      });
    } catch (e) {
      setLoadError(errorMessageOf(e, 'The daily activity could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, date, scope, refresh, quick.version]);

  const loadAllUpdates = async () => {
    setLoadingAll(true);
    try {
      const query = { project_id: projectId, update_date: date, voided: { $ne: true } };
      if (scope !== 'All') query.work_scope = scope;
      const all = await data.readAll('DailyUpdate', query, { sort: '-reported_at', max: 5000 });
      setRows(all.items);
    } catch (e) {
      setLoadError(errorMessageOf(e, 'The full list could not be loaded.'));
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const canReport = projectId ? access.can(projectId, 'edit_tasks') : false;

  const groups = useMemo(() => {
    const phases = [];
    rows.forEach((row) => {
      const phaseKey = row.phase_id || 'none';
      let phase = phases.find((p) => p.key === phaseKey);
      if (!phase) {
        phase = { key: phaseKey, label: cat.phaseById(phaseKey)?.name || 'No phase', works: [] };
        phases.push(phase);
      }
      const workKey = row.work_scope === 'Site-wide' ? 'site-wide' : row.location_id || 'unknown';
      let work = phase.works.find((w) => w.key === workKey);
      if (!work) {
        work = {
          key: workKey,
          label: row.work_scope === 'Site-wide' ? 'Site-wide works' : row.villa_code || 'Location',
          siteWide: row.work_scope === 'Site-wide',
          rows: [],
        };
        phase.works.push(work);
      }
      work.rows.push(row);
    });
    return phases;
  }, [rows, cat]);

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={CalendarDays}
          title="No project yet"
          description="Daily activity appears once you are a member of a project."
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Daily site execution"
        title="Daily activity"
        description="Everything reported on site for one day, villa by villa, with site-wide works alongside."
        actions={
          canReport && (
            <Button size="sm" className="gap-2" onClick={() => quick.openLogUpdate({ date })}>
              <Plus className="h-4 w-4" /> Report update
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Updates" value={summary.updates} />
        <Stat label="Manpower deployed" value={summary.manpower} />
        <Stat label="Blockers reported" value={summary.blockers} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <EnumSelect
          value={projectId}
          onChange={(v) => setProjectId(v)}
          options={cat.projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Project"
        />
        <div className="flex flex-wrap gap-3">
          <Input
            type="date"
            className="w-full sm:w-auto sm:min-w-[170px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {SCOPES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  scope === option
                    ? 'border-primary bg-secondary text-foreground'
                    : 'border-border text-muted-foreground',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AiUpdatePanel
          projectId={projectId}
          date={date}
          canReport={canReport}
          onSaved={() => setRefresh((n) => n + 1)}
        />
      </div>

      <div className="mt-6">
        {loadError ? (
          <DataState error={loadError} onRetry={load} />
        ) : loading ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={CalendarDays}
              title="Nothing reported for this day"
              description={
                canReport
                  ? 'Use “Report update” to file the first site report for this day.'
                  : 'Site reports filed on this day will appear here.'
              }
            />
          </div>
        ) : (
          <div className="space-y-8">
            <TruncationBanner shown={rows.length} total={summary.updates} noun="updates for this day" onLoadAll={loadAllUpdates} loading={loadingAll} />
            {groups.map((phase) => (
              <section key={phase.key} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {phase.label}
                  </h2>
                  <span className="h-px flex-1 bg-border" />
                </div>
                {phase.works.map((work) => (
                  <div key={work.key} className="space-y-2">
                    <h3 className="text-xs font-semibold">
                      {work.label}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {work.rows.length} update{work.rows.length === 1 ? '' : 's'}
                      </span>
                    </h3>
                    <div className="space-y-3">
                      {work.rows.map((row) => (
                        <DailyUpdateCard key={row.id} update={row} hideVilla />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>


    </>
  );
}