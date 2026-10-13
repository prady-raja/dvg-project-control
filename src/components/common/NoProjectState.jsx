import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAccess } from '@/lib/AccessContext';
import EmptyState from '@/components/common/EmptyState';

/**
 * The screen a person sees before they belong to any project (U-04). An
 * administrator is told what to do next; everyone else is told who to ask.
 */
export default function NoProjectState({ icon, description }) {
  const access = useAccess();
  return (
    <EmptyState
      icon={icon}
      title="No project yet"
      description={access.appAdmin ? `${description} Create the first project to begin.` : `${description} Ask an administrator to add you to a project.`}
      action={access.appAdmin
        ? <Button asChild><Link to="/projects">Create a project</Link></Button>
        : <Button asChild variant="outline"><Link to="/help">How access works</Link></Button>}
    />
  );
}
