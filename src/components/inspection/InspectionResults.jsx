import React, { useCallback, useEffect, useState } from 'react';
import { data } from '@/api/data';
import { errorMessageOf } from '@/lib/clientErrors';
import { formatDate } from '@/lib/format';
import DataState from '@/components/common/DataState';
import { cn } from '@/lib/utils';

const ICON = { Pass: 'text-emerald-700', Fail: 'text-red-700', 'N/A': 'text-muted-foreground' };

/** Saved inspection checklists, newest first: who, when, and every item with its result. Read-only. */
export default function InspectionResults({ filter, refreshKey = 0, title = 'Inspection checklists' }) {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const key = JSON.stringify(filter);
  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      setRows(await data.list('InspectionChecklist', filter, { sort: '-completed_date', limit: 50 }));
      setState({ loading: false, error: '' });
    } catch (e) {
      setState({ loading: false, error: errorMessageOf(e, 'The checklists could not be loaded.') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (!state.loading && !state.error && !rows.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <DataState loading={state.loading} error={state.error} onRetry={load}>
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <details className="rounded-lg border border-border p-3">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{formatDate(c.completed_date)} · {c.completed_by_name}{c.snag_ref || c.task_ref ? ` · ${c.snag_ref || c.task_ref}` : ''}</span>
                  <span className={cn('font-medium', c.overall === 'Fail' ? 'text-red-700' : 'text-emerald-700')}>{c.overall === 'Fail' ? `Fail — ${c.fail_count} item${c.fail_count === 1 ? '' : 's'}` : 'Pass'}</span>
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {c.items.map((i) => (
                    <li key={i.text}><span className={cn('mr-2 font-medium', ICON[i.result])}>{i.result}</span>{i.text}{i.comment ? <span className="block pl-10 text-xs text-muted-foreground">{i.comment}</span> : null}</li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </DataState>
    </section>
  );
}
