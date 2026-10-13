import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/common/EmptyState';

/**
 * One way to show a load: skeleton rows while loading, a message with Retry when
 * it failed, an empty state when there is nothing, and the content otherwise.
 * A load can no longer leave a page spinning forever (X-05).
 */
export default function DataState({
  loading, error, empty, onRetry, children, rows = 3, emptyTitle = 'Nothing here yet', emptyDescription = '', emptyIcon, emptyAction,
}) {
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm sm:flex-row sm:items-center">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" aria-hidden />
        <div className="flex-1">
          <p className="font-medium text-red-900">Could not load this.</p>
          <p className="text-red-800">{typeof error === 'string' ? error : error?.message}</p>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }
  if (empty) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return <>{children}</>;
}
