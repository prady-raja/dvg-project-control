import React, { useCallback, useEffect, useState } from 'react';
import { data } from '@/api/data';
import { errorMessageOf } from '@/lib/clientErrors';
import DataState from '@/components/common/DataState';
import BoardSection from '@/components/common/BoardSection';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';

/**
 * Data health for the administrator: the one-off backfills (dry run first, then
 * apply) and the latest errors caught in people's browsers.
 */
export default function DataTab() {
  const [state, setState] = useState({ loading: true, error: '', migrations: [], runs: [], errors: [] });
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [listing, errors] = await Promise.all([
        data.invoke('migrate', { action: 'list' }),
        data.list('ClientError', {}, { sort: '-occurred_at', limit: 15 }),
      ]);
      setState({ loading: false, error: '', migrations: listing.migrations || [], runs: listing.runs || [], errors });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errorMessageOf(e, 'The data panel could not be loaded.') }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id, dryRun) => {
    if (!dryRun && !window.confirm('Apply this backfill to the live records? Run the dry run first if you have not.')) return;
    setBusy(`${id}:${dryRun}`);
    try {
      const result = await data.invoke('migrate', { action: 'run', id, dryRun });
      setResults((r) => ({ ...r, [id]: result }));
      if (!dryRun) load();
    } catch (e) {
      setResults((r) => ({ ...r, [id]: { error: errorMessageOf(e) } }));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <DataState loading={state.loading} error={state.error} onRetry={load}>
        <BoardSection
          title="Backfills"
          description="One-off fixes to existing records. Each one previews first (a dry run writes nothing), can be run twice safely, and is logged when applied."
        >
          <ul className="divide-y divide-border">
            {state.migrations.map((m) => {
              const result = results[m.id];
              return (
                <li key={m.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="field-mono text-xs font-semibold">{m.id}</p>
                      <p className="text-sm text-muted-foreground">{m.description}</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(m.id, true)}>
                      {busy === `${m.id}:true` ? 'Checking…' : 'Dry run'}
                    </Button>
                    <Button size="sm" disabled={!!busy} onClick={() => run(m.id, false)}>
                      {busy === `${m.id}:false` ? 'Applying…' : 'Apply'}
                    </Button>
                  </div>
                  {result && (
                    <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                      {result.error ? (
                        <p className="text-destructive">{result.error}</p>
                      ) : (
                        <>
                          <p>
                            {result.dry_run ? 'Would change' : 'Changed'} {result.dry_run ? result.total : result.written} record(s)
                            {result.failed ? ` · ${result.failed} failed` : ''}.
                          </p>
                          {(result.samples || []).map((sample) => (
                            <p key={sample.id} className="field-mono mt-1 text-muted-foreground">
                              {sample.entity} {sample.id}: {Object.entries(sample.changes).map(([f, c]) => `${f} ${c.from ?? '∅'} → ${c.to}`).join(', ')}
                            </p>
                          ))}
                          {(result.errors || []).map((message) => <p key={message} className="mt-1 text-destructive">{message}</p>)}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {!!state.runs.length && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent runs</p>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {state.runs.map((run) => (
                  <li key={run.id}>{formatDateTime(run.run_at)} · {run.migration} · {run.written}/{run.planned} written{run.failed ? `, ${run.failed} failed` : ''} · {run.run_by}</li>
                ))}
              </ul>
            </div>
          )}
        </BoardSection>

        <BoardSection title="Latest errors from the app" description="Caught in people's browsers, newest first." className="mt-6">
          {!state.errors.length ? (
            <p className="text-sm text-muted-foreground">No errors recorded.</p>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {state.errors.map((row) => (
                <li key={row.id} className="py-2">
                  <p className="font-medium">{row.message}</p>
                  <p className="text-muted-foreground">
                    {formatDateTime(row.occurred_at)} · {row.user_email || 'unknown user'} · {row.source}
                    {row.user_note ? ` · “${row.user_note}”` : ''}
                  </p>
                  <p className="truncate text-muted-foreground">{row.url}</p>
                </li>
              ))}
            </ul>
          )}
        </BoardSection>
      </DataState>
    </div>
  );
}
