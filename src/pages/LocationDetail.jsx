import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Zap, CalendarPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCatalogs } from '@/lib/CatalogContext';
import { items } from '@/lib/dataHelpers';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import DetailList from '@/components/common/DetailList';
import EmptyState from '@/components/common/EmptyState';
import TaskTable from '@/components/tasks/TaskTable';
import TaskCard from '@/components/tasks/TaskCard';
import LocationDialog from '@/components/locations/LocationDialog';
import DailyUpdateFeed from '@/components/daily/DailyUpdateFeed';
import LocationCrumbs from '@/components/locations/LocationCrumbs';
import SnagsTab from '@/components/locations/SnagsTab';
import VillaExecution from '@/pages/VillaExecution';
import { useUrlState } from '@/lib/useUrlFilters';
import VillaScopePanel from '@/components/villa/VillaScopePanel';
import DrawingRegister from '@/components/drawings/DrawingRegister';
import { useAccess } from '@/lib/AccessContext';
import { useQuickActions } from '@/components/layout/QuickActions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { data } from '@/api/data';
import DataState from '@/components/common/DataState';
import TruncationBanner from '@/components/common/TruncationBanner';
import { errorMessageOf } from '@/lib/clientErrors';

export default function LocationDetail() {
  const { locationId } = useParams();
  const cat = useCatalogs();
  const access = useAccess();
  const navigate = useNavigate();
  const quick = useQuickActions();
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [taskTotal, setTaskTotal] = useState(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useUrlState('tab', 'overview');

  const location = cat.locationById(locationId);
  const phase = location ? cat.phaseById(location.phase_id) : null;
  const project = location ? cat.projectById(location.project_id) : null;

  const loadTasks = useCallback(async () => {
    if (!locationId) return;
    setLoadingTasks(true);
    setLoadError('');
    const query = { location_id: locationId, archived: { $ne: true } };
    try {
      const [res, count] = await Promise.all([
        base44.entities.Task.filter(query, { sort: '-created_date', limit: 200 }),
        base44.entities.Task.count(query),
      ]);
      setTasks(items(res));
      setTaskTotal(Number(count) || 0);
    } catch (e) {
      setLoadError(errorMessageOf(e, 'The tasks for this villa could not be loaded.'));
    } finally {
      setLoadingTasks(false);
    }
  }, [locationId]);

  const loadAllTasks = async () => {
    setLoadingAll(true);
    try {
      const all = await data.readAll('Task', { location_id: locationId, archived: { $ne: true } }, { sort: '-created_date', max: 5000 });
      setTasks(all.items);
      setTaskTotal(all.items.length);
    } catch (e) {
      setLoadError(errorMessageOf(e, 'The full task list could not be loaded.'));
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [loadTasks, quick.version]);

  if (cat.loading) return <Skeleton className="h-96 rounded-xl" />;

  if (!location) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Villa or location not found</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/locations">Back to villas &amp; locations</Link>
        </Button>
      </div>
    );
  }

  const canEdit = access.can(location.project_id, 'edit_tasks');
  const canManage = access.can(location.project_id, 'manage_project');
  const tabList = [['overview', 'Overview'], ['tasks', 'Tasks'], ['daily', 'Daily'], ...(location.location_type === 'Villa' ? [['snags', 'Snags'], ['drawings', 'Drawings'], ['rooms', 'Floors & rooms']] : [])];

  return (
    <>
      <LocationCrumbs project={project} phase={phase} location={location} />

      <PageHeader
        eyebrow={[project?.name, phase?.name, location.location_type].filter(Boolean).join(' · ')}
        title={location.villa_code}
        description={location.notes || undefined}
        actions={
          <>
            <Pill value={location.possession_status} />
            <Pill value={location.active_status} />
            {location.location_type === 'Villa' && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to={`/villas/${location.id}/statement`}>Pending works statement</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <DetailList
          columns={3}
          items={[
            { label: 'Plot references', value: location.plot_numbers },
            { label: 'Works stage', value: <Pill value={location.works_stage} /> },
            { label: 'Possession date', value: formatDate(location.possession_date), mono: true },
            { label: 'Planned completion', value: formatDate(location.planned_completion_date), mono: true },
            { label: 'Assigned engineer', value: location.assigned_engineer },
            { label: 'Villa / location ID', value: location.villa_code, mono: true },
          ]}
        />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Location sections">
        {tabList.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {tab === 'overview' && (location.location_type === 'Villa' ? <VillaExecution locationId={location.id} embedded /> : <p className="text-sm text-muted-foreground">Use the tabs to see this location's tasks and daily updates.</p>)}
        {tab === 'tasks' && (
          <>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Task register for this location
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Works stay open and editable after handover. {taskTotal ?? tasks.length} task{(taskTotal ?? tasks.length) === 1 ? '' : 's'}.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => navigate(`/tasks/new?location=${location.id}`)}
          >
            <Plus className="h-4 w-4" /> Add task
          </Button>
        </div>

        {loadError ? (
          <DataState error={loadError} onRetry={loadTasks} />
        ) : loadingTasks ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={ClipboardList}
              title="No tasks for this villa yet"
              description="Create the first work item — project, phase and villa are pre-filled for you."
              action={canEdit ? <Button onClick={() => navigate(`/tasks/new?location=${location.id}`)}>Create the first task</Button> : null}
            />
          </div>
        ) : (
          <>
            <TruncationBanner
              shown={tasks.length}
              total={taskTotal ?? undefined}
              noun="tasks"
              onLoadAll={loadAllTasks}
              loading={loadingAll}
              to={`/tasks?location=${location.id}`}
              className="mb-3"
            />
            <div className="rounded-xl border border-border bg-card">
              <TaskTable tasks={tasks} cat={cat} onOpen={(t) => navigate(`/tasks/${t.id}`)} />
            </div>
            <div className="space-y-3 md:hidden">
              {tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  cat={cat}
                  onOpen={() => navigate(`/tasks/${t.id}`)}
                />
              ))}
            </div>
            <p className="mt-2 hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <Zap className="h-3.5 w-3.5" /> Tap a row to open the task.
            </p>
          </>
        )}
      </section>
          </>
        )}
        {tab === 'daily' && (
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Daily updates
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every site report filed here, newest first — nothing is overwritten.
            </p>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => quick.openLogUpdate({ locationId: location.id })}>
              <CalendarPlus className="h-4 w-4" /> Log daily update
            </Button>
          )}
        </div>
        <DailyUpdateFeed
          key={quick.version}
          filter={{ location_id: location.id }}
          hideVilla
          emptyTitle="No daily updates for this location yet"
          emptyDescription="Log an update from the field and it appears here with the engineer, the time and any photos."
        />
      </section>
        )}
        {tab === 'snags' && location.location_type === 'Villa' && <SnagsTab location={location} canEdit={canEdit} />}
        {tab === 'drawings' && location.location_type === 'Villa' && <DrawingRegister location={location} canManage={canManage} />}
        {tab === 'rooms' && location.location_type === 'Villa' && <VillaScopePanel location={location} canManage={canManage} />}
      </div>

      <LocationDialog open={editOpen} onOpenChange={setEditOpen} location={location} cat={cat} />
    </>
  );
}