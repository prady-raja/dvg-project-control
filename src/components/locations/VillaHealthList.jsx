import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDashboardQuery } from '@/hooks/useDashboardQuery';
import { matchesPlotRef } from '@/lib/plotSearch';
import { formatDate } from '@/lib/format';
import DataState from '@/components/common/DataState';
import Pill from '@/components/common/Pill';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

const Count = ({ label, value, tone }) => (
  <div className="text-center">
    <p className={cn('field-mono text-sm font-semibold tnum', value && tone === 'danger' && 'text-destructive', value && tone === 'warning' && 'text-[hsl(var(--warning))]')}>{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

/**
 * The Villas list with health at a glance (L-04): progress (only when measured),
 * open / blocked / overdue / snags, possession, engineer, forecast with its slip
 * and the last report date, riskiest first. Search forgives "b5" for "B-05".
 */
export default function VillaHealthList({ projectId, phaseId, filters }) {
  const [term, setTerm] = useState('');
  const { user } = useAuth();
  const me = user?.id || '';
  const { data, isLoading, error, refetch } = useDashboardQuery('villaList', { projectId, phaseId }, { enabled: true });
  const rows = useMemo(() => (data?.rows || []).filter((r) =>
    (!filters.location_type || r.location_type === filters.location_type)
    && (!filters.possession_status || r.possession_status === filters.possession_status)
    && (!filters.active_status || r.active_status === filters.active_status)
    && (!filters.mine || (me && r.engineer_user_id === me))
    && (!filters.overdue || r.overdue > 0)
    && (!filters.blocked || r.blocked > 0)
    && matchesPlotRef(term, r)), [data, filters, term, me]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find a villa: B-05, b5 or a plot number…" className="pl-9" aria-label="Find a villa" />
      </div>
      <DataState loading={isLoading} error={error} onRetry={refetch} empty={!!data && !rows.length} emptyTitle="No villa matches" emptyDescription="Try fewer letters, or clear the filters above.">
        <p className="mb-2 text-xs text-muted-foreground">
          {rows.length} location{rows.length === 1 ? '' : 's'} · riskiest first
          {data?.totals?.handed_over_with_open_works ? ` · ${data.totals.handed_over_with_open_works} handed over with open works` : ''}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.location_id}>
              <Link to={`/locations/${r.location_id}`} className={cn('block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40', r.handed_over_open ? 'border-[hsl(var(--warning))]/50' : 'border-border')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="field-mono text-sm font-semibold">{r.villa}</p>
                    <p className="truncate text-xs text-muted-foreground">{[r.phase, r.plot_numbers && `plots ${r.plot_numbers}`, r.engineer].filter(Boolean).join(' · ') || r.location_type}</p>
                  </div>
                  <Pill value={r.possession_status} />
                </div>
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded bg-muted" role="img" aria-label={r.percent === null ? 'Progress not measured' : `${r.percent}% complete`}>
                    {r.percent !== null && <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, r.percent))}%` }} />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.percent === null ? 'Progress not measured' : `${r.percent}% complete`}</p>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  <Count label="Open" value={r.open} />
                  <Count label="Blocked" value={r.blocked} tone="danger" />
                  <Count label="Overdue" value={r.overdue} tone="danger" />
                  <Count label="Snags" value={r.snags_open} tone="warning" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {r.forecast.date ? <>{r.forecast.label}: <span className="text-foreground">{formatDate(r.forecast.date)}</span>{r.forecast.slip_days > 0 ? <span className="text-destructive"> (+{r.forecast.slip_days}d)</span> : null}</> : r.open ? 'No dated task, no forecast' : 'No open work'}
                </p>
                <p className={cn('text-xs', r.stale ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                  {r.last_report_date ? `Last report ${formatDate(r.last_report_date)}${r.stale ? ' — overdue for an update' : ''}` : r.open ? 'Never reported' : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
}
