import React, { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { formatDateTime } from '@/lib/format';

const FIELD_LABELS = {
  task_ref: 'Task reference',
  project_id: 'Project',
  phase_id: 'Phase',
  location_id: 'Villa / location',
  discipline: 'Discipline',
  work_package: 'Work package',
  name: 'Task name',
  description: 'Description',
  priority: 'Priority',
  status: 'Status',
  contractor_id: 'Contractor',
  responsible_engineer: 'Responsible engineer',
  progress_percent: 'Progress %',
  baseline_start: 'Baseline start',
  baseline_finish: 'Baseline finish',
  baseline_approval_status: 'Baseline approval',
  current_forecast_finish: 'Forecast finish',
  actual_start: 'Actual start',
  actual_finish: 'Actual finish',
  date_revision_reason: 'Date revision reason',
  blocker_category: 'Blocker category',
  archived: 'Archived',
  execution_completed_by: 'Execution complete by',
  approved_by: 'Approved by',
  baseline: 'Baseline freeze',
};

const fieldLabel = (field) => FIELD_LABELS[field] || field || '—';
const show = (value) => (value === '' || value === null || value === undefined ? '—' : String(value));

/** Read-only trail. Entries are written by the server on every change and cannot be edited. */
export default function TaskHistoryPanel({ taskId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const res = await base44.entities.TaskHistory.filter({ task_id: taskId }, { sort: '-changed_at', limit: 200 });
    setRows(items(res));
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Change history
        </h2>
        <span className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`}
        </span>
      </div>

      {!loading && rows.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          <History className="h-4 w-4 shrink-0" />
          No changes recorded yet. Every future edit is captured automatically.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm">
                  <span className="font-medium">{row.change_type || 'Change'}</span>
                  <span className="text-muted-foreground"> · {fieldLabel(row.field_changed)}</span>
                </p>
                <p className="field-mono text-[11px] text-muted-foreground">{formatDateTime(row.changed_at)}</p>
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                <span className="line-through opacity-70">{show(row.old_value)}</span>
                <span className="mx-1.5">→</span>
                <span className="font-medium text-foreground">{show(row.new_value)}</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {row.changed_by_name || 'Unknown user'}
                {row.note ? ` · ${row.note}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}