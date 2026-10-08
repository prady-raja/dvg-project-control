import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** The child villa tasks under one Villa Work assignment. */
export default function VillaWorkChildren({ parentId }) {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!parentId) return;
    setLoading(true);
    const res = await base44.entities.Task.filter({ parent_task_id: parentId }, { sort: 'task_ref', limit: 500 });
    setChildren(items(res));
    setLoading(false);
  }, [parentId]);

  useEffect(() => {
    load();
  }, [load]);

  const number = (value) => (value === null || value === undefined ? null : Number(value));
  const done = children.filter((c) => c.status === 'Approved' || c.status === 'Closed').length;
  const progressed = children.filter((c) => number(c.progress_percent) !== null);
  const average = progressed.length
    ? Math.round(progressed.reduce((sum, c) => sum + number(c.progress_percent), 0) / progressed.length)
    : null;

  if (loading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Villas in this activity
        </h2>
        <p className="text-xs text-muted-foreground">
          {children.length} villa{children.length === 1 ? '' : 's'} · {done} approved or closed
          {average !== null ? ` · average progress ${average}%` : ''}
        </p>
      </div>

      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">No villa tasks were created for this activity.</p>
      ) : (
        <ul className="divide-y divide-border">
          {children.map((child) => (
            <li key={child.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="field-mono text-xs font-medium">{child.task_ref}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {child.responsible_engineer || 'No engineer'} · {child.status}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/tasks/${child.id}`)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}