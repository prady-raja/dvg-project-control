import React, { useEffect, useState } from 'react';
import { Plus, UsersRound, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogs } from '@/lib/CatalogContext';
import { items } from '@/lib/dataHelpers';
import { updateRecord } from '@/lib/recordService';
import PageHeader from '@/components/common/PageHeader';
import Pill from '@/components/common/Pill';
import MembershipDialog from '@/components/access/MembershipDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

export default function Access() {
  const cat = useCatalogs();
  const { user } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await base44.entities.ProjectMembership.filter({}, { sort: 'user_email', limit: 300 });
    setMemberships(items(res));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setActive = async (record, active) => {
    await updateRecord('ProjectMembership', record.id, { active });
    load();
  };

  const byProject = cat.projects.map((project) => ({
    project,
    members: memberships.filter((m) => m.project_id === project.id),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Users & access"
        title="Project membership"
        description="Who belongs to which project and in what role. Server-enforced project permissions are implemented and tested in Step 1B."
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add member
          </Button>
        }
      />

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-display text-base font-semibold">{user?.full_name || '—'}</p>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <div className="mt-3 flex items-center gap-2">
          <Pill value={user?.role === 'admin' ? 'Approved' : 'Active'} />
          <span className="text-xs text-muted-foreground">App role: {user?.role || 'user'}</span>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This is a private development build. Membership records are recorded here, but they do not yet restrict what a
          signed-in user can see or change — server-side project permissions are built and tested in Step 1B. Do not
          invite operational users or load owner information before then.
        </p>
      </div>

      {loading || cat.loading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : (
        <div className="space-y-5">
          {byProject.map(({ project, members }) => (
            <section key={project.id} className="rounded-xl border border-border bg-card">
              <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-sm font-semibold">{project.name}</h2>
                  <p className="field-mono text-[11px] text-muted-foreground">{project.code}</p>
                </div>
                <span className="field-mono shrink-0 text-xs text-muted-foreground">
                  {members.length} member{members.length === 1 ? '' : 's'}
                </span>
              </header>
              {members.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No members recorded for this project.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-display text-xs font-semibold">
                          {(m.user_name || m.user_email || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{m.user_name || m.user_email}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.user_email}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Pill value={m.role} className="bg-muted text-foreground border-border" />
                        <Switch checked={m.active !== false} onCheckedChange={(v) => setActive(m, v)} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {cat.projects.length === 0 && (
            <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
              <UsersRound className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <p className="font-display font-semibold">Create a project first</p>
            </div>
          )}
        </div>
      )}

      <MembershipDialog open={open} onOpenChange={setOpen} cat={cat} user={user} onSaved={load} />
    </>
  );
}