import DataState from '@/components/common/DataState';
import { errorMessageOf } from '@/lib/clientErrors';
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/common/EmptyState';
import DailyUpdateCard from '@/components/daily/DailyUpdateCard';

/**
 * The reports themselves, newest first, grouped by the day they describe.
 * `filter` is a plain entity query so the same feed serves a villa, a task or a
 * whole project.
 */
export default function DailyUpdateFeed({
  filter,
  hideVilla = false,
  emptyTitle = 'No daily updates yet',
  emptyDescription = 'Site reports filed against these works will appear here, newest first.',
}) {
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const key = JSON.stringify(filter || {});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.entities.DailyUpdate.filter(JSON.parse(key), { sort: '-update_date', limit: 25 });
      const page = Array.isArray(res) ? { items: res } : res || {};
      setRows(items(res));
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch (e) {
      setError(errorMessageOf(e, 'The daily updates could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await base44.entities.DailyUpdate.filter(JSON.parse(key), {
        sort: '-update_date',
        limit: 25,
        cursor,
      });
      const page = Array.isArray(res) ? { items: res } : res || {};
      setRows((prev) => [...prev, ...items(res)]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch (e) {
      setError(errorMessageOf(e, 'More updates could not be loaded.'));
    } finally {
      setLoadingMore(false);
    }
  };

  if (error) return <DataState error={error} onRetry={load} />;
  if (loading) return <Skeleton className="h-40 rounded-xl" />;

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border">
        <EmptyState icon={CalendarDays} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const days = [];
  rows.forEach((row) => {
    const day = row.update_date || 'Unknown day';
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else days.push({ day, rows: [row] });
  });
  // The feed is paged by the day each report describes; within a day, newest filing first.
  days.forEach((group) => group.rows.sort((a, b) => String(b.reported_at).localeCompare(String(a.reported_at))));

  return (
    <div className="space-y-6">
      {days.map((group) => (
        <section key={group.day} className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="field-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {formatDate(group.day)}
            </h3>
            <span className="text-xs text-muted-foreground">
              {group.rows.length} update{group.rows.length === 1 ? '' : 's'}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            {group.rows.map((row) => (
              <DailyUpdateCard key={row.id} update={row} hideVilla={hideVilla} />
            ))}
          </div>
        </section>
      ))}

      {hasMore && (
        <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load older updates'}
        </Button>
      )}
    </div>
  );
}