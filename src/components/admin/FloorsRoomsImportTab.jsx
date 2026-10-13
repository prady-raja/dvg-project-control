import React, { useMemo, useState } from 'react';
import { data } from '@/api/data';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import BoardSection from '@/components/common/BoardSection';
import EnumSelect from '@/components/common/EnumSelect';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EXCEL_EXTENSION } from '@/lib/xlsxImport';
import { downloadText } from '@/lib/reportExport';
import { todayIst } from '@/lib/format';
import { errorMessageOf } from '@/lib/clientErrors';
import {
  executePlan, planRegistration, plansAgree, readFloorsRoomsWorkbook, resultCsv,
} from '@/lib/floorsRoomsImport';

const Stat = ({ label, value, tone }) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3">
    <p className={`field-mono text-2xl font-semibold tnum ${tone || ''}`}>{value}</p>
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
  </div>
);

/** Reads the register of the chosen project, fresh each time. */
async function loadRegister(projectId) {
  const [floors, areas] = await Promise.all([
    data.readAll('VillaFloor', { project_id: projectId }),
    data.readAll('VillaArea', { project_id: projectId }),
  ]);
  if (floors.truncated || areas.truncated) throw new Error('The register is too large to compare safely. Nothing was read.');
  return { floors: floors.items, areas: areas.items };
}

/**
 * Floors & rooms import: upload the plan-approved workbook, review exactly what
 * would be created, then confirm. Preview writes nothing. Administrator only; the
 * server refuses anyone else.
 */
export default function FloorsRoomsImportTab() {
  const cat = useCatalogs();
  const access = useAccess();
  const [projectId, setProjectId] = useState('');
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [run, setRun] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const adminName = access.user?.full_name || access.user?.email || '';
  const projects = useMemo(() => cat.projects.map((p) => ({ value: p.id, label: p.name })), [cat.projects]);
  const villas = useMemo(() => cat.locations.filter((l) => l.project_id === projectId), [cat.locations, projectId]);

  const buildPlan = async (source = parsed, project = projectId) => {
    const register = await loadRegister(project);
    return planRegistration({
      parsed: source, villas: cat.locations.filter((l) => l.project_id === project),
      floors: register.floors, areas: register.areas, adminName, today: todayIst(),
    });
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setRun(null); setPlan(null); setParsed(null);
    if (!projectId) { setError('Choose the project first.'); return; }
    if (!EXCEL_EXTENSION.test(file.name)) { setError('Upload an Excel workbook (.xlsx).'); return; }
    setBusy('read');
    try {
      const read = await readFloorsRoomsWorkbook(file);
      if (read.problems.length) throw new Error(read.problems.join(' '));
      setParsed(read);
      setFileName(file.name);
      setPlan(await buildPlan(read));
    } catch (caught) {
      setError(errorMessageOf(caught, 'The workbook could not be read.'));
    } finally {
      setBusy('');
    }
  };

  const confirm = async () => {
    setConfirmOpen(false);
    setError('');
    setBusy('write');
    try {
      // Re-read the register: if it moved since the preview, stop and show the new preview.
      const fresh = await buildPlan();
      if (!plansAgree(plan, fresh)) {
        setPlan(fresh);
        setError('The register changed since the preview. Nothing was written; review the refreshed preview and confirm again.');
        return;
      }
      setProgress({ done: 0, total: fresh.totals.floors_create + fresh.totals.rooms_create });
      const outcome = await executePlan(fresh, { onProgress: setProgress });
      setRun({ ...outcome, plan: fresh });
      setPlan(fresh);
    } catch (caught) {
      setError(errorMessageOf(caught, 'The import stopped.'));
    } finally {
      setBusy('');
    }
  };

  const t = plan?.totals;
  const toCreate = t ? t.floors_create + t.rooms_create : 0;
  const shown = run?.plan || plan;

  return (
    <BoardSection
      title="Floors & rooms import"
      description="Register the plan-approved floors and rooms from the workbook (Floors_To_Register and Rooms_To_Register only). The preview writes nothing; records are only created when you confirm. Floors and rooms are archived, never deleted, so check the preview carefully."
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium">Project</p>
            <EnumSelect value={projectId} onChange={(id) => { setProjectId(id); setPlan(null); setParsed(null); setRun(null); }} options={projects} placeholder="Choose the project" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium">Workbook (.xlsx)</p>
            <input type="file" accept=".xlsx" onChange={onFile} disabled={!!busy || !projectId} aria-label="Upload the floors and rooms workbook" className="block w-full text-sm" />
            {fileName && <p className="mt-1 text-xs text-muted-foreground">{fileName} · {villas.length} villas in this project</p>}
          </div>
        </div>

        {busy === 'read' && <p className="text-sm text-muted-foreground">Reading the workbook and the register…</p>}
        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        {shown && (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Floors to create" value={shown.totals.floors_create} />
              <Stat label="Floors already there" value={shown.totals.floors_exist} />
              <Stat label="Rooms to create" value={shown.totals.rooms_create} />
              <Stat label="Rooms already there" value={shown.totals.rooms_exist} />
              <Stat label='Marked "No"' value={shown.totals.skipped_no} />
              <Stat label="Errors" value={shown.totals.errors} tone={shown.totals.errors ? 'text-destructive' : ''} />
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="tnum">{shown.totals.need_decision}</strong> room rows in Rooms_Need_Decision are not registered; these rows will import unassigned.
            </p>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{['Villa', 'Floors to create', 'Floors skipped', 'Rooms to create', 'Rooms skipped', 'No', 'Errors'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.villas.map((v) => (
                    <tr key={v.villa} className="border-t border-border">
                      <td className="px-3 py-1.5 font-medium">{v.villa}</td>
                      <td className="px-3 py-1.5 tnum">{v.floors_create}</td><td className="px-3 py-1.5 tnum">{v.floors_exist}</td>
                      <td className="px-3 py-1.5 tnum">{v.rooms_create}</td><td className="px-3 py-1.5 tnum">{v.rooms_exist}</td>
                      <td className="px-3 py-1.5 tnum">{v.skipped_no}</td>
                      <td className={`px-3 py-1.5 tnum ${v.errors ? 'text-destructive' : ''}`}>{v.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {shown.totals.errors > 0 && (
              <details open className="rounded-xl border border-destructive/30 p-3">
                <summary className="cursor-pointer text-sm font-medium text-destructive">Error rows ({shown.totals.errors}): not created</summary>
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-xs">
                  {shown.items.filter((i) => i.outcome === 'error').map((i) => (
                    <li key={`${i.sheet}-${i.excel_row}`}><span className="field-mono">{i.sheet} row {i.excel_row}</span> · {i.villa || '—'} · {i.name || '—'}: {i.reason}</li>
                  ))}
                </ul>
              </details>
            )}

            {busy === 'write' && progress && (
              <div role="status" aria-live="polite">
                <Progress value={progress.total ? (progress.done / progress.total) * 100 : 100} />
                <p className="mt-1 text-xs text-muted-foreground">Creating {progress.done} of {progress.total}…</p>
              </div>
            )}

            {run && (
              <div role="status" className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
                {run.created_floors + run.created_rooms === 0 && run.failed === 0 ? (
                  <p className="font-medium">Nothing to create: everything in this workbook is already registered.</p>
                ) : (
                  <p className="font-medium">Created {run.created_floors} floors and {run.created_rooms} rooms. {run.failed} failed.</p>
                )}
                <p className="mt-1 text-muted-foreground">
                  Skipped as already registered: {shown.totals.floors_exist} floors, {shown.totals.rooms_exist} rooms · skipped as "No": {shown.totals.skipped_no} · error rows: {shown.totals.errors}.
                </p>
                {run.failed > 0 && (
                  <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-xs text-destructive">
                    {run.results.filter((r) => r.outcome === 'failed').map((r) => (
                      <li key={`${r.item.sheet}-${r.item.excel_row}`}>{r.item.sheet} row {r.item.excel_row} · {r.item.villa} · {r.item.name}: {r.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setConfirmOpen(true)} disabled={!!busy || toCreate === 0 || !!run}>
                {toCreate === 0 ? 'Nothing to create' : `Create ${t.floors_create} floors and ${t.rooms_create} rooms`}
              </Button>
              <Button variant="outline" onClick={() => downloadText(`floors-rooms-${run ? 'result' : 'preview'}-${todayIst()}.csv`, resultCsv(shown, run), 'text/csv;charset=utf-8')}>
                Download CSV
              </Button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Create ${t?.floors_create || 0} floors and ${t?.rooms_create || 0} rooms?`}
        description="These records cannot be deleted, only archived. Floors are created first, then rooms. Existing records are not touched."
        confirmLabel="Create" destructive={false}
        onConfirm={confirm}
      />
    </BoardSection>
  );
}
