import DataState from '@/components/common/DataState';
import { errorMessageOf } from '@/lib/clientErrors';
import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { items } from '@/lib/dataHelpers';
import { updateRecord } from '@/lib/recordService';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import MembershipDialog from '@/components/access/MembershipDialog';
import MembershipList from '@/components/access/MembershipList';
import UsersPanel from '@/components/access/UsersPanel';
import { ROLE_GUIDE } from '@/lib/accessRules';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAccess } from '@/lib/AccessContext';

/**
 * Administration → Users & Access. The application administrator invites users,
 * records project membership and sets designations. Project Editors see the
 * roster read-only; every change is refused on the server for anyone else.
 */
export default function Access() {
  const cat = useCatalogs();
  const { user } = useAuth();
  const access = useAccess();
  const { toast } = useToast();
  const appAdmin = user?.role === 'admin';
  const [memberships, setMemberships] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [presetProject, setPresetProject] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await base44.entities.ProjectMembership.filter({}, { sort: 'user_email', limit: 300 });
      setMemberships(items(res));
      if (appAdmin) {
        const listed = await base44.entities.User.list();
        setUsers(items(listed));
      }
    } catch (e) {
      setLoadError(errorMessageOf(e, 'The people and access lists could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [appAdmin]);

  const change = async (record, changes, failure) => {
    try {
      await updateRecord('ProjectMembership', record.id, changes);
    } catch (e) {
      toast({ variant: 'destructive', description: `${failure}: ${e?.message || 'the server refused the change.'}` });
    }
    load();
  };
  const setActive = (record, active) => change(record, { active }, 'Access could not be changed');
  const setRole = (record, role) => change(record, { role }, 'The role could not be changed');

  // The signed-in user's real level, not an assumed one.
  const ownRoles = [...new Set(cat.projects.map((p) => access.roleFor(p.id)).filter(Boolean))];

  const byProject = cat.projects.map((project) => ({
    project,
    members: memberships.filter((m) => m.project_id === project.id),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users & access"
        description={
          appAdmin
            ? 'Invite users, set their designation, and decide which projects they work on. The five staff users all work at the Project Editor level.'
            : 'Who works on your projects and at what level. Only the application administrator may change users or membership.'
        }
      />

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-display text-base font-semibold">{user?.full_name || '—'}</p>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <div className="mt-3 flex items-center gap-2">
          <Pill value={appAdmin ? 'Approved' : 'Active'} />
          <span className="text-xs text-muted-foreground">
            {appAdmin ? 'Application administrator' : ownRoles.join(', ') || 'No project access yet'}
          </span>
        </div>
      </div>

      {!appAdmin && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-border bg-muted/60 p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Inviting users, changing permission levels and switching project access off are reserved for the application
            administrator. What you see here is read-only; the server refuses any change from your account.
          </p>
        </div>
      )}

      {loadError ? (
        <DataState error={loadError} onRetry={load} />
      ) : loading || cat.loading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : (
        <div className="space-y-6">
          {appAdmin && (
            <UsersPanel users={users} memberships={memberships} projects={cat.projects} onChanged={load} />
          )}
          <MembershipList
            groups={byProject}
            canEdit={appAdmin}
            onToggleActive={setActive}
            onChangeRole={setRole}
            onAdd={(projectId) => {
              setPresetProject(projectId);
              setOpen(true);
            }}
          />
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-sm font-semibold">What each level may do</h2>
            <ul className="mt-3 space-y-2">
              {ROLE_GUIDE.map((item) => (
                <li key={item.role} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.role}</span> — {item.detail}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <MembershipDialog open={open} onOpenChange={setOpen} cat={{ ...cat, presetProject }} user={user} onSaved={load} />
    </>
  );
}