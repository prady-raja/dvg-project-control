import React from 'react';
import { Camera } from 'lucide-react';
import Pill from '@/components/common/Pill';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { useCatalogs } from '@/lib/CatalogContext';
import { useSignedUrls } from '@/lib/useSignedUrls';
import ContactChip from '@/components/common/ContactChip';
import PhotoLightbox from '@/components/common/PhotoLightbox';

/**
 * The snag register. A snag never changes a task by itself: closing it is its
 * own action, so the works register and the defect list cannot contradict.
 */
const THUMBS = 3;

/** A few small photos on the card, signed lazily; the rest stay one tap away on the snag. */
function SnagThumbs({ uris, captions = {} }) {
  const [viewing, setViewing] = React.useState(null);
  const all = uris || [];
  const shown = all.slice(0, THUMBS);
  const { urls } = useSignedUrls(shown);
  if (!shown.length) return null;
  return (
    <div className="mt-2 flex gap-2">
      {shown.map((uri, i) => (urls[uri] ? (
        <button key={uri} type="button" onClick={() => setViewing(i)} aria-label={`Open photo ${i + 1}${captions[uri] ? `: ${captions[uri]}` : ''}`}>
          <img src={urls[uri]} alt={captions[uri] || 'Snag'} loading="lazy" className="h-14 w-14 rounded-md border border-border object-cover" />
        </button>
      ) : (
        <span key={uri} className="h-14 w-14 rounded-md border border-dashed border-border" />
      )))}
      {all.length > THUMBS && <span className="self-center text-xs text-muted-foreground">+{all.length - THUMBS} more</span>}
      <PhotoLightbox open={viewing !== null} onOpenChange={(v) => !v && setViewing(null)} uris={all} captions={captions} startIndex={viewing || 0} />
    </div>
  );
}

export default function SnagList({ rows = [], canEdit = false, onAdvance, emptyLabel = 'No snag recorded for this villa.' }) {
  const cat = useCatalogs();
  if (!rows.length) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="field-mono text-xs font-semibold">{row.snag_ref || 'Snag'}</span>
              <Pill value={row.status} />
              <Pill value={row.severity} />
              {row.handover_blocker && (
                <span className="rounded border border-destructive/40 px-1.5 py-0.5 text-xs uppercase text-destructive">
                  blocks handover
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Raised {formatDate(row.raised_date)}
              {row.closed_date ? ` · closed ${formatDate(row.closed_date)}` : ''}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium">{row.title}</p>
          {row.description && <p className="mt-1 text-xs text-muted-foreground">{row.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {row.contractor_id ? <>Contractor: <ContactChip name={cat.contractorById(row.contractor_id)?.name || 'unknown'} phone={cat.contractorById(row.contractor_id)?.phone} label={`snag ${row.snag_ref || ''} — ${row.title}`} /></> : 'No contractor assigned'}
            {row.target_date ? ` · target ${formatDate(row.target_date)}` : ''}
            {row.reinspection_date ? ` · reinspection ${formatDate(row.reinspection_date)}` : ''}
            {(row.photo_uris || []).length ? ` · ${row.photo_uris.length} photo(s) on file` : ' · no photographs'}
          </p>
          <SnagThumbs uris={row.photo_uris} captions={row.photo_captions || {}} />
          {canEdit && row.status !== 'Closed' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {row.status === 'Open' && (
                <Button size="sm" variant="outline" onClick={() => onAdvance(row, { status: 'Awaiting Reinspection' })}>
                  Ready for reinspection
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onAdvance(row, { status: 'Closed' })}>
                Close snag
              </Button>
              {(row.photo_uris || []).length === 0 && (
                <span className="flex items-center gap-1.5 self-center text-xs text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" /> photographs optional
                </span>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}