import React, { useState } from 'react';
import MemberDetailsDialog from '@/components/access/MemberDetailsDialog';
import { Plus } from 'lucide-react';
import Pill from '@/components/common/Pill';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import EnumSelect from '@/components/common/EnumSelect';
import { ASSIGNABLE_ROLES } from '@/lib/shared/enums.ts';

/** One section per project: who is on it, at what level, and whether access is live. */
export default function MembershipList({ groups, canEdit = false, onToggleActive, onChangeRole, onAdd, onChanged }) {
  const [detailsFor, setDetailsFor] = useState(null);
  return (
    <div className="space-y-5">
      <MemberDetailsDialog open={!!detailsFor} onOpenChange={(v) => !v && setDetailsFor(null)} member={detailsFor} onSaved={onChanged} />
      {groups.map(({ project, members }) => (
        <section key={project.id} className="rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-sm font-semibold">{project.name}</h2>
              <p className="field-mono text-xs text-muted-foreground">{project.code}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="field-mono text-xs text-muted-foreground">
                {members.length} member{members.length === 1 ? '' : 's'}
              </span>
              {canEdit && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAdd(project.id)}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
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
                      <p className="truncate text-xs text-muted-foreground">{m.user_email}{m.phone ? ` · ${m.phone}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Pill value={m.user_id ? 'Active' : 'Pending Setup'} />
                    {canEdit ? (
                      <>
                        <div className="w-40">
                          <EnumSelect
                            value={m.role}
                            onChange={(v) => v && v !== m.role && onChangeRole?.(m, v)}
                            options={ASSIGNABLE_ROLES.includes(m.role) ? ASSIGNABLE_ROLES : [m.role, ...ASSIGNABLE_ROLES]}
                          />
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setDetailsFor(m)}>Details</Button>
                        <Switch checked={m.active !== false} onCheckedChange={(v) => onToggleActive(m, v)} />
                      </>
                    ) : (
                      <Pill value={m.role} className="border-border bg-muted text-foreground" />
                    )}
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