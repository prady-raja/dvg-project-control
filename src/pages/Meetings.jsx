import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Copy, Download, Plus, Printer, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { formatDate, todayIst } from '@/lib/format';
import { useCatalogs } from '@/lib/CatalogContext';
import { useAccess } from '@/lib/AccessContext';
import { loadDashboard } from '@/lib/dashboardService';
import { aiMeetingBrief } from '@/lib/aiService';
import { ACTIVITY_COLUMNS, copyText, downloadText, toCsv, todayStamp } from '@/lib/reportExport';
import { updateRecord } from '@/lib/recordService';
import PageHeader from '@/components/common/PageHeader';
import BoardSection from '@/components/common/BoardSection';
import DataCaveats from '@/components/common/DataCaveats';
import EmptyState from '@/components/common/EmptyState';
import MeetingReportView from '@/components/meetings/MeetingReportView';
import CommitmentDialog from '@/components/meetings/CommitmentDialog';
import CommitmentList from '@/components/meetings/CommitmentList';
import AiPanel from '@/components/ai/AiPanel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

/** Stage A / 7 and Stage B / 13 — contractor meeting reports and commitments. */
export default function Meetings() {
  const cat = useCatalogs();
  const access = useAccess();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayIst());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commitOpen, setCommitOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (cat.loading || projectId || !cat.projects.length) return;
    const fromUrl = new URLSearchParams(window.location.search).get('project');
    setProjectId(cat.projects.some((p) => p.id === fromUrl) ? fromUrl : cat.projects[0].id);
  }, [cat.loading, cat.projects, projectId]);

  const load = useCallback(async () => {
    if (!projectId || !contractorId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await loadDashboard('meeting', { projectId, phaseId, contractorId, meetingDate });
      setReport(payload);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not prepare the meeting report.');
    } finally {
      setLoading(false);
    }
  }, [projectId, phaseId, contractorId, meetingDate]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const phases = projectId ? cat.phasesFor(projectId) : [];
  const contractors = cat.contractors.filter((c) => c.active !== false);
  const contractor = cat.contractorById(contractorId);
  const canManage = projectId ? access.can(projectId, 'manage_project') : false;
  const commitments = report?.commitments || [];

  const reportText = () => {
    if (!report) return '';
    const lines = [
      `Contractor meeting report`,
      `Project: ${report.scope?.project || ''}${report.scope?.phase ? ` / ${report.scope.phase}` : ''}`,
      `Contractor: ${report.scope?.contractor || ''}`,
      `Meeting date: ${formatDate(report.meeting_date)} · prepared from records as at ${report.as_of}`,
      '',
      `Outstanding ${report.counts?.outstanding} · overdue ${report.counts?.overdue} · due within 7 days ${report.counts?.due_7} · blockers ${report.counts?.blocked} · dependencies on others ${report.counts?.dependencies_on_others} · pending decisions ${report.counts?.pending_decisions} · unresolved commitments ${report.counts?.unresolved_commitments}`,
      '',
      'OUTSTANDING WORKS BY VILLA',
    ];
    (report.by_villa || []).forEach((group) => {
      lines.push(`- ${group.villa} (${group.rows.length} open)`);
      group.rows.forEach((row) => lines.push(`    ${row.ref} · ${row.name} · ${row.status} · forecast ${formatDate(row.forecast_finish)}${row.blocker ? ` · blocker: ${row.blocker}` : ''}`));
    });
    lines.push('', 'OVERDUE');
    (report.overdue || []).forEach((row) => lines.push(`- ${row.ref} ${row.villa} · ${row.name} · ${row.overdue_days} day(s) late`));
    lines.push('', 'DUE IN THE NEXT 7 DAYS');
    (report.due_7 || []).forEach((row) => lines.push(`- ${row.ref} ${row.villa} · ${row.name} · due ${formatDate(row.forecast_finish)}`));
    lines.push('', 'BLOCKERS');
    (report.blockers || []).forEach((row) => lines.push(`- ${row.ref} ${row.villa} · ${row.blocker || row.name} · owner ${row.blocker_responsible || 'not stated'}`));
    lines.push('', 'DEPENDENCIES ON OTHER CONTRACTORS');
    (report.dependencies_on_others || []).forEach((row) => lines.push(`- ${row.ref} ${row.villa} · ${row.dependency_type} · ${row.dependent_on}${row.dependent_on_ref ? ` (${row.dependent_on_ref})` : ''}`));
    lines.push('', 'PENDING MANAGEMENT DECISIONS');
    (report.pending_decisions || []).forEach((row) => lines.push(`- ${row.ref} ${row.villa} · ${(row.decisions || []).join('; ')}`));
    lines.push('', 'UNRESOLVED PREVIOUS COMMITMENTS');
    (report.unresolved_commitments || []).forEach((row) => lines.push(`- ${row.task_ref || ''} promised ${formatDate(row.promised_date)} · ${row.commitment}`));
    lines.push('', 'COMMITMENT REGISTER');
    commitments.forEach((row) => lines.push(`- ${formatDate(row.meeting_date)} · ${row.task_ref || ''} · ${row.status} · ${row.commitment}`));
    return lines.join('\n');
  };

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!cat.projects.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState icon={CalendarClock} title="No project yet" description="Meeting reports appear once you are a member of a project." />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Contractor meetings"
        title="Prepare contractor meeting"
        description="A conventional report built from the register, with AI available to prepare the same meeting as a brief — both read the same records."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRefresh((n) => n + 1)} disabled={!report}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {canManage && (
              <Button size="sm" className="gap-2" disabled={!contractorId} onClick={() => setCommitOpen(true)}>
                <Plus className="h-4 w-4" /> Record commitment
              </Button>
            )}
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Project</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPhaseId('');
              }}
            >
              {cat.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Phase</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
            >
              <option value="">All phases</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contractor</p>
            <select
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
            >
              <option value="">Choose a contractor</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.trade ? ` — ${c.trade}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Meeting date</p>
            <input
              type="date"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!contractorId ? (
        <div className="mt-5 rounded-xl border border-border bg-card">
          <EmptyState
            icon={CalendarClock}
            title="Choose a contractor"
            description="Pick the contractor and meeting date, and the report is prepared from the works register for that scope."
          />
        </div>
      ) : loading ? (
        <Skeleton className="mt-5 h-96 rounded-xl" />
      ) : error ? (
        <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                const ok = await copyText(reportText());
                toast({ description: ok ? 'Meeting report copied.' : 'Copying was blocked by the browser.' });
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy report
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadText(
                  `meeting-${contractor?.name || 'report'}-${meetingDate}.csv`,
                  toCsv(report.overdue || [], ACTIVITY_COLUMNS),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download className="h-3.5 w-3.5" /> Export overdue (CSV)
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <span className="self-center text-xs text-muted-foreground">
              Prepared {todayStamp()} · figures as at {report.as_of}
            </span>
          </div>

          <DataCaveats items={report.warnings} />

          <MeetingReportView report={report} canRevise={canManage} />

          <BoardSection
            title="Commitment register"
            description="Every promise recorded against this contractor, newest meeting first. Earlier commitments are preserved."
          >
            <CommitmentList
              rows={commitments}
              canEdit={canManage}
              onUpdate={async (row, status) => {
                try {
                  await updateRecord('MeetingCommitment', row.id, {
                    status,
                    fulfilled_date: status === 'Fulfilled' ? todayIst() : null,
                  });
                  setRefresh((n) => n + 1);
                } catch (e) {
                  toast({ description: e?.message || 'Could not update the commitment.', variant: 'destructive' });
                }
              }}
            />
          </BoardSection>

          <div className="print:hidden">
            <AiPanel
              title="AI contractor meeting assistant"
              description={`Prepare the brief for ${contractor?.name || 'this contractor'} on ${formatDate(meetingDate)}: outstanding works, broken promises, upstream blockers, questions to ask and decisions to take.`}
              mode="brief"
              actionLabel="Prepare AI meeting brief"
              answerTitle="AI meeting brief"
              run={() =>
                aiMeetingBrief({
                  projectId,
                  phaseId,
                  contractorId,
                  meetingDate,
                })
              }
            />
          </div>
        </div>
      )}

      <CommitmentDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        projectId={projectId}
        phaseId={phaseId}
        contractorId={contractorId}
        contractorName={contractor?.name}
        meetingDate={meetingDate}
        onSaved={() => {
          setCommitOpen(false);
          setRefresh((n) => n + 1);
        }}
      />
    </>
  );
}