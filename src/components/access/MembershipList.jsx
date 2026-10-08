import React from 'react';
import { Plus } from 'lucide-react';
import Pill from '@/components/common/Pill';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

/** One section per project: who is on it, at what level, and whether access is live. */
export default function MembershipList({ groups, onToggleActive, onAdd }) {
  return (
    <div className="space-y-5">
      {groups.map(({ project, members }) => (
        <section key={project.id} className="rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-sm font-semibold">{project.name}</h2>
              <p className="field-mono text-[11px] text-muted-foreground">{project.code}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="field-mono text-xs text-muted-foreground">
                {members.length} member{members.length === 1 ? '' : 's'}
              </span>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAdd(project.id)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </header>
          {members.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No members recorded for this project.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
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
                    <Pill value={m.user_id ? 'Active' : 'Pending Setup'} />
                    <Pill value={m.role} className="border-border bg-muted text-foreground" />
                    <Switch checked={m.active !== false} onCheckedChange={(v) => onToggleActive(m, v)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}