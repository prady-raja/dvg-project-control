import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import PageHeader from '@/components/common/PageHeader';
import TaskForm from '@/components/tasks/TaskForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

export default function TaskEditor() {
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const cat = useCatalogs();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [task, setTask] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    base44.entities.Task.get(taskId)
      .then((t) => {
        if (!cancelled) setTask(t);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const prefill = useMemo(() => {
    if (taskId) return null;
    const out = {};
    const locationId = searchParams.get('location');
    const locationRecord = locationId ? cat.locationById(locationId) : null;
    if (locationRecord) {
      out.project_id = locationRecord.project_id;
      out.phase_id = locationRecord.phase_id || '';
      out.location_id = locationRecord.id;
    } else {
      const projectId = searchParams.get('project');
      if (projectId) out.project_id = projectId;
      const phaseId = searchParams.get('phase');
      if (phaseId) out.phase_id = phaseId;
    }
    const discipline = searchParams.get('discipline');
    if (discipline) out.discipline = discipline;
    return out;
  }, [taskId, searchParams, cat]);

  if (cat.loading || (taskId && !task && !loadFailed)) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  if (taskId && loadFailed) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-display text-lg font-semibold">Task not found</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/tasks">Back to the task register</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5 text-muted-foreground">
        <Link to={taskId ? `/tasks/${taskId}` : '/tasks'}>
          <ArrowLeft className="h-4 w-4" /> {taskId ? 'Back to task' : 'Task register'}
        </Link>
      </Button>

      <PageHeader
        eyebrow={task ? task.task_ref : 'New work item'}
        title={task ? 'Edit task' : 'Create task'}
        description={
          task
            ? 'Essential fields stay on top; everything else sits under More Details.'
            : 'Project, phase and villa are pre-filled wherever the system already knows them.'
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <TaskForm
          initial={task}
          prefill={prefill}
          cat={cat}
          user={user}
          onCancel={() => navigate(taskId ? `/tasks/${taskId}` : '/tasks')}
          onSaved={(saved) => {
            toast({
              title: taskId ? 'Task updated' : 'Task created',
              description: `${saved.task_ref} saved.`,
            });
            navigate(`/tasks/${saved.id}`);
          }}
        />
      </div>
    </>
  );
}