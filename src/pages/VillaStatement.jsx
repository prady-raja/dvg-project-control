import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, MessageCircle, Printer, Share2 } from 'lucide-react';
import { statementText } from '@shared/villaViews.ts';
import { useDashboardQuery } from '@/hooks/useDashboardQuery';
import { useSignedUrls } from '@/lib/useSignedUrls';
import { downloadText, toCsv } from '@/lib/reportExport';
import { formatDate, todayIst } from '@/lib/format';
import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

function SnagPhoto({ uri }) {
  const { urls } = useSignedUrls(uri ? [uri] : []);
  if (!uri) return null;
  return urls[uri]
    ? <img src={urls[uri]} alt="Snag" className="h-20 w-20 rounded-md border border-border object-cover" />
    : <span className="inline-block h-20 w-20 rounded-md border border-dashed border-border" aria-hidden />;
}

/**
 * The pending-works statement of one villa (D-08): what is still to be done, in plain
 * words, grouped by floor and room, ready to send to an owner or to print. No
 * percentage is shown unless every task is measured, and no date is invented.
 */
export default function VillaStatement() {
  const { locationId } = useParams();
  const { toast } = useToast();
  const [refs, setRefs] = useState(false);
  const params = { locationId, date: todayIst() };
  const { data: view, isLoading, error, refetch } = useDashboardQuery('statement', params, { enabled: !!locationId });

  useEffect(() => {
    document.title = view ? `Pending works — ${view.villa.code}` : 'Pending works';
  }, [view]);

  const text = () => statementText(view, { includeRefs: refs });

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Pending works — ${view.villa.code}`, text: text() });
        return;
      }
    } catch {
      return; // the person closed the share sheet
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, '_blank', 'noopener');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      toast({ description: 'Statement copied. Paste it into WhatsApp or an email.' });
    } catch {
      toast({ description: 'Could not copy. Use Share instead.', variant: 'destructive' });
    }
  };

  const csv = () => {
    const rows = view.groups.flatMap((g) => g.items.map((i) => ({ floor: g.floor, ...i })));
    downloadText(`pending-works-${view.villa.code}-${view.as_of}.csv`, toCsv(rows, [
      { label: 'Floor', value: (r) => r.floor }, { label: 'Room', value: (r) => r.room }, { label: 'Work', value: (r) => r.what },
      { label: 'Trade', value: (r) => r.trade }, { label: 'Status', value: (r) => r.status },
      { label: 'Expected date', value: (r) => r.expected || 'date not set' }, { label: 'Holding', value: (r) => r.holding },
      ...(refs ? [{ label: 'Task ref', value: (r) => r.ref }] : []),
    ]), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
          <Link to={`/locations/${locationId}`}><ArrowLeft className="h-4 w-4" /> Villa</Link>
        </Button>
        {view && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={refs} onCheckedChange={setRefs} /> Task references
            </label>
            <Button size="sm" className="gap-1.5" onClick={share}><Share2 className="h-4 w-4" /> Share</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={copy}><MessageCircle className="h-4 w-4" /> Copy text</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={csv}><Download className="h-4 w-4" /> CSV</Button>
          </div>
        )}
      </div>

      <DataState loading={isLoading} error={error ? error.message : ''} onRetry={refetch} rows={6}>
        {view && (
          <article className="statement mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 print:max-w-none print:border-0 print:p-0">
            <header className="border-b border-border pb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{view.villa.project}{view.villa.phase ? ` · ${view.villa.phase}` : ''}</p>
              <h1 className="mt-1 text-2xl font-semibold">Pending works — {view.villa.code}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                As of {formatDate(view.as_of)}. {view.villa.plots && <>Plots {view.villa.plots}. </>}
                {view.villa.possession_status === 'Handed Over' ? `Handed over${view.villa.possession_date ? ` on ${formatDate(view.villa.possession_date)}` : ''}.` : 'Not yet handed over.'}
              </p>
              {view.villa.on_hold_reason && <p className="mt-1 text-sm font-medium text-amber-900">On hold: {view.villa.on_hold_reason}</p>}
              <p className="mt-3 text-base">
                <span className="text-muted-foreground">{view.forecast.label}: </span>
                <strong>
                  {view.forecast.state === 'complete' ? 'no pending works'
                    : view.forecast.date ? formatDate(view.forecast.date) : 'not scheduled yet'}
                </strong>
                {view.forecast.undated > 0 && view.forecast.state !== 'complete' && (
                  <span className="text-sm text-muted-foreground"> ({view.forecast.undated} item{view.forecast.undated === 1 ? ' has' : 's have'} no date yet)</span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {view.totals.open_tasks} work item{view.totals.open_tasks === 1 ? '' : 's'} and {view.totals.open_snags} snag{view.totals.open_snags === 1 ? '' : 's'} open
                {view.totals.percent !== null ? ` · ${view.totals.percent}% complete (measured)` : view.totals.measured_of ? ` · completion not stated (${view.totals.measured_of})` : ''}.
              </p>
              {view.contradiction && <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 print:hidden">{view.contradiction}</p>}
            </header>

            {view.groups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">There are no pending works on this villa.</p>
            ) : view.groups.map((g) => (
              <section key={g.floor} className="mt-5 break-inside-avoid">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.floor}</h2>
                <ul className="mt-2 divide-y divide-border">
                  {g.items.map((i) => (
                    <li key={i.id} className="py-2.5 text-sm">
                      <p className="font-medium">{i.room && <span className="text-muted-foreground">{i.room}: </span>}{i.what}{refs && i.ref && <span className="field-mono ml-2 text-xs text-muted-foreground">{i.ref}</span>}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.trade} · {i.status} · {i.expected ? `expected ${formatDate(i.expected)}` : i.date_note}
                      </p>
                      {i.holding && <p className="mt-0.5 text-xs text-amber-900">{i.holding}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {view.snags.length > 0 && (
              <section className="mt-6 break-inside-avoid">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Snags to fix</h2>
                <ul className="mt-2 divide-y divide-border">
                  {view.snags.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <SnagPhoto uri={s.photo} />
                      <span><span className="font-medium">{s.title}</span>{s.area && <span className="text-muted-foreground"> · {s.area}</span>}<span className="block text-xs text-muted-foreground">{s.status}</span></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {view.needed_from_owner.length > 0 && (
              <section className="mt-6 break-inside-avoid rounded-lg border border-amber-300 bg-amber-50 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-950">Needed from the owner</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {view.needed_from_owner.map((o) => <li key={o.id}>• <strong>{o.need}</strong> — {o.what}</li>)}
                </ul>
              </section>
            )}

            {view.completed_recently.length > 0 && (
              <section className="mt-6 break-inside-avoid">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completed in the last 30 days</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {view.completed_recently.map((c) => <li key={c.id}>• {c.room ? `${c.room}: ` : ''}{c.what} <span className="text-xs text-muted-foreground">({formatDate(c.day)})</span></li>)}
                </ul>
              </section>
            )}
          </article>
        )}
      </DataState>
    </>
  );
}
