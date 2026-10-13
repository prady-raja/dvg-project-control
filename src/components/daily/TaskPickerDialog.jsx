import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { items } from '@/lib/dataHelpers';
import { useCatalogs } from '@/lib/CatalogContext';
import { cn } from '@/lib/utils';
import { pickerQuery } from '@/lib/taskForm';
import { Button } from '@/components/ui/button';

const PAGE = 50;

/**
 * Picks the task a report belongs to. Site-wide work has no villa, so the list
 * can be narrowed to the tasks that are not tied to one.
 */
export default function TaskPickerDialog({ open, onOpenChange, projectId, locationId, contractorId, onPick }) {
  const cat = useCatalogs();
  const [term, setTerm] = useState('');
  const [siteWideOnly, setSiteWideOnly] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setSiteWideOnly(false);
  }, [open]);

  useEffect(() => setLimit(PAGE), [term, siteWideOnly, locationId, projectId]);

  useEffect(() => {
    if (!open || !projectId) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      // A typed villa code (for example "B-05") narrows to that villa.
      const text = term.trim();
      const villa = !locationId && text
        ? cat.locations.find(
          (l) => l.project_id === projectId && String(l.villa_code || '').toLowerCase() === text.toLowerCase(),
        )
        : null;
      const query = villa
        ? pickerQuery({ projectId, locationId: villa.id })
        : pickerQuery({ projectId, locationId, siteWideOnly, term: text });
      if (contractorId) query.contractor_id = contractorId;
      try {
        const res = await base44.entities.Task.filter(query, { sort: '-created_date', limit: limit + 1 });
        if (!alive) return;
        setRows(items(res));
      } catch (e) {
        if (!alive) return;
        setRows([]);
        setError(e?.message || 'Could not load tasks.');
      } finally {
        if (alive) setLoading(false);
      }
    }, term ? 300 : 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, projectId, locationId, contractorId, siteWideOnly, term, limit, cat.locations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Which task?</DialogTitle>
          <DialogDescription>Pick the work item this report belongs to.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Search by name or reference"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          {!locationId && (
            <button
              type="button"
              onClick={() => setSiteWideOnly((v) => !v)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                siteWideOnly ? 'border-primary bg-secondary text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              Site-wide work only
            </button>
          )}

          {loading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : error ? (
            <p className="rounded-lg border border-destructive/40 px-4 py-6 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No matching task. Create it in the task register first.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.slice(0, limit).map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-secondary"
                    onClick={() => onPick(task)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{task.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        <span className="field-mono">{task.task_ref}</span>
                        {cat.disciplineName(task.discipline) ? ` · ${cat.disciplineName(task.discipline)}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {cat.locationById(task.location_id)?.villa_code || 'Site-wide'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && !error && rows.length > limit && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((n) => n + PAGE)}>
              Show more
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}