import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, MessageCircle, Plus } from 'lucide-react';
import { data } from '@/api/data';
import { errorMessageOf } from '@/lib/clientErrors';
import { formatDate } from '@/lib/format';
import { cancelVisit, confirmVisit, finishVisit, noShowVisit, requestAccess } from '@/lib/ownerAccessService';
import { useCatalogs } from '@/lib/CatalogContext';
import { useQuickActions } from '@/components/layout/QuickActions';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import FormDialog from '@/components/common/FormDialog';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import DataState from '@/components/common/DataState';
import Pill from '@/components/common/Pill';
import ContactChip from '@/components/common/ContactChip';
import { accessLine, tasksNeedingAccess } from '@/lib/shared/ownerAccess.ts';
import { whatsappLink } from '@/lib/shared/constraints.ts';

const VIA = ['WhatsApp', 'Phone', 'In person'];

/**
 * Owner access for one handed-over villa (P-09): the owner's details, one request that
 * bundles every open work needing access, and the visits with what each led to.
 */
export default function OwnerAccessSheet({ location, canEdit }) {
  const cat = useCatalogs();
  const quick = useQuickActions();
  const { toast } = useToast();
  const [visits, setVisits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [request, setRequest] = useState(null); // { picked, visit_date, window_start, window_end }
  const [sent, setSent] = useState(null); // { visit, message }
  const [confirming, setConfirming] = useState(null);
  const [ending, setEnding] = useState(null); // { visit, kind }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const [v, t] = await Promise.all([
        data.readAll('OwnerAccessVisit', { location_id: location.id }, { sort: '-visit_date', max: 500 }),
        data.readAll('Task', { location_id: location.id, archived: { $ne: true } }, { max: 1000 }),
      ]);
      setVisits(v.items);
      setTasks(t.items);
      setState({ loading: false, error: '' });
    } catch (e) {
      setState({ loading: false, error: errorMessageOf(e, 'The access visits could not be loaded.') });
    }
  }, [location.id]);
  useEffect(() => { load(); }, [load, quick.version]);

  const needing = useMemo(() => tasksNeedingAccess(tasks, location.id), [tasks, location.id]);
  const taskOf = (id) => tasks.find((t) => t.id === id);
  const noShows = visits.filter((v) => v.status === 'No-show').length;

  const run = async (fn, okMessage) => {
    setBusy(true);
    setError('');
    try {
      const out = await fn();
      if (okMessage) toast({ description: okMessage });
      await load();
      return out;
    } catch (e) {
      setError(errorMessageOf(e, 'That could not be saved.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    const out = await run(() => requestAccess({ location_id: location.id, task_ids: request.picked, visit_date: request.visit_date, window_start: request.window_start, window_end: request.window_end }));
    if (out) { setRequest(null); setSent(out); }
  };

  const done = async (visit) => {
    const out = await run(() => finishVisit(visit.id), 'Visit marked done.');
    if (out?.task_ids?.length) {
      toast({ description: `Log what was done on ${out.task_ids.length} task${out.task_ids.length === 1 ? '' : 's'}.` });
      quick.openLogUpdate({ taskId: out.task_ids[0] });
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold">Owner</h3>
            <div className="mt-1 text-sm"><ContactChip name={location.owner_name || 'Owner not recorded'} phone={location.owner_phone} label={`access to ${location.villa_code}`} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{location.occupancy || 'Unknown'}{location.access_notes ? ` · ${location.access_notes}` : ''}{noShows ? ` · ${noShows} no-show${noShows === 1 ? '' : 's'}` : ''}</p>
          </div>
          {canEdit && (
            <Button size="sm" className="gap-1.5" disabled={!needing.length} onClick={() => setRequest({ picked: needing.map((t) => t.id), visit_date: '', window_start: '', window_end: '' })}>
              <Plus className="h-4 w-4" /> Request access ({needing.length})
            </Button>
          )}
        </div>
        {!needing.length && <p className="mt-2 text-xs text-muted-foreground">No open work here is waiting for the owner.</p>}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DataState loading={state.loading} error={state.error} onRetry={load} empty={!state.loading && !visits.length} emptyTitle="No access visits yet" emptyDescription="Request access when works in this handed-over villa are waiting for the owner.">
        <ul className="space-y-3">
          {visits.map((v) => (
            <li key={v.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {v.visit_date ? `${formatDate(v.visit_date)}${v.window_start ? ` · ${v.window_start}–${v.window_end || ''}` : ''}` : 'Date not agreed yet'}
                </p>
                <Pill value={v.status} />
              </div>
              {accessLine(v) && <p className="mt-1 text-xs text-muted-foreground">{accessLine(v)}{v.confirmed_via ? ` · agreed by ${v.confirmed_via}` : ''}</p>}
              <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                {(v.task_ids || []).slice(0, 6).map((id) => <li key={id}>{taskOf(id)?.task_ref} {taskOf(id)?.name}</li>)}
                {(v.task_ids || []).length > 6 && <li>…and {(v.task_ids || []).length - 6} more</li>}
              </ul>
              {canEdit && ['Requested', 'Confirmed'].includes(v.status) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.status === 'Requested' && <Button size="sm" onClick={() => setConfirming({ visit: v, visit_date: v.visit_date || '', window_start: v.window_start || '', window_end: v.window_end || '', confirmed_via: 'WhatsApp' })}>Owner confirmed</Button>}
                  {v.status === 'Confirmed' && <Button size="sm" disabled={busy} onClick={() => done(v)}>Visit done</Button>}
                  {v.status === 'Confirmed' && <Button size="sm" variant="outline" onClick={() => setEnding({ visit: v, kind: 'no_show' })}>No-show</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setEnding({ visit: v, kind: 'cancel' })}>Cancel</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </DataState>

      <FormDialog open={!!request} onOpenChange={(o) => !o && setRequest(null)} title="Request access" description="One message to the owner lists every work that needs them." onSubmit={sendRequest} submitting={busy} submitLabel="Prepare request" error={error}>
        {request && (
          <>
            <div className="space-y-2">
              {needing.map((t) => (
                <label key={t.id} className="flex items-start gap-2 text-sm">
                  <Checkbox checked={request.picked.includes(t.id)} onCheckedChange={(c) => setRequest((r) => ({ ...r, picked: c ? [...r.picked, t.id] : r.picked.filter((x) => x !== t.id) }))} />
                  <span><span className="field-mono text-xs">{t.task_ref}</span> {t.name} <span className="text-xs text-muted-foreground">{cat.contractorById(t.contractor_id)?.name || ''}</span></span>
                </label>
              ))}
            </div>
            <Field label="Proposed day (optional)"><Input type="date" value={request.visit_date} onChange={(e) => setRequest((r) => ({ ...r, visit_date: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><Input type="time" value={request.window_start} onChange={(e) => setRequest((r) => ({ ...r, window_start: e.target.value }))} /></Field>
              <Field label="Until"><Input type="time" value={request.window_end} onChange={(e) => setRequest((r) => ({ ...r, window_end: e.target.value }))} /></Field>
            </div>
          </>
        )}
      </FormDialog>

      <FormDialog open={!!sent} onOpenChange={(o) => !o && setSent(null)} title="Send this to the owner" description="The request is recorded. Send the message, then mark it confirmed when they reply." onSubmit={() => setSent(null)} submitLabel="Done">
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-xs">{sent?.message}</pre>
        {whatsappLink(location.owner_phone, sent?.message || '') ? (
          <Button type="button" asChild className="gap-2"><a href={whatsappLink(location.owner_phone, sent?.message || '')} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Open WhatsApp</a></Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => navigator.clipboard?.writeText(sent?.message || '').then(() => toast({ description: 'Message copied.' }))}>Copy the message (no owner number on record)</Button>
        )}
      </FormDialog>

      <FormDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)} title="Owner confirmed" description="Access is set on the linked works and the date goes on their blockers." submitLabel="Confirm visit" submitting={busy} error={error}
        onSubmit={async () => { const out = await run(() => confirmVisit(confirming.visit.id, confirming), 'Visit confirmed.'); if (out) setConfirming(null); }}>
        {confirming && (
          <>
            <Field label="Day" required><Input type="date" value={confirming.visit_date} onChange={(e) => setConfirming((c) => ({ ...c, visit_date: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" required><Input type="time" value={confirming.window_start} onChange={(e) => setConfirming((c) => ({ ...c, window_start: e.target.value }))} /></Field>
              <Field label="Until" required><Input type="time" value={confirming.window_end} onChange={(e) => setConfirming((c) => ({ ...c, window_end: e.target.value }))} /></Field>
            </div>
            <Field label="How was it agreed?" required><EnumSelect value={confirming.confirmed_via} onChange={(v) => setConfirming((c) => ({ ...c, confirmed_via: v }))} options={VIA} /></Field>
          </>
        )}
      </FormDialog>

      <ConfirmDialog
        open={!!ending}
        onOpenChange={(o) => !o && setEnding(null)}
        title={ending?.kind === 'no_show' ? 'Mark this visit as a no-show?' : 'Cancel this visit?'}
        description="The works go back to waiting for the owner's access."
        confirmLabel={ending?.kind === 'no_show' ? 'Mark no-show' : 'Cancel visit'}
        onConfirm={() => run(() => (ending.kind === 'no_show' ? noShowVisit(ending.visit.id) : cancelVisit(ending.visit.id)), ending.kind === 'no_show' ? 'Marked as a no-show.' : 'Visit cancelled.')}
      />
    </section>
  );
}
