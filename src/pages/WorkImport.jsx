import React, { useCallback, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import PageHeader from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import ImportUploadStep from '@/components/import/ImportUploadStep';
import ImportSummary from '@/components/import/ImportSummary';
import ImportClassification from '@/components/import/ImportClassification';
import ImportRowTable from '@/components/import/ImportRowTable';
import ImportConfirmDialog from '@/components/import/ImportConfirmDialog';
import ImportResultPanel from '@/components/import/ImportResultPanel';
import {
  MAX_FILE_BYTES,
  checksumOf,
  downloadExcelTemplate,
  downloadReconciledWorkbook,
  downloadReconciliation,
  downloadTemplate,
  runWorkImport,
} from '@/lib/workImportService';

/**
 * Import Works — a reviewed Excel or CSV work list in, new tasks, agreed changes
 * to existing tasks and a record of what was left alone out. Nothing is written
 * until the file has been read, compared with the register row by row and
 * confirmed, and every accepted change is revalidated on the server before it is
 * applied.
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
  const [reasons, setReasons] = useState({});
  const [edits, setEdits] = useState({});
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [busyRow, setBusyRow] = useState(0);
  const [error, setError] = useState('');

  const projects = useMemo(
    () => cat.projects.filter((project) => access.can(project.id, 'manage_project')),
    [cat.projects, access],
  );

  // The chosen project's villa register, written into the Excel template's
  // Villa_Mapping sheet so a code is copied rather than retyped.
  const villas = useMemo(
    () =>
      cat.locations
        .filter((location) => location.project_id === projectId)
        .map((location) => ({
          code: location.villa_code,
          plots: location.plot_numbers,
          phase: (cat.phases.find((phase) => phase.id === location.phase_id) || {}).code || '',
          type: location.location_type,
        })),
    [cat.locations, cat.phases, projectId],
  );

  const previewFor = useCallback(
    async (target, { nextOverrides, nextLinks, useAi } = {}) => {
      if (!target?.text || !projectId) return;
      setBusy('preview');
      setError('');
      try {
        const data = await runWorkImport({
          action: 'preview',
          project_id: projectId,
          file_name: target.name,
          source_sheet: target.sheet || '',
          row_numbers: target.rowNumbers || [],
          checksum: target.checksum,
          file_text: target.text,
          overrides: nextOverrides || overrides,
          links: nextLinks || links,
          use_ai: useAi === true,
        });
        setPreview(data);
      } catch (caught) {
        setError(caught.message);
        setPreview(null);
      } finally {
        setBusy('');
      }
    },
    [projectId, overrides, links],
  );

  // A CSV arrives as text; an Excel workbook arrives already read from its Works
  // sheet, together with the worksheet row each row sits on. Both then travel the
  // identical server path.
  const handleFile = async (source) => {
    if (!source?.text) return;
    setResult(null);
    setError('');
    if (source.text.length > MAX_FILE_BYTES) {
      setError('That file is larger than 1.5 MB. Split the work list into smaller files.');
      return;
    }
    const target = {
      name: source.name,
      text: source.text,
      sheet: source.sheet || '',
      rowNumbers: source.rowNumbers || [],
      checksum: checksumOf(source.text),
    };
    setFile(target);
    setOverrides({});
    setDecisions({});
    setLinks({});
    setReasons({});
    setEdits({});
    await previewFor(target, { nextOverrides: {}, nextLinks: {} });
  };

  const handleProject = async (value) => {
    setProjectId(value);
    setOverrides({});
    setDecisions({});
    setLinks({});
    setReasons({});
    setEdits({});
    setResult(null);
    if (!file?.text || !value) {
      setPreview(null);
      return;
    }
    setBusy('preview');
    setError('');
    try {
      const data = await runWorkImport({
        action: 'preview',
        project_id: value,
        file_name: file.name,
        source_sheet: file.sheet || '',
        row_numbers: file.rowNumbers || [],
        checksum: file.checksum,
        file_text: file.text,
        overrides: {},
        links: {},
        use_ai: false,
      });
      setPreview(data);
    } catch (caught) {
      setError(caught.message);
      setPreview(null);
    } finally {
      setBusy('');
    }
  };

  const applyOverride = async (rowNumber, patch) => {
    const next = { ...overrides, [rowNumber]: { ...(overrides[rowNumber] || {}), ...patch } };
    setOverrides(next);
    setBusyRow(rowNumber);
    await previewFor(file, { nextOverrides: next });
    setBusyRow(0);
    setDecisions((current) => ({ ...current, [rowNumber]: '' }));
  };

  const clearOverride = async (rowNumber) => {
    const next = { ...overrides };
    delete next[rowNumber];
    setOverrides(next);
    setBusyRow(rowNumber);
    await previewFor(file, { nextOverrides: next });
    setBusyRow(0);
  };

  // Choosing which task a row belongs to changes what that row would change, so
  // the comparison is rebuilt from the server rather than adjusted on screen.
  const linkRow = async (rowNumber, taskId) => {
    const next = { ...links, [rowNumber]: taskId };
    setLinks(next);
    setBusyRow(rowNumber);
    await previewFor(file, { nextLinks: next });
    setBusyRow(0);
    setDecisions((current) => ({ ...current, [rowNumber]: '' }));
  };

  const decide = (rowNumber, decision, linkId = '') => {
    setDecisions((current) => ({ ...current, [rowNumber]: decision }));
    if (linkId) setLinks((current) => ({ ...current, [rowNumber]: linkId }));
  };

  const setReason = (rowNumber, text) => setReasons((current) => ({ ...current, [rowNumber]: text }));

  const setEdit = (rowNumber, field, value) =>
    setEdits((current) => ({ ...current, [rowNumber]: { ...(current[rowNumber] || {}), [field]: value } }));

  const acceptAllUpdates = () => {
    const next = { ...decisions };
    (preview?.rows || []).forEach((row) => {
      if (row.reconcile?.outcome === 'update' && row.reconcile.match.task_id) next[row.row_number] = 'update';
    });
    setDecisions(next);
  };

  const counts = useMemo(() => {
    const rows = preview?.rows || [];
    const total = { created: 0, updated: 0, unchanged: 0, rejected: 0, deferred: 0, linked: 0, attention: 0 };
    rows.forEach((row) => {
      const outcome = row.reconcile?.outcome || 'create';
      const decision = decisions[row.row_number] || (outcome === 'create' ? 'import' : outcome === 'unchanged' ? 'unchanged' : '');
      if (decision === 'import') total.created += 1;
      else if (decision === 'update') total.updated += 1;
      else if (decision === 'link') total.linked += 1;
      else if (decision === 'skip') total.rejected += 1;
      else if (decision === 'defer') total.deferred += 1;
      else if (decision === 'unchanged') total.unchanged += 1;
      else total.attention += 1;
    });
    total.writing = total.created + total.updated + total.linked;
    return total;
  }, [preview, decisions]);

  const commit = async () => {
    setBusy('commit');
    setError('');
    try {
      const data = await runWorkImport({
        action: 'commit',
        project_id: projectId,
        file_name: file.name,
        source_sheet: file.sheet || '',
        row_numbers: file.rowNumbers || [],
        checksum: file.checksum,
        file_text: file.text,
        overrides,
        decisions,
        links,
        reasons,
        edits,
        // The record version this comparison was made against, row by row: a task
        // edited in the meantime is refused rather than written over quietly.
        expected: Object.fromEntries(
          (preview?.rows || []).map((row) => [row.row_number, row.reconcile?.match?.updated_date || '']),
        ),
        ai_status: preview?.ai?.note || '',
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
    setReasons({});
    setEdits({});
    setResult(null);
    setError('');
  };

  const downloadWorkbook = async () => {
    setError('');
    try {
      await downloadExcelTemplate({
        villas,
        projectName: (projects.find((item) => item.id === projectId) || {}).name || '',
      });
    } catch (caught) {
      setError(caught.message);
    }
  };

  const downloadReconciled = async (source) => {
    setError('');
    try {
      await downloadReconciledWorkbook(source);
    } catch (caught) {
      setError(caught.message);
    }
  };

  if (cat.loading || access.loading) return <Skeleton className="h-96 rounded-xl" />;

  const project = projects.find((item) => item.id === projectId);

  if (!projects.length) {
    return (
      <>
        <PageHeader
          eyebrow="Import Works"
          title="Import Works"
          description="Bring a reviewed Excel or CSV work list onto the task register."
        />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Import Works is available to Project Editors and administrators. You do not manage a project yet — your roles are
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
        description="Upload a reviewed Excel workbook or CSV work list. Every row is compared with the register, and only the rows you decide on are written."
        actions={
          <>
            <Button className="gap-2" onClick={downloadWorkbook}>
              <FileSpreadsheet className="h-4 w-4" /> Download Excel template
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
              <FileText className="h-4 w-4" /> CSV template
            </Button>
          </>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {result ? (
        <ImportResultPanel
          result={result}
          projectName={project?.name || ''}
          onDownload={() => downloadReconciliation(result)}
          onDownloadWorkbook={() => downloadReconciled(result)}
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
              <ImportClassification
                reconciliation={preview.reconciliation}
                ai={preview.ai}
                busy={busy}
                onUseAi={() => previewFor(file, { useAi: true })}
                onDownloadWorkbook={() => downloadReconciled(preview)}
                onAcceptUpdates={acceptAllUpdates}
              />

              <ImportSummary summary={preview.summary} priorBatches={preview.prior_batches} />

              <ImportRowTable
                rows={preview.rows}
                cat={cat}
                projectId={projectId}
                decisions={decisions}
                reasons={reasons}
                edits={edits}
                busyRow={busyRow}
                onOverride={applyOverride}
                onClearOverride={clearOverride}
                onDecision={decide}
                onReason={setReason}
                onEdit={setEdit}
                onLink={linkRow}
              />

              <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
                <p className="text-xs text-muted-foreground">
                  {counts.created} new · {counts.updated} updated · {counts.unchanged} already correct · {counts.rejected}{' '}
                  rejected · {counts.deferred} deferred · {counts.attention} need a decision
                  {preview.file?.sheet && <> · worksheet <span className="field-mono">{preview.file.sheet}</span></>}
                  {preview.file?.unmapped?.length > 0 && <> · ignored columns: {preview.file.unmapped.join(', ')}</>}
                </p>
                <Button
                  className="gap-2"
                  disabled={!!busy || counts.attention > 0 || counts.created + counts.updated + counts.linked + counts.rejected + counts.deferred === 0}
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
        fileName={file ? `${file.name}${file.sheet ? ` · worksheet ${file.sheet}` : ''}` : ''}
        busy={busy === 'commit'}
        error={error}
        onConfirm={commit}
      />
    </>
  );
}