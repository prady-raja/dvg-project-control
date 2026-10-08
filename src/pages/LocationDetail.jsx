import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Zap, CalendarPlus, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { items } from '@/lib/dataHelpers';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import DetailList from '@/components/common/DetailList';
import EmptyState from '@/components/common/EmptyState';
import TaskTable from '@/components/tasks/TaskTable';
import TaskCard from '@/components/tasks/TaskCard';
import QuickUpdateDialog from '@/components/tasks/QuickUpdateDialog';
import LocationDialog from '@/components/locations/LocationDialog';
import DailyUpdateFeed from '@/components/daily/DailyUpdateFeed';
import DailyUpdateDialog from '@/components/daily/DailyUpdateDialog';
import VillaScopePanel from '@/components/villa/VillaScopePanel';
import DrawingRegister from '@/components/drawings/DrawingRegister';
import TaskPickerDialog from '@/components/daily/TaskPickerDialog';
import { useAccess } from '@/lib/AccessContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function LocationDetail() {
  const { locationId } = useParams();
  const cat = useCatalogs();
  const { user } = useAuth();
  const access = useAccess();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [quickTask, setQuickTask] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reportTask, setReportTask] = useState(null);
  const [dailyRefresh, setDailyRefresh] = useState(0);

  const location = cat.locationById(locationId);
  const phase = location ? cat.phaseById(location.phase_id) : null;
  const project = location ? cat.projectById(location.project_id) : null;

  const loadTasks = useCallback(async () => {
    if (!locationId) return;
    setLoadingTasks(true);
    const res = await base44.entities.Task.filter(
      { location_id: locationId, archived: { $ne: true } },
      { sort: '-created_date', limit: 200 },
    );
    setTasks(items(res));
    setLoadingTasks(false);
  }, [locationId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5 text-muted-foreground">
        <Link to={`/locations?project=${location.project_id}${location.phase_id ? `&phase=${location.phase_id}` : ''}`}>
          <ArrowLeft className="h-4 w-4" /> Villas &amp; locations
        </Link>
      </Button>

      <PageHeader
        eyebrow={[project?.name, phase?.name, location.location_type].filter(Boolean).join(' · ')}
        title={location.villa_code}
        description={location.notes || undefined}
        actions={
          <>
            <Pill value={location.possession_status} />
            <Pill value={location.active_status} />
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to={`/locations/${location.id}/execution`}>
                <Activity className="h-3.5 w-3.5" /> Execution dashboard
              </Link>
            </Button>
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

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Task register for this location
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Works stay open and editable after handover. {tasks.length} task{tasks.length === 1 ? '' : 's'}.
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

        {loadingTasks ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={ClipboardList}
              title="No tasks for this villa yet"
              description="Create the first work item — project, phase and villa are pre-filled for you."
            />
          </div>
        ) : (
          <>
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
                  onQuickUpdate={setQuickTask}
                />
              ))}
            </div>
            <p className="mt-2 hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <Zap className="h-3.5 w-3.5" /> Tap a row to open the task.
            </p>
          </>
        )}
      </section>

      <section className="mt-8">
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
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setPickerOpen(true)}>
              <CalendarPlus className="h-4 w-4" /> Log daily update
            </Button>
          )}
        </div>
        <DailyUpdateFeed
          key={dailyRefresh}
          filter={{ location_id: location.id }}
          hideVilla
          emptyTitle="No daily updates for this location yet"
          emptyDescription="Log an update from the field and it appears here with the engineer, the time and any photos."
        />
      </section>

      <TaskPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projectId={location.project_id}
        locationId={location.id}
        onPick={(task) => {
          setPickerOpen(false);
          setReportTask(task);
        }}
      />

      <DailyUpdateDialog
        task={reportTask}
        open={!!reportTask}
        onOpenChange={(v) => !v && setReportTask(null)}
        onSaved={() => {
          setReportTask(null);
          setDailyRefresh((n) => n + 1);
        }}
      />

      <QuickUpdateDialog
        task={quickTask}
        open={!!quickTask}
        onOpenChange={(v) => !v && setQuickTask(null)}
        user={user}
        onSaved={() => {
          setQuickTask(null);
          loadTasks();
        }}
      />

      <LocationDialog open={editOpen} onOpenChange={setEditOpen} location={location} cat={cat} />
    </>
  );
}