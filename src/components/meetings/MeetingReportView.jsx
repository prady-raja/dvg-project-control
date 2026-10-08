import React from 'react';
import BoardSection from '@/components/common/BoardSection';
import ActivityRows from '@/components/common/ActivityRows';
import { formatDate } from '@/lib/format';

const rowsFor = (rows) => rows || [];

/** The conventional contractor meeting report — always the same sections. */
export default function MeetingReportView({ report, canRevise, rowAction }) {
  if (!report) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          ['Outstanding works', report.counts?.outstanding],
          ['Overdue', report.counts?.overdue],
          ['Due in next 7 days', report.counts?.due_7],
          ['Existing blockers', report.counts?.blocked],
          ['Awaiting verification', report.counts?.awaiting_verification],
          ['Dependencies on others', report.counts?.dependencies_on_others],
          ['Pending management decisions', report.counts?.pending_decisions],
          ['Unresolved commitments', report.counts?.unresolved_commitments],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="field-mono text-xl font-semibold tnum">{value ?? 0}</p>
            <p className="mt-1 text-[11px] uppercase leading-tight tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <BoardSection
        title="Outstanding works by villa"
        description={`Everything still open for ${report.scope?.contractor || 'this contractor'} at ${report.scope?.project || 'this project'}, meeting of ${formatDate(report.meeting_date)}.`}
      >
        {rowsFor(report.by_villa).length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">No outstanding work for this contractor in this scope.</p>
        ) : (
          <div className="space-y-6">
            {report.by_villa.map((group) => (
              <div key={group.location_id || 'site-wide'}>
                <div className="mb-2 flex items-center gap-3">
                  <h3 className="font-display text-sm font-semibold">{group.villa}</h3>
                  <span className="text-xs text-muted-foreground">{group.rows.length} open</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <ActivityRows rows={group.rows} rowAction={rowAction} />
              </div>
            ))}
          </div>
        )}
      </BoardSection>

      <BoardSection title="Works overdue" description="Past their finish date and still to be executed.">
        <ActivityRows rows={rowsFor(report.overdue)} emptyLabel="Nothing is overdue for this contractor." rowAction={rowAction} />
      </BoardSection>

      <BoardSection title="Tasks due in the next seven days">
        <ActivityRows rows={rowsFor(report.due_7)} emptyLabel="Nothing is due within seven days." rowAction={rowAction} />
      </BoardSection>

      <BoardSection title="Blockers" description="Recorded blockers on this contractor's work, with whoever is recorded as owner.">
        <ActivityRows rows={rowsFor(report.blockers)} emptyLabel="No blocker recorded against this contractor's work." rowAction={rowAction} />
      </BoardSection>

      <BoardSection
        title="Dependencies on other contractors"
        description="Only recorded links: a blocker owned by another party, or work that waits on an earlier task held by someone else."
      >
        <ActivityRows
          rows={rowsFor(report.dependencies_on_others)}
          emptyLabel="No recorded dependency on another contractor."
          showAction
          rowAction={rowAction}
        />
      </BoardSection>

      <BoardSection title="Pending management decisions" description="Verification, closure, owner access, client selection or material orders waiting on a decision.">
        <ActivityRows rows={rowsFor(report.pending_decisions)} emptyLabel="No decision is pending on this contractor's work." rowAction={rowAction} />
      </BoardSection>

      <BoardSection
        title="Unresolved previous commitments"
        description="Promised dates that have passed with the commitment still open."
      >
        <ActivityRows rows={[]} emptyLabel="" />
        <p className="text-xs text-muted-foreground">
          {rowsFor(report.unresolved_commitments).length === 0
            ? 'No earlier commitment has been missed.'
            : `${report.unresolved_commitments.length} commitment(s) passed their promised date and are still open — see the commitment register below.`}
        </p>
      </BoardSection>
    </div>
  );
}