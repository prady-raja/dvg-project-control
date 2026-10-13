import React from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Says so when a list shows only part of the records (X-04). Nothing is cut
 * short silently: the banner states how many are shown, how many exist when
 * that is known, and offers the way to see the rest.
 */
export default function TruncationBanner({ shown, total, noun = 'records', onLoadAll, loading, to, toLabel = 'Open in Task Register', className = '' }) {
  const known = typeof total === 'number';
  if (known ? shown >= total : false) return null;
  return (
    <div role="status" className={`flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 ${className}`}>
      <Info className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">
        Showing {shown} of {known ? total : 'more'} {noun}. The list is partial.
      </span>
      {onLoadAll && (
        <Button size="sm" variant="outline" className="h-7" onClick={onLoadAll} disabled={loading}>
          {loading ? 'Loading…' : 'Load all'}
        </Button>
      )}
      {to && (
        <Button asChild size="sm" variant="outline" className="h-7">
          <Link to={to}>{toLabel}</Link>
        </Button>
      )}
    </div>
  );
}
