import React, { useCallback, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import PageHeader from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import ImportUploadStep from '@/components/import/ImportUploadStep';
import ImportSummary from '@/components/import/ImportSummary';
import ImportRowTable from '@/components/import/ImportRowTable';
import ImportConfirmDialog from '@/components/import/ImportConfirmDialog';
import ImportResultPanel from '@/components/import/ImportResultPanel';
import {
  MAX_FILE_BYTES,
  checksumOf,
  downloadReconciliation,
  downloadTemplate,
  runWorkImport,
} from '@/lib/workImportService';

/**
 * Import Works — reviewed CSV work lists in, permanent tasks out. Nothing is
 * written until the file has been previewed, corrected row by row and confirmed,
 * and every decision is re-checked on the server before it is applied.
 */
export default function WorkImport() {
  const cat = useCatalogs();
  const access = useAccess();

  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [decisions, setDecisions] = useState({});
  const [links, setLinks] = useState({});
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [busyRow, setBusyRow] = useState(0);
  const [error, setError] = useState('');

  const projects = useMemo(
    () => cat.projects.filter((project) => access.can(project.id, 'manage_project')),
    [cat.projects, access],
  );

  const previewFor = useCallback(
    async (target, nextOverrides, pid) => {
      if (!target?.text || !pid) return;
      setBusy('preview');
      setError('');
      try {
        const data = await runWorkImport({
          action: 'preview',
          project_id: pid,
          file_name: target.name,
          checksum: target.checksum,
          file_text: target.text,
          overrides: nextOverrides,
        });
        setPreview(data);
      } catch (caught) {
        setError(caught.message);
        setPreview(null);
      } finally {
        setBusy('');
      }
    },
    [],
  );

  const handleFile = async (text, name) => {
    if (!text) return;
    setResult(null);
    setError('');
    if (text.length > MAX_FILE_BYTES) {
      setError('That file is larger than 1.5 MB. Split the work list into smaller files.');
      return;
    }
    const target = { name, text, checksum: checksumOf(text) };
    setFile(target);
    setOverrides({});
    setDecisions({});
    setLinks({});
    await previewFor(target, {}, projectId);
  };

  const handleProject = async (value) => {
    setProjectId(value);
    setOverrides({});
    setDecisions({});
    setLinks({});
    setResult(null);
    if (file?.text && value) await previewFor(file, {}, value);
    else setPreview(null);
  };

  const applyOverride = async (rowNumber, patch) => {
    const next = { ...overrides, [rowNumber]: { ...(overrides[rowNumber] || {}), ...patch } };
    setOverrides(next);
    setBusyRow(rowNumber);
    await previewFor(file, next, projectId);
    setBusyRow(0);
    setDecisions((current) => ({ ...current, [rowNumber]: '' }));
  };

  const clearOverride = async (rowNumber) => {
    const next = { ...overrides };
    delete next[rowNumber];
    setOverrides(next);
    setBusyRow(rowNumber);
    await previewFor(file, next, projectId);
    setBusyRow(0);
  };

  const decide = (rowNumber, decision, linkId = '') => {
    setDecisions((current) => ({ ...current, [rowNumber]: decision }));
    setLinks((current) => ({ ...current, [rowNumber]: linkId }));
  };

  const counts = useMemo(() => {
    const rows = preview?.rows || [];
    let created = 0;
    let skipped = 0;
    let linked = 0;
    let attention = 0;
    rows.forEach((row) => {
      const decision = decisions[row.row_number] || '';
      if (decision === 'skip') {
        skipped += 1;
        return;
      }
      if (decision === 'link') {
        linked += 1;
        return;
      }
      if (row.blocking || !decision) {
        attention += 1;
        return;
      }
      created += 1;
    });
    return { created, skipped, linked, attention };
  }, [preview, decisions]);

  const commit = async () => {
    setBusy('commit');
    setError('');
    try {
      const data = await runWorkImport({
        action: 'commit',
        project_id: projectId,
        file_name: file.name,
        checksum: file.checksum,
        file_text: file.text,
        overrides,
        decisions,
        links,
      });
      setResult(data);
      setPreview(null);
      setConfirmOpen(false);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy('');
    }
  };

  const restart = () => {
    setFile(null);
    setPreview(null);
    setOverrides({});
    setDecisions({});
    setLinks({});
    setResult(null);
    setError('');
  };

  if (cat.loading || access.loading) return <Skeleton className="h-96 rounded-xl" />;

  const project = projects.find((item) => item.id === projectId);

  if (!projects.length) {
    return (
      <>
        <PageHeader
          eyebrow="Import Works"
          title="Import Works"
          description="Bring a reviewed CSV work list onto the task register."
        />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Import Works is available to Project Managers and administrators. You do not manage a project yet — your roles are
          shown on Users &amp; Access.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Import Works"
        title="Import Works"
        description="Upload a reviewed CSV work list, check every row, and create the tasks with permanent references."
        actions={
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
            <Upload className="h-4 w-4" /> Download CSV template
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {result ? (
        <ImportResultPanel
          result={result}
          projectName={project?.name || ''}
          onDownload={() => downloadReconciliation(result)}
          onRestart={restart}
        />
      ) : (
        <div className="space-y-5">
          <ImportUploadStep
            projects={projects}
            projectId={projectId}
            onProjectChange={handleProject}
            onFile={handleFile}
            onError={setError}
            busy={busy}
            file={file}
          />

          {preview && (
            <>
              <ImportSummary summary={preview.summary} priorBatches={preview.prior_batches} />

              <ImportRowTable
                rows={preview.rows}
                cat={cat}
                projectId={projectId}
                decisions={decisions}
                busyRow={busyRow}
                onOverride={applyOverride}
                onClearOverride={clearOverride}
                onDecision={decide}
              />

              <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
                <p className="text-xs text-muted-foreground">
                  {counts.created} task(s) will be created · {counts.skipped} skipped · {counts.linked} linked ·{' '}
                  {counts.attention} need attention
                  {preview.file?.unmapped?.length > 0 && <> · ignored columns: {preview.file.unmapped.join(', ')}</>}
                </p>
                <Button
                  className="gap-2"
                  disabled={!!busy || counts.created + counts.linked === 0}
                  onClick={() => {
                    setError('');
                    setConfirmOpen(true);
                  }}
                >
                  Review and import
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ImportConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        counts={counts}
        fileName={file?.name || ''}
        busy={busy === 'commit'}
        error={error}
        onConfirm={commit}
      />
    </>
  );
}