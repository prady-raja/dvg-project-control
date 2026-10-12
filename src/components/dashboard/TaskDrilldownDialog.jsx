import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import ActivityRows from '@/components/common/ActivityRows';
import { loadDashboard } from '@/lib/dashboardService';
import TruncationBanner from '@/components/common/TruncationBanner';

/** The records behind one headline number — opened from any tile or badge. */
export default function TaskDrilldownDialog({ open, onOpenChange, title, description, filters }) {
  const [state, setState] = useState({ loading: true, rows: [], total: 0, error: '' });
  const [limit, setLimit] = useState(40);
  const key = JSON.stringify(filters || {});

  useEffect(() => setLimit(40), [key, open]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setState({ loading: true, rows: [], total: 0, error: '' });
    loadDashboard('tasks', { ...filters, itemLimit: limit })
      .then((data) => {
        if (!alive) return;
        setState({ loading: false, rows: data.rows || [], total: data.total || 0, error: '' });
      })
      .catch((error) => {
        if (!alive) return;
        setState({
          loading: false,
          rows: [],
          total: 0,
          error: error?.response?.data?.error || error?.message || 'Could not load the list.',
        });
      });
    return () => {
      alive = false;
    };
  }, [open, key, filters, limit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || 'The underlying task records behind this figure.'}
          </DialogDescription>
        </DialogHeader>

        {state.loading ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : state.error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{state.error}</p>
        ) : (
          <>
            <TruncationBanner
              shown={state.rows.length}
              total={state.total}
              noun="records in this list"
              onLoadAll={limit < 500 ? () => setLimit(500) : undefined}
              to="/tasks"
            />
            <div className="max-h-[60vh] overflow-y-auto">
              <ActivityRows rows={state.rows} emptyLabel="No task matches this figure for the current scope and date." showAction />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}