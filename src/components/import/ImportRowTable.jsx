import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import Pill from '@/components/common/Pill';
import EnumSelect from '@/components/common/EnumSelect';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ImportRowFix from '@/components/import/ImportRowFix';
import ImportProposal from '@/components/import/ImportProposal';
import { cn } from '@/lib/utils';

/** Rows drawn at a time: a full Imagine list is thousands of rows. */
const PAGE = 100;

const FILTERS = [
  'All rows',
  'Needing a decision',
  'NO DECISION YET',
  'REJECTED BY YOU',
  'UPDATES YOU ACCEPTED',
  'CREATE NEW',
  'UPDATE EXISTING',
  'UNCHANGED',
  'POSSIBLE DUPLICATE',
  'DUPLICATE: DIFFERENT ROOM',
  'WRITTEN EARLIER, NOW DIFFERENT',
  'CLARIFICATION REQUIRED',
];

// A similar task in another room/area is not the same work. Never a repeat inside the file,
// and never a row this same file already wrote on an earlier run.
const isDifferentRoom = (row) => row.reconcile?.outcome === 'duplicate' && !row.blocking
  && row.duplicate?.confidence === 'possible' && !row.duplicate?.in_file && !row.reconcile?.match?.written_earlier;

const OUTCOME_TONE = {
  create: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  update: 'border-amber-200 bg-amber-50 text-amber-800',
  unchanged: 'border-border bg-muted text-muted-foreground',
  duplicate: 'border-amber-200 bg-amber-50 text-amber-800',
  clarify: 'border-red-200 bg-red-50 text-red-700',
};

const IssueList = ({ issues }) => {
  if (!issues.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5">
      {issues.slice(0, 3).map((issue) => (
        <li key={`${issue.code}-${issue.message}`} className={cn('text-xs leading-snug', issue.severity === 'error' ? 'text-destructive' : 'text-amber-600')}>
          {issue.message}
        </li>
      ))}
      {issues.length > 3 && <li className="text-xs text-muted-foreground">+{issues.length - 3} more</li>}
    </ul>
  );
};

/**
 * The reviewed file, row by row: what each row is proposed to do, what it would
 * change on the register, and the decision a person makes about it. Nothing here
 * writes: a decision is only carried out when the import is confirmed.
 */
export default function ImportRowTable({
  rows,
  cat,
  projectId,
  decisions,
  reasons,
  edits,
  busyRow,
  onOverride,
  onOverrideMany,
  onClearOverride,
  onDecision,
  onDecisionMany,
  onReason,
  onEdit,
  onLink,
}) {
  const [filter, setFilter] = useState('All rows');
  const [openRow, setOpenRow] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const shown = useMemo(() => {
    const list = rows || [];
    if (filter === 'Needing a decision') {
      return list.filter((row) => ['update', 'duplicate', 'clarify'].includes(row.reconcile?.outcome));
    }
    if (filter === 'NO DECISION YET') {
      return list.filter((row) => ['update', 'duplicate', 'clarify'].includes(row.reconcile?.outcome) && !decisions[row.row_number]);
    }
    if (filter === 'REJECTED BY YOU') return list.filter((row) => decisions[row.row_number] === 'skip');
    if (filter === 'UPDATES YOU ACCEPTED') return list.filter((row) => decisions[row.row_number] === 'update');
    if (filter === 'DUPLICATE: DIFFERENT ROOM') return list.filter(isDifferentRoom);
    if (filter === 'WRITTEN EARLIER, NOW DIFFERENT') return list.filter((row) => row.reconcile?.match?.written_earlier);
    const key = {
      'CREATE NEW': 'create',
      'UPDATE EXISTING': 'update',
      UNCHANGED: 'unchanged',
      'POSSIBLE DUPLICATE': 'duplicate',
      'CLARIFICATION REQUIRED': 'clarify',
    }[filter];
    return key ? list.filter((row) => row.reconcile?.outcome === key) : list;
  }, [rows, filter, decisions]);
  const visible = shown.slice(0, limit);

  // Same rows the single "Same task, no change" button is offered on: a matched task
  // and nothing to change. Only a decision is set; nothing is written until import.
  const bulk = useMemo(() => {
    if (filter === 'POSSIBLE DUPLICATE') {
      return {
        kind: 'link',
        label: 'Same task, no change for all shown',
        rows: shown.filter((row) => !row.blocking && !(row.reconcile?.changes || []).length && row.reconcile?.match?.task_id),
      };
    }
    if (filter === 'DUPLICATE: DIFFERENT ROOM') {
      return { kind: 'import', label: 'Import as new for all shown', rows: shown };
    }
    return { kind: '', label: '', rows: [] };
  }, [shown, filter]);
  const applyBulk = () => {
    onDecisionMany?.(bulk.rows.map((row) => (
      bulk.kind === 'link' ? [row.row_number, 'link', row.reconcile.match.task_id] : [row.row_number, 'import', '']
    )));
    setConfirmBulk(false);
  };

  const renderDecision = (row, decision, rec, changes, open) => (
    <>
            <div className="flex flex-wrap items-center gap-1.5">
              {changes.length > 0 && rec.match?.task_id && !row.blocking && (
                <Button
                  size="sm"
                  variant={decision === 'update' ? 'default' : 'outline'}
                  onClick={() => onDecision(row.row_number, 'update', rec.match.task_id)}
                >
                  Accept update
                </Button>
              )}
              {!row.blocking && rec.outcome !== 'unchanged' && !rec.match?.written_earlier && (
                <Button
                  size="sm"
                  variant={decision === 'import' ? 'default' : 'outline'}
                  onClick={() => onDecision(row.row_number, 'import', '')}
                >
                  Import as new
                </Button>
              )}
              {!changes.length && rec.match?.task_id && (
                <Button
                  size="sm"
                  variant={decision === 'link' ? 'default' : 'outline'}
                  onClick={() => onDecision(row.row_number, 'link', rec.match.task_id)}
                >
                  Same task, no change
                </Button>
              )}
              <Button
                size="sm"
                variant={decision === 'defer' ? 'default' : 'outline'}
                onClick={() => onDecision(row.row_number, 'defer', '')}
              >
                Defer
              </Button>
              <Button
                size="sm"
                variant={decision === 'skip' ? 'default' : 'outline'}
                onClick={() => onDecision(row.row_number, 'skip', '')}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setOpenRow(open ? 0 : row.row_number)}
              >
                {open ? 'Hide' : 'Review'}
              </Button>
            </div>
            {!decision && ['update', 'duplicate', 'clarify'].includes(rec.outcome) && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" /> Needs a decision
              </p>
            )}
            {!decision && rec.outcome === 'create' && (
              <p className="mt-1 text-xs text-muted-foreground">Will be created unless you reject it</p>
            )}
            {rec.outcome === 'unchanged' && (
              <p className="mt-1 text-xs text-muted-foreground">Nothing to write</p>
            )}
    </>
  );

  const renderReview = (row, rec) => (
    <div className="space-y-4">
      <ImportProposal
        row={row}
        cat={cat}
        reasons={reasons}
        edits={edits}
        onReason={onReason}
        onEdit={onEdit}
        busy={busyRow === row.row_number}
      />
      {(rec.candidates || []).length > 1 && (
        <div className="max-w-md">
          <p className="mb-1 text-xs font-medium">Match this row to a different task</p>
          <EnumSelect
            value=""
            size="sm"
            placeholder="Choose the task this row belongs to"
            onChange={(value) => {
              if (value) onLink(row.row_number, value);
            }}
            options={(rec.candidates || []).map((candidate) => ({
              value: candidate.id,
              label: `${candidate.task_ref} — ${candidate.name} (${candidate.villa}${candidate.area_label ? ` · ${candidate.area_label}` : ''})`,
            }))}
          />
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-medium">Correct how this row was read</p>
        <ImportRowFix
          row={row}
          cat={cat}
          projectId={projectId}
          busy={busyRow === row.row_number}
          onApply={onOverride}
          onApplyMany={onOverrideMany}
          allRows={rows}
          onClear={onClearOverride}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {shown.length} of {rows.length} row(s) shown · nothing is written until you confirm the import
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {bulk.rows.length > 0 && onDecisionMany && (
            <Button size="sm" variant="outline" onClick={() => setConfirmBulk(true)}>
              {bulk.label}
            </Button>
          )}
          <EnumSelect value={filter} onChange={(value) => { setFilter(value); setLimit(PAGE); }} options={FILTERS} size="sm" className="w-[240px]" />
        </div>
      </div>
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Apply to ${bulk.rows.length} rows?`}
        description={bulk.kind === 'import'
          ? 'Marks the rows shown to be created as new tasks, each in its own room. Nothing is written until you confirm the import, and you can change any row before then.'
          : 'Sets “Same task, no change” on the rows shown. Nothing is written until you confirm the import, and you can change any row before then.'}
        confirmLabel="Apply"
        destructive={false}
        onConfirm={applyBulk}
      />

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Row</th>
                <th className="px-3 py-2.5 font-medium">Proposed action</th>
                <th className="px-3 py-2.5 font-medium">Task</th>
                <th className="px-3 py-2.5 font-medium">Villa / scope</th>
                <th className="px-3 py-2.5 font-medium">Discipline</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Checks</th>
                <th className="px-3 py-2.5 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => {
                const rec = row.reconcile || {};
                const decision = decisions[row.row_number] || '';
                const open = openRow === row.row_number;
                const changes = rec.changes || [];
                return (
                  <React.Fragment key={row.row_number}>
                    <tr className={cn('align-top', busyRow === row.row_number && 'opacity-60')}>
                      <td className="field-mono px-3 py-2.5 text-xs text-muted-foreground">{row.row_number}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide', OUTCOME_TONE[rec.outcome] || OUTCOME_TONE.unchanged)}>
                          {rec.label || '—'}
                        </span>
                        {changes.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {changes.length} field change(s): {changes.map((item) => item.label).slice(0, 3).join(', ')}
                            {changes.length > 3 ? '…' : ''}
                          </p>
                        )}
                        {rec.match?.task_id && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {rec.match.confidence === 'confirmed' ? 'Matched' : 'Possible match'}{' '}
                            <span className="field-mono">{rec.match.task_ref}</span>
                          </p>
                        )}
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5">
                        <p className="font-medium leading-snug">{row.resolved.name || row.values.name || '—'}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.resolved.work_package || row.values.work_package || 'No work package'}
                          {row.values.source_reference ? ` · ref ${row.values.source_reference}` : ''}
                          {row.values.task_ref ? ` · file says ${row.values.task_ref}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {row.resolved.villa_code ? (
                          <span className="field-mono">{row.resolved.villa_code}</span>
                        ) : row.resolved.category === 'Site-Wide Work' ? (
                          'Site-wide'
                        ) : (
                          <span className="text-muted-foreground">{row.values.villa_code || '—'}</span>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.resolved.area_label || (row.resolved.villa_code ? row.resolved.scope_type : '')}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{row.resolved.discipline_name || row.values.discipline || '—'}</td>
                      <td className="px-3 py-2.5">
                        <Pill value={row.resolved.status_value} />
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.resolved.contractor_name || 'No contractor'}</p>
                      </td>
                      <td className="max-w-[300px] px-3 py-2.5">
                        {rec.clarifications?.length > 0 && (
                          <ul className="mb-1 space-y-0.5">
                            {rec.clarifications.slice(0, 2).map((note) => (
                              <li key={note} className="text-xs leading-snug text-destructive">{note}</li>
                            ))}
                          </ul>
                        )}
                        {rec.match?.written_earlier && rec.outcome !== 'unchanged' && (
                          <p className="mb-1 flex items-start gap-1 text-xs text-amber-700">
                            <Info className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              This row was already written by an earlier run of this file
                              {rec.match.written_earlier.task_ref ? <> as <span className="field-mono">{rec.match.written_earlier.task_ref}</span></> : null}
                              {rec.match.written_earlier.batch_ref ? <> (batch <span className="field-mono">{rec.match.written_earlier.batch_ref}</span>)</> : null}
                              {rec.match.written_earlier.changed?.length ? <> but now differs in: {rec.match.written_earlier.changed.join(', ')}</> : null}
                              . Importing it as new would make a second copy.
                            </span>
                          </p>
                        )}
                        {rec.match?.via === 'already_imported' && (
                          <p className="mb-1 flex items-start gap-1 text-xs text-muted-foreground">
                            <Info className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              Already imported as <span className="field-mono">{rec.match.task_ref}</span> · batch{' '}
                              <span className="field-mono">{rec.match.batch_ref || rec.match.batch_id}</span>
                              {rec.match.batch_ref && rec.match.batch_id ? <> (<span className="field-mono">{rec.match.batch_id}</span>)</> : null}
                            </span>
                          </p>
                        )}
                        {row.duplicate && !rec.clarifications?.length && rec.match?.via !== 'already_imported' && rec.outcome !== 'unchanged' && (
                          <p className="mb-1 flex items-start gap-1 text-xs text-amber-600">
                            <Info className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              Possible duplicate of <span className="field-mono">{row.duplicate.task_ref}</span>
                              {row.duplicate.archived ? ' (archived)' : ''} — {row.duplicate.reason}
                            </span>
                          </p>
                        )}
                        <IssueList issues={row.issues} />
                        {!row.issues.length && !row.duplicate && !rec.clarifications?.length && rec.match?.via !== 'already_imported' && (
                          <p className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Ready
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {renderDecision(row, decision, rec, changes, open)}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="bg-muted/20 px-3 py-4">
                          {renderReview(row, rec)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* On a phone each row is a card: the same facts and the same decisions. */}
      <div className="space-y-3 md:hidden">
        {visible.map((row) => {
          const rec = row.reconcile || {};
          const decision = decisions[row.row_number] || '';
          const open = openRow === row.row_number;
          const changes = rec.changes || [];
          return (
            <article key={row.row_number} className={cn('rounded-xl border border-border bg-card p-4', busyRow === row.row_number && 'opacity-60')}>
              <div className="flex items-center justify-between gap-2">
                <span className="field-mono text-xs text-muted-foreground">Row {row.row_number}</span>
                <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide', OUTCOME_TONE[rec.outcome] || OUTCOME_TONE.unchanged)}>
                  {rec.label || '—'}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium leading-snug">{row.resolved.name || row.values.name || '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.resolved.villa_code || (row.resolved.category === 'Site-Wide Work' ? 'Site-wide' : row.values.villa_code || '—')}
                {row.resolved.area_label ? ` · ${row.resolved.area_label}` : ''} · {row.resolved.discipline_name || row.values.discipline || '—'} · {row.resolved.contractor_name || 'No contractor'}
              </p>
              {changes.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{changes.length} field change(s): {changes.map((item) => item.label).slice(0, 3).join(', ')}</p>
              )}
              {rec.match?.written_earlier && rec.outcome !== 'unchanged' && (
                <p className="mt-1 text-xs text-amber-700">
                  Already written by an earlier run of this file{rec.match.written_earlier.task_ref ? ` as ${rec.match.written_earlier.task_ref}` : ''}; importing as new would make a second copy.
                </p>
              )}
              {rec.match?.via === 'already_imported' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Already imported as <span className="field-mono">{rec.match.task_ref}</span> · batch <span className="field-mono">{rec.match.batch_ref || rec.match.batch_id}</span>
                </p>
              )}
              <div className="mt-2"><IssueList issues={row.issues} /></div>
              <div className="mt-3">{renderDecision(row, decision, rec, changes, open)}</div>
              {open && <div className="mt-3">{renderReview(row, rec)}</div>}
            </article>
          );
        })}
      </div>

      {shown.length > visible.length && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>Showing {visible.length} of {shown.length} rows.</span>
          <Button size="sm" variant="outline" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, shown.length - visible.length)} more</Button>
        </div>
      )}
    </div>
  );
}