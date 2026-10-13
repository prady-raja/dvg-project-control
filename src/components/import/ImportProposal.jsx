import React, { useState } from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import EnumSelect from '@/components/common/EnumSelect';
import Field from '@/components/common/Field';
import { cn } from '@/lib/utils';

const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Execution Complete', 'Under Inspection', 'Approved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * One existing task beside what the uploaded file proposes for it, field by
 * field. Only the fields that would genuinely change are listed — and the ones
 * the file left blank cannot appear here at all.
 */
export default function ImportProposal({ row, cat, reasons, edits, onReason, onEdit, busy }) {
  const rec = row.reconcile;
  const [editing, setEditing] = useState(false);
  const change = (field) => (edits[row.row_number] || {})[field] ?? '';
  const set = (field, value) => onEdit(row.row_number, field, value);
  const reason = reasons[row.row_number] || '';

  if (!rec.match.task_id && !rec.changes.length) {
    return <p className="text-xs text-muted-foreground">Nothing on the register would change for this row.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground">Existing record</span>
        <span className="field-mono">{rec.match.task_ref || '—'}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">Proposed from the file</span>
        <span className="text-muted-foreground">
          matched by {rec.match.via === 'task_ref' ? 'the task reference in the file' : rec.match.reason || rec.match.via}
          {rec.match.confidence === 'possible' ? ' (a possible match — confirm it is the same work)' : ''}
        </span>
      </div>

      {rec.changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">The recorded values already match this row.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Existing record</th>
                <th className="px-3 py-2 font-medium">Proposed Excel value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rec.changes.map((item) => (
                <tr key={item.field} className="bg-amber-500/5">
                  <td className="px-3 py-2 font-medium">{item.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.existing_text || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{item.proposed_text || '—'}</span>
                    {((edits[row.row_number] || {})[item.field] !== undefined) && (
                      <span className="ml-2 text-xs uppercase tracking-wide text-primary">edited</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rec.needs_reason && (
        <Field
          label="Date revision reason"
          required
          hint="Required with this change — the existing forecast is revised and the reason is recorded against it."
        >
          <Input
            value={reason}
            disabled={!!busy}
            placeholder="Why the forecast finish is being revised"
            onChange={(event) => onReason(row.row_number, event.target.value)}
          />
        </Field>
      )}

      {rec.clarifications?.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {rec.clarifications.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {rec.ai_suggestion && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <p className="font-medium text-foreground">Suggested reading (a suggestion, not a fact)</p>
          <p className="mt-1 text-muted-foreground">
            {[
              rec.ai_suggestion.discipline ? `discipline ${rec.ai_suggestion.discipline}` : '',
              rec.ai_suggestion.work_package ? `work package ${rec.ai_suggestion.work_package}` : '',
              rec.ai_suggestion.room ? `room ${rec.ai_suggestion.room}` : '',
              rec.ai_suggestion.task_ref ? `looks like ${rec.ai_suggestion.task_ref}` : '',
            ].filter(Boolean).join(' · ') || 'no suggestion'}
            {rec.ai_suggestion.note ? ` — ${rec.ai_suggestion.note}` : ''}
          </p>
          {rec.ai_suggestion.dropped?.length > 0 && (
            <p className="mt-1 text-amber-600">Not accepted, because it is not on this project: {rec.ai_suggestion.dropped.join('; ')}.</p>
          )}
        </div>
      )}

      <div>
        <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" onClick={() => setEditing(!editing)}>
          <Pencil className="h-3.5 w-3.5" /> {editing ? 'Hide the edited proposal' : 'Edit the proposal'}
        </Button>

        {editing && (
          <div className={cn('mt-2 grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3')}>
            <Field label="Status">
              <EnumSelect value={change('status')} onChange={(value) => set('status', value)} options={STATUSES} placeholder="Keep as proposed" />
            </Field>
            <Field label="Progress %">
              <Input
                type="number"
                min="0"
                max="100"
                value={change('progress_percent')}
                placeholder="Keep as proposed"
                onChange={(event) => set('progress_percent', event.target.value)}
              />
            </Field>
            <Field label="Forecast finish">
              <Input
                type="date"
                value={change('current_forecast_finish')}
                onChange={(event) => set('current_forecast_finish', event.target.value)}
              />
            </Field>
            <Field label="Contractor">
              <EnumSelect
                value={change('contractor_id')}
                onChange={(value) => set('contractor_id', value)}
                options={(cat.contractors || []).map((contractor) => ({ value: contractor.id, label: contractor.name }))}
                placeholder="Keep as proposed"
              />
            </Field>
            <Field label="Priority">
              <EnumSelect value={change('priority')} onChange={(value) => set('priority', value)} options={PRIORITIES} placeholder="Keep as proposed" />
            </Field>
            <Field label="Clear a value deliberately" hint="An empty cell in the file never does this.">
              <EnumSelect
                value=""
                onChange={(value) => {
                  if (value) set(value, '');
                }}
                options={[
                  { value: 'current_forecast_finish', label: 'Clear forecast finish' },
                  { value: 'progress_percent', label: 'Clear progress' },
                  { value: 'contractor_id', label: 'Clear contractor' },
                  { value: 'remarks', label: 'Clear remarks' },
                ]}
                placeholder="Choose a value to clear"
              />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Remarks">
                <Textarea
                  rows={2}
                  value={change('remarks')}
                  placeholder="Keep as proposed"
                  onChange={(event) => set('remarks', event.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}