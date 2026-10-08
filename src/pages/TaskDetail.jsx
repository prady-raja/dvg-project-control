import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Zap, Archive, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import DetailList from '@/components/common/DetailList';
import ProgressMeter from '@/components/tasks/ProgressMeter';
import QuickUpdateDialog from '@/components/tasks/QuickUpdateDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { archiveTask, restoreTask } from '@/lib/taskService';
import { formatDate, formatDateTime } from '@/lib/format';

const Section = ({ title, children }) => (
  <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
    {children}
  </section>
);

export default function TaskDetail() {
  const { taskId } = useParams();
  const cat = useCatalogs();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const record = await base44.entities.Task.get(taskId);
      setTask(record);
    } catch {
      setNotFound(true);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  if (cat.loading || (!task && !notFound)) return <Skeleton className="h-96 rounded-xl" />;

  if (notFound || !task) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Task not found</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/tasks">Back to the task register</Link>
        </Button>
      </div>
    );
  }

  const location = cat.locationById(task.location_id);
  const phase = cat.phaseById(task.phase_id);
  const project = cat.projectById(task.project_id);
  const contractor = cat.contractorById(task.contractor_id);

  const toggleArchive = async () => {
    if (task.archived) await restoreTask(task.id);
    else await archiveTask(task.id);
    load();
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5 text-muted-foreground">
        <Link to={`/tasks?project=${task.project_id}`}>
          <ArrowLeft className="h-4 w-4" /> Task register
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${task.task_ref}${task.is_demo ? ' · DEMO RECORD' : ''}`}
        title={task.name}
        description={task.description || undefined}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setQuickOpen(true)}>
              <Zap className="h-3.5 w-3.5" /> Quick update
            </Button>
            <Button size="sm" className="gap-2" onClick={() => navigate(`/tasks/${task.id}/edit`)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={toggleArchive}>
              {task.archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {task.archived ? 'Restore' : 'Archive'}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Pill value={task.status} />
        <Pill value={task.priority} />
        {task.archived && <Pill value="Archived" />}
        <span className="ml-1 text-xs text-muted-foreground">
          Progress <ProgressMeter value={task.progress_percent} className="ml-1 inline-flex align-middle" />
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Section title="Identification">
          <DetailList
            items={[
              { label: 'Task reference', value: task.task_ref, mono: true },
              { label: 'Project', value: project?.name },
              { label: 'Phase', value: phase ? `${phase.code ? `${phase.code} — ` : ''}${phase.name}` : '' },
              { label: 'Villa / Location', value: location?.villa_code },
              { label: 'Discipline', value: cat.disciplineName(task.discipline) },
              { label: 'Work package', value: task.work_package },
              { label: 'Parent task ID', value: task.parent_task_id, mono: true },
            ]}
          />
        </Section>

        <Section title="Responsibility">
          <DetailList
            items={[
              { label: 'Assigned contractor', value: contractor?.name },
              { label: 'Contractor type', value: contractor?.classification },
              { label: 'Responsible site engineer', value: task.responsible_engineer },
              { label: 'Created by', value: task.created_by_name },
              { label: 'Updated by', value: task.updated_by_name },
            ]}
          />
        </Section>

        <Section title="Progress">
          <DetailList
            items={[
              { label: 'Progress', value: <ProgressMeter value={task.progress_percent} /> },
              { label: 'Planned quantity', value: task.planned_quantity, mono: true },
              { label: 'Completed quantity', value: task.completed_quantity, mono: true },
              { label: 'Measurement unit', value: task.measurement_unit },
            ]}
          />
        </Section>

        <Section title="Scheduling">
          <DetailList
            items={[
              { label: 'Baseline start', value: formatDate(task.baseline_start), mono: true },
              { label: 'Baseline finish', value: formatDate(task.baseline_finish), mono: true },
              { label: 'Baseline approval', value: task.baseline_approval_status },
              { label: 'Current forecast finish', value: formatDate(task.current_forecast_finish), mono: true },
              { label: 'Actual start', value: formatDate(task.actual_start), mono: true },
              { label: 'Actual finish', value: formatDate(task.actual_finish), mono: true },
              { label: 'Date revision reason', value: task.date_revision_reason },
              { label: 'Expected delivery', value: formatDate(task.expected_delivery_date), mono: true },
            ]}
          />
        </Section>

        <Section title="Resources">
          <DetailList
            items={[
              { label: 'Planned manpower', value: task.planned_manpower, mono: true },
              { label: 'Actual manpower', value: task.actual_manpower, mono: true },
              { label: 'Estimated man-hours', value: task.estimated_manhours, mono: true },
              { label: 'Actual man-hours', value: task.actual_manhours, mono: true },
            ]}
          />
        </Section>

        <Section title="Supply & site access">
          <DetailList
            items={[
              { label: 'Supplied by', value: task.supplied_by },
              { label: 'Selection status', value: task.selection_status },
              { label: 'Procurement status', value: task.procurement_status },
              { label: 'Owner access required', value: task.owner_access_required },
              { label: 'Access status', value: task.access_status },
            ]}
          />
        </Section>

        <Section title="Blockers">
          <DetailList
            items={[
              { label: 'Blocker category', value: task.blocker_category },
              { label: 'Responsible party', value: task.blocker_responsible_party },
              { label: 'Blocked since', value: formatDate(task.blocked_since), mono: true },
              { label: 'Description', value: task.blocker_description },
            ]}
          />
        </Section>

        <Section title="Other">
          <DetailList
            items={[
              { label: 'Latest update', value: task.latest_update },
              { label: 'Remarks', value: task.remarks },
              { label: 'Attachment reference', value: task.attachment_ref },
              { label: 'Created', value: formatDateTime(task.created_date), mono: true },
              { label: 'Last updated', value: formatDateTime(task.updated_date), mono: true },
            ]}
          />
        </Section>
      </div>

      <QuickUpdateDialog
        task={task}
        open={quickOpen}
        onOpenChange={setQuickOpen}
        user={user}
        onSaved={() => {
          setQuickOpen(false);
          load();
        }}
      />
    </>
  );
}