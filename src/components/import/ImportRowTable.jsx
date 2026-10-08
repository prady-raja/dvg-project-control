import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import Pill from '@/components/common/Pill';
import EnumSelect from '@/components/common/EnumSelect';
import { Button } from '@/components/ui/button';
import ImportRowFix from '@/components/import/ImportRowFix';
import { cn } from '@/lib/utils';

const FILTERS = ['All rows', 'Needing attention', 'Possible duplicates', 'Ready to import', 'Skipped'];

const toneOf = (row) => (row.issues.some((issue) => issue.severity === 'error') ? 'error' : row.duplicate ? 'warn' : 'ok');

const IssueList = ({ issues }) => {
  if (!issues.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <ul className="space-y-0.5">
      {issues.slice(0, 3).map((issue) => (
        <li key={`${issue.code}-${issue.message}`} className={cn('text-[11px] leading-snug', issue.severity === 'error' ? 'text-destructive' : 'text-warning')}>
          {issue.message}
        </li>
      ))}
      {issues.length > 3 && <li className="text-[11px] text-muted-foreground">+{issues.length - 3} more</li>}
    </ul>
  );
};

export default function ImportRowTable({ rows, cat, projectId, decisions, busyRow, onOverride, onClearOverride, onDecision }) {
  const [filter, setFilter] = useState('All rows');
  const [openRow, setOpenRow] = useState(0);

  const shown = useMemo(() => {
    const list = rows || [];
    if (filter === 'Needing attention') return list.filter((row) => row.blocking);
    if (filter === 'Possible duplicates') return list.filter((row) => row.duplicate);
    if (filter === 'Ready to import') return list.filter((row) => !row.blocking && !row.duplicate);
    if (filter === 'Skipped') return list.filter((row) => decisions[row.row_number] === 'skip');
    return list;
  }, [rows, filter, decisions]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {shown.length} of {rows.length} row(s) shown · nothing is written until you confirm the import
        </p>
        <EnumSelect value={filter} onChange={setFilter} options={FILTERS} size="sm" className="w-[220px]" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Row</th>
                <th className="px-3 py-2.5 font-medium">Task</th>
                <th className="px-3 py-2.5 font-medium">Villa / scope</th>
                <th className="px-3 py-2.5 font-medium">Discipline</th>
                <th className="px-3 py-2.5 font-medium">Contractor</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Checks</th>
                <th className="px-3 py-2.5 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((row) => {
                const decision = decisions[row.row_number] || '';
                const tone = toneOf(row);
                const open = openRow === row.row_number;
                return (
                  <React.Fragment key={row.row_number}>
                    <tr className={cn(busyRow === row.row_number && 'opacity-60')}>
                      <td className="field-mono px-3 py-2.5 align-top text-xs text-muted-foreground">{row.row_number}</td>
                      <td className="max-w-[280px] px-3 py-2.5 align-top">
                        <p className="font-medium leading-snug">{row.resolved.name || row.values.name || '—'}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.resolved.work_package || row.values.work_package || 'No work package'}
                          {row.values.source_reference ? ` · ref ${row.values.source_reference}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs">
                        {row.resolved.villa_code ? (
                          <span className="field-mono">{row.resolved.villa_code}</span>
                        ) : row.resolved.category === 'Site-Wide Work' ? (
                          'Site-wide'
                        ) : (
                          <span className="text-muted-foreground">{row.values.villa_code || '—'}</span>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.resolved.phase_label ? `Phase ${row.resolved.phase_label}` : ''}
                          {row.resolved.category ? ` · ${row.resolved.category}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs">
                        {row.resolved.discipline_name || row.values.discipline || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs">
                        {row.resolved.contractor_name || <span className="text-muted-foreground">—</span>}
                        {row.resolved.contractor_source === 'default' && (
                          <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">default</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <Pill value={row.resolved.status_value} />
                      </td>
                      <td className="max-w-[320px] px-3 py-2.5 align-top">
                        {row.duplicate && (
                          <p className="mb-1 flex items-start gap-1 text-[11px] text-warning">
                            <Info className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              Possible duplicate of <span className="field-mono">{row.duplicate.task_ref}</span>
                              {row.duplicate.archived ? ' (archived)' : ''} — {row.duplicate.reason}
                              {row.duplicate.confidence === 'possible' ? ' (not a confirmed match)' : ''}
                            </span>
                          </p>
                        )}
                        <IssueList issues={row.issues} />
                        {!row.issues.length && !row.duplicate && (
                          <p className="flex items-center gap-1 text-[11px] text-success">
                            <CheckCircle2 className="h-3 w-3" /> Ready
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!row.blocking && (
                            <Button
                              size="sm"
                              variant={decision === 'import' ? 'default' : 'outline'}
                              onClick={() => onDecision(row.row_number, 'import', '')}
                            >
                              Import as new
                            </Button>
                          )}
                          {row.duplicate?.can_link && !row.blocking && (
                            <Button
                              size="sm"
                              variant={decision === 'link' ? 'default' : 'outline'}
                              onClick={() => onDecision(row.row_number, 'link', row.duplicate.task_id)}
                            >
                              Link {row.duplicate.task_ref}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={decision === 'skip' ? 'default' : 'outline'}
                            onClick={() => onDecision(row.row_number, decision === 'skip' ? '' : 'skip')}
                          >
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => setOpenRow(open ? 0 : row.row_number)}
                          >
                            {open ? 'Hide' : 'Fix'}
                          </Button>
                        </div>
                        {tone === 'error' && !decision && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Needs a correction or a skip
                          </p>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="bg-muted/20 px-3 py-4">
                          <ImportRowFix
                            row={row}
                            cat={cat}
                            projectId={projectId}
                            busy={busyRow === row.row_number}
                            onApply={onOverride}
                            onClear={onClearOverride}
                          />
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
    </div>
  );
}