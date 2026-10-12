import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ClipboardList, Layers } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { items } from '@/lib/dataHelpers';
import { useAccess } from '@/lib/AccessContext';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import TaskFilters, { EMPTY_TASK_FILTERS } from '@/components/tasks/TaskFilters';
import TaskTable from '@/components/tasks/TaskTable';
import TaskCard from '@/components/tasks/TaskCard';
import QuickUpdateDialog from '@/components/tasks/QuickUpdateDialog';
import VillaWorkDialog from '@/components/tasks/VillaWorkDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import DataState from '@/components/common/DataState';
import { errorMessageOf } from '@/lib/clientErrors';
import { escapeRegex } from '@/lib/taskForm';

const PAGE_SIZE = 50;

export default function TaskRegister() {
  const cat = useCatalogs();
  const access = useAccess();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initial = {
    ...EMPTY_TASK_FILTERS,
    project_id: searchParams.get('project') || '',
    phase_id: searchParams.get('phase') || '',
    location_id: searchParams.get('location') || '',
    discipline: searchParams.get('discipline') || '',
    contractor_id: searchParams.get('contractor') || '',
    status: searchParams.get('status') || '',
  };

  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [quickTask, setQuickTask] = useState(null);
  const [villaOpen, setVillaOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const canEdit = access.canAnywhere('edit_tasks');

  useEffect(() => {
    const t = setTimeout(() => setFilters(draft), 300);
    return () => clearTimeout(t);
  }, [draft]);

  const buildQuery = useCallback(() => {
    // A Villa Work assignment is a container holding one task per villa; the
    // container carries no work of its own, so it is held out of the register and
    // its total. Parent and children are never counted twice.
    const q = { archived: { $ne: true }, is_villa_work_parent: { $ne: true } };
    if (filters.project_id) q.project_id = filters.project_id;
    if (filters.phase_id) q.phase_id = filters.phase_id;
    if (filters.location_id) q.location_id = filters.location_id;
    if (filters.discipline) q.discipline = filters.discipline;
    if (filters.contractor_id) q.contractor_id = filters.contractor_id;
    if (filters.status) q.status = filters.status;
    const search = escapeRegex(filters.search.trim());
    if (search) {
      q.$or = [
        { name: { $regex: search, $options: 'i' } },
        { task_ref: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    return q;
  }, [filters]);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const query = buildQuery();
        const [page, count] = await Promise.all([
          base44.entities.Task.filter(query, { sort: '-created_date', limit: PAGE_SIZE }),
          base44.entities.Task.count(query),
        ]);
        if (cancelled) return;
        setTasks(items(page));
        setCursor(page?.next_cursor || null);
        setHasMore(!!page?.has_more);
        setTotal(count || 0);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessageOf(e, 'The task list could not be loaded.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, reloadKey]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await base44.entities.Task.filter(buildQuery(), {
        sort: '-created_date',
        limit: PAGE_SIZE,
        cursor,
      });
      setTasks((t) => [...t, ...items(page)]);
      setCursor(page?.next_cursor || null);
      setHasMore(!!page?.has_more);
    } catch (e) {
      setLoadError(errorMessageOf(e, 'More tasks could not be loaded.'));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Construction task register"
        title="Tasks"
        description="Every work item is linked to its project, phase, villa, discipline, contractor and engineer."
        actions={
          canEdit ? (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setVillaOpen(true)}>
                <Layers className="h-4 w-4" /> Villa work
              </Button>
              <Button className="gap-2" onClick={() => navigate('/tasks/new')}>
                <Plus className="h-4 w-4" /> Create task
              </Button>
            </>
          ) : null
        }
      />

      <TaskFilters filters={draft} setFilters={setDraft} cat={cat} />

      <div className="mt-4 mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {loading
            ? 'Loading…'
            : `${total} task${total === 1 ? '' : 's'}${
                hasMore ? ` · showing ${tasks.length}` : ''
              } · villa work appears once per villa`}
        </p>
      </div>

      {loadError ? (
        <DataState error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={ClipboardList}
            title="No tasks match"
            description="Change the filters, or create a task to start the register."
            action={
              canEdit ? (
                <Button className="gap-2" onClick={() => navigate('/tasks/new')}>
                  <Plus className="h-4 w-4" /> Create task
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <TaskTable tasks={tasks} cat={cat} onOpen={(t) => navigate(`/tasks/${t.id}`)} />
          </div>
          <div className="space-y-3 md:hidden">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} cat={cat} onOpen={() => navigate(`/tasks/${t.id}`)} onQuickUpdate={setQuickTask} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}

      <VillaWorkDialog
        open={villaOpen}
        onOpenChange={setVillaOpen}
        cat={cat}
        projectId={filters.project_id}
        phaseId={filters.phase_id}
        onCreated={() => setReloadKey((k) => k + 1)}
      />

      <QuickUpdateDialog
        task={quickTask}
        open={!!quickTask}
        onOpenChange={(v) => !v && setQuickTask(null)}
        user={user}
        onSaved={() => {
          setQuickTask(null);
          setReloadKey((k) => k + 1);
        }}
      />
    </>
  );
}