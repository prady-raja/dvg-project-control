import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, Grid3x3 } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { todayIst, formatDate } from '@/lib/format';
import { useDashboardQuery } from '@/hooks/useDashboardQuery';
import { buildWorkbookFromSheets } from '@/lib/xlsxImport';
import { downloadBlob } from '@/lib/workImportService';
import PageHeader from '@/components/common/PageHeader';
import DataState from '@/components/common/DataState';
import DataCaveats from '@/components/common/DataCaveats';
import EnumSelect from '@/components/common/EnumSelect';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import TaskDrilldownDialog from '@/components/dashboard/TaskDrilldownDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const CELL_TONE = {
  Stuck: 'border-red-300 bg-red-50 text-red-900',
  Active: 'border-sky-300 bg-sky-50 text-sky-900',
  'To do': 'border-slate-300 bg-slate-50 text-slate-800',
  Verify: 'border-violet-300 bg-violet-50 text-violet-900',
  Done: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

const forecastText = (f) => {
  if (f.state === 'complete') return 'No pending works';
  if (f.state === 'not_scheduled') return `Not scheduled (${f.undated} undated)`;
  return `${formatDate(f.date)}${f.undated ? ` · ${f.undated} undated` : ''}`;
};

/**
 * Villa x discipline matrix (D-02): every villa on one screen — possession, each
 * trade's state, and when its pending works are expected to be complete. Each
 * cell opens the tasks behind it; nothing is estimated.
 */
export default function VillaMatrix() {
  const cat = useCatalogs();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [date, setDate] = useState(todayIst());
  const [possession, setPossession] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    setProjectId(cat.projects.find((p) => p.status === 'Active')?.id || cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  const params = { projectId, phaseId, date, possession, contractorId };
  const { data, isLoading, error, refetch } = useDashboardQuery('matrix', params, { enabled: !!projectId });
  const phases = projectId ? cat.phasesFor(projectId) : [];

  const exportExcel = async () => {
    const head = ['Villa', 'Phase', 'Possession', 'Possession date', 'Open', 'Blocked', 'Overdue', 'Waiting on owner access', 'Forecast label', 'Forecast date', 'Slip vs planned (days)',
      ...data.disciplines.flatMap((d) => [`${d.name} open`, `${d.name} closed`])];
    const rows = data.rows.map((r) => [
      r.villa, r.phase, r.possession_status, r.possession_date, r.open, r.blocked, r.overdue, r.owner_access, r.forecast.label, r.forecast.date || forecastText(r.forecast), r.forecast.slip_days ?? '',
      ...data.disciplines.flatMap((d) => [r.cells[d.code]?.open ?? '', r.cells[d.code]?.closed ?? '']),
    ]);
    downloadBlob(`villa-matrix-${data.as_of}.xlsx`, await buildWorkbookFromSheets({ 'Villa matrix': [head, ...rows] }));
  };

  const view = data;
  const columns = useMemo(() => view?.disciplines || [], [view]);

  if (cat.loading) return <DataState loading />;

  return (
    <>
      <PageHeader
        eyebrow="Home"
        title="Villa matrix"
        description="Every villa and every trade on one screen. Each cell opens the tasks behind it; dates shown are the latest recorded finish, never an estimate."
        actions={view && <Button variant="outline" size="sm" className="gap-2" onClick={exportExcel}><Download className="h-4 w-4" /> Export to Excel</Button>}
      />

      <DashboardFilters
        projects={cat.projects}
        phases={phases}
        projectId={projectId}
        phaseId={phaseId}
        date={date}
        onProject={(v) => { setProjectId(v); setPhaseId(''); setContractorId(''); }}
        onPhase={setPhaseId}
        onDate={setDate}
      >
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Possession</Label>
          <EnumSelect className="mt-1.5" value={possession} onChange={setPossession}
            options={[{ value: '', label: 'All villas' }, { value: 'Handed Over', label: 'Handed over' }, { value: 'Not Handed Over', label: 'With DVG' }]} />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Contractor</Label>
          <EnumSelect className="mt-1.5" value={contractorId} onChange={setContractorId}
            options={[{ value: '', label: 'All contractors' }, ...cat.contractors.filter((c) => c.active !== false).map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
      </DashboardFilters>

      <div className="mt-5">
        <DataState loading={isLoading} error={error ? error.message : ''} onRetry={refetch} empty={view && !view.rows.length} emptyIcon={Grid3x3} emptyTitle="No villas match" emptyDescription="Change the filters, or register villas and tasks first." rows={6}>
          {view && (
            <div className="space-y-4">
              <DataCaveats items={view.warnings} />
              <p className="text-xs text-muted-foreground">
                {view.totals.villas} villas · {view.totals.handed_over_with_open_works} handed over with open works · {view.totals.open} open tasks · {view.totals.blocked} blocked · {view.totals.overdue} overdue.
                {' '}Colours also say what they mean: {view.legend.map((l) => `${l.category} = ${l.meaning}`).join('; ')}.
              </p>
              <div className="scroll-slim overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="sticky left-0 z-10 bg-card px-3 py-2.5">Villa</th>
                      <th className="px-3 py-2.5">Possession</th>
                      {columns.map((d) => <th key={d.code} className="px-2 py-2.5 text-center">{d.name}</th>)}
                      <th className="px-3 py-2.5">Pending works</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((r) => (
                      <tr key={r.location_id} className="border-b border-border/60 align-top last:border-0">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2">
                          <Link to={`/locations/${r.location_id}`} className="font-semibold hover:underline">{r.villa}</Link>
                          <div className="text-[11px] text-muted-foreground">{r.phase}{r.on_hold ? ' · on hold' : ''}</div>
                          <Link to={`/villas/${r.location_id}/statement`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"><FileText className="h-3 w-3" /> Statement</Link>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.possession_status === 'Handed Over' ? 'Handed over' : 'With DVG'}
                          {r.possession_date && <div className="text-muted-foreground">{formatDate(r.possession_date)}</div>}
                          {r.possession_status === 'Handed Over' && r.open > 0 && <div className="font-semibold text-amber-800">{r.open} open</div>}
                        </td>
                        {columns.map((d) => {
                          const c = r.cells[d.code];
                          if (!c) return <td key={d.code} className="px-1.5 py-2 text-center text-muted-foreground">—</td>;
                          return (
                            <td key={d.code} className="px-1.5 py-2">
                              <button
                                type="button"
                                onClick={() => setDrill({ filters: { projectId, phaseId, date, metric: 'all_tasks', locationId: r.location_id, discipline: d.code }, title: `${r.villa} · ${d.name}` })}
                                className={cn('w-full min-w-[84px] rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight', CELL_TONE[c.category])}
                                aria-label={`${r.villa} ${d.name}: ${c.category}, ${c.open} open, ${c.closed} closed`}
                              >
                                <span className="block font-semibold">{c.category}</span>
                                <span className="block">{c.open} open · {c.closed} done</span>
                                {c.percent !== null && <span className="block">{c.percent}% measured</span>}
                                {(c.blocked > 0 || c.overdue > 0 || c.owner_access > 0) && (
                                  <span className="mt-0.5 block font-medium">
                                    {c.blocked > 0 && `${c.blocked} blocked `}{c.overdue > 0 && `${c.overdue} overdue `}{c.owner_access > 0 && `${c.owner_access} owner access`}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-xs">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.forecast.label}</div>
                          <div className="font-medium">{forecastText(r.forecast)}</div>
                          {r.forecast.slip_days !== null && r.forecast.slip_days !== 0 && (
                            <div className={r.forecast.slip_days > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                              {r.forecast.slip_days > 0 ? `${r.forecast.slip_days}d after` : `${Math.abs(r.forecast.slip_days)}d before`} planned completion
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DataState>
      </div>

      <TaskDrilldownDialog open={!!drill} onOpenChange={(v) => !v && setDrill(null)} title={drill?.title || ''} filters={drill?.filters} />
    </>
  );
}
