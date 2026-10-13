import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, History, RotateCcw, Upload } from 'lucide-react';
import { data } from '@/api/data';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { errorMessageOf } from '@/lib/clientErrors';
import { formatDateTime } from '@/lib/format';
import { downloadReconciliation } from '@/lib/workImportService';
import PageHeader from '@/components/common/PageHeader';
import DataState from '@/components/common/DataState';
import EnumSelect from '@/components/common/EnumSelect';
import Pill from '@/components/common/Pill';
import FormDialog from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { useScopeState } from '@/lib/ScopeContext';

const resultFromBatch = (batch) => {
  const rows = batch.report || [];
  const of = (outcome) => rows.filter((r) => r.outcome === outcome);
  return {
    batch_ref: batch.batch_ref,
    batch,
    created: of('created'), updated: of('updated'), unchanged: of('unchanged'),
    rejected: of('rejected'), deferred: of('deferred'), linked: of('linked'), failed: of('failed'),
  };
};

/** Every import on a project, who ran it, what it did — and a one-click undo with a preview. */
export default function ImportHistory() {
  const cat = useCatalogs();
  const access = useAccess();
  const [projectId, setProjectId] = useScopeState();
  const [state, setState] = useState({ loading: false, error: '', batches: [] });
  const [undoing, setUndoing] = useState(null);

  useEffect(() => {
    if (projectId || !cat.projects.length) return;
    setProjectId(cat.projects.find((p) => p.status === 'Active')?.id || cat.projects[0].id);
  }, [cat.projects, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const { items } = await data.readAll('ImportBatch', { project_id: projectId }, { sort: '-imported_at', max: 500 });
      setState({ loading: false, error: '', batches: items });
    } catch (e) {
      setState({ loading: false, error: errorMessageOf(e, 'The import history could not be loaded.'), batches: [] });
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const canUndo = projectId && access.can(projectId, 'manage_project');

  return (
    <>
      <PageHeader
        eyebrow="Import & history"
        title="Import history"
        description="Every work list brought onto the register. A batch can be undone: what it created is archived and what it changed is put back, except where the work has been edited since."
        actions={
          <Button asChild className="gap-2">
            <Link to="/import"><Upload className="h-4 w-4" /> New import</Link>
          </Button>
        }
      />
      <div className="mb-4 max-w-xs lg:hidden">
        <EnumSelect value={projectId} onChange={setProjectId} options={cat.projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Project" />
      </div>
      <DataState
        loading={state.loading}
        error={state.error}
        onRetry={load}
        empty={!state.batches.length}
        emptyIcon={History}
        emptyTitle="No imports yet"
        emptyDescription="Imports on this project will be listed here, newest first."
      >
        <ul className="space-y-3">
          {state.batches.map((batch) => (
            <li key={batch.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="field-mono text-xs font-semibold">{batch.batch_ref}</p>
                  <p className="truncate text-sm">{batch.source_file}{batch.source_sheet ? ` · ${batch.source_sheet}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{batch.imported_by_name} · {formatDateTime(batch.imported_at)}</p>
                </div>
                <Pill value={batch.status === 'Completed' ? 'Active' : batch.status} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {batch.row_count} rows · {batch.created_count || 0} created · {batch.updated_count || 0} updated · {batch.unchanged_count || 0} already correct ·{' '}
                {batch.skipped_count || 0} rejected · {batch.deferred_count || 0} deferred · {batch.failed_count || 0} failed
              </p>
              {batch.status === 'Undone' && (
                <p className="mt-1 text-xs text-muted-foreground">Undone by {batch.undone_by_name} on {formatDateTime(batch.undone_at)}.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadReconciliation(resultFromBatch(batch))}>
                  <Download className="h-3.5 w-3.5" /> Report
                </Button>
                {canUndo && ['Completed', 'Completed with exceptions'].includes(batch.status) && (batch.created_count || batch.updated_count) > 0 && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setUndoing(batch)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Undo batch
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DataState>
      <UndoDialog batch={undoing} onClose={() => setUndoing(null)} onDone={load} />
    </>
  );
}

function UndoDialog({ batch, onClose, onDone }) {
  const [state, setState] = useState({ loading: false, error: '', preview: null, result: null });
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!batch) return;
    setState({ loading: true, error: '', preview: null, result: null });
    data.invoke('importUndo', { action: 'preview', batch_id: batch.id })
      .then((preview) => setState({ loading: false, error: '', preview, result: null }))
      .catch((e) => setState({ loading: false, error: errorMessageOf(e), preview: null, result: null }));
  }, [batch]);

  const apply = async () => {
    setApplying(true);
    try {
      const result = await data.invoke('importUndo', { action: 'apply', batch_id: batch.id });
      setState((s) => ({ ...s, result, error: '' }));
      await onDone();
    } catch (e) {
      setState((s) => ({ ...s, error: errorMessageOf(e) }));
    } finally {
      setApplying(false);
    }
  };

  const summary = state.preview?.summary;
  const done = state.result;
  return (
    <FormDialog
      open={!!batch}
      onOpenChange={(v) => !v && onClose()}
      title={`Undo ${batch?.batch_ref || ''}`}
      description="Nothing changes until you confirm. Work edited since the import is left as it is."
      onSubmit={done ? onClose : apply}
      submitting={applying || state.loading}
      submitLabel={done ? 'Close' : 'Undo this import'}
      error={state.error}
      size="sm:max-w-xl"
    >
      {state.loading && <p className="text-sm text-muted-foreground">Checking what can be undone…</p>}
      {summary && !done && (
        <div className="space-y-2 text-sm">
          <p><strong>{summary.archive}</strong> task(s) created by this import will be archived.</p>
          <p><strong>{summary.revert}</strong> task(s) changed by this import will have their values put back.</p>
          <p><strong>{summary.skipped}</strong> will be left alone because they changed since.</p>
          {state.preview.plan.skipped.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-xs text-muted-foreground">
              {state.preview.plan.skipped.slice(0, 40).map((s) => (
                <li key={`${s.row_number}-${s.task_id}`}><span className="field-mono">{s.task_ref || `row ${s.row_number}`}</span> — {s.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {done && (
        <div className="space-y-1 text-sm">
          <p>Archived {done.archived}, put back {done.reverted}, left alone {done.skipped?.length || 0}.</p>
          {done.partial && <p className="text-destructive">{done.failed.length} could not be undone; the batch stays open so you can try again.</p>}
        </div>
      )}
    </FormDialog>
  );
}
