import React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

/** Project › Phase › Location (› Task): where this page sits, each step a link (L-02). */
export default function LocationCrumbs({ project, phase, location, task }) {
  const steps = [
    project && { label: project.name, to: `/projects/${project.id}` },
    phase && { label: phase.name, to: `/locations?project=${phase.project_id || project?.id || ''}&phase=${phase.id}` },
    location && { label: location.villa_code, to: `/locations/${location.id}` },
    task && { label: task.task_ref || 'Task' },
  ].filter(Boolean);
  if (!steps.length) return null;
  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        {steps.map((step, i) => (
          <React.Fragment key={`${step.label}-${i}`}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {i === steps.length - 1 || !step.to
                ? <BreadcrumbPage>{step.label}</BreadcrumbPage>
                : <BreadcrumbLink asChild><Link to={step.to}>{step.label}</Link></BreadcrumbLink>}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
