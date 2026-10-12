import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAccess } from '@/lib/AccessContext';
import { defaultHome, savedHomePreference } from '@/lib/navigation';
import { Skeleton } from '@/components/ui/skeleton';

/** "/" sends each person to their own home: their choice, otherwise by designation. */
export default function HomeRedirect() {
  const access = useAccess();
  if (access.loading) return <Skeleton className="h-96 rounded-xl" />;
  const to = defaultHome({ designation: access.user?.designation, appAdmin: access.appAdmin, preference: savedHomePreference() });
  return <Navigate to={to} replace />;
}
