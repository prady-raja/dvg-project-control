import React, { useCallback, useEffect, useState } from 'react';
import { data } from '@/api/data';
import { errorMessageOf } from '@/lib/clientErrors';
import { matchMember } from '@shared/assignees.ts';
import DataState from '@/components/common/DataState';
import EnumSelect from '@/components/common/EnumSelect';
import { Button } from '@/components/ui/button';
import { forgetProjectMembers } from '@/hooks/useProjectMembers';

/**
 * Names typed before work could be assigned to real accounts. Each distinct name
 * that still has no linked user is listed once with a suggested match; choosing a
 * person and applying links every task, villa and commitment carrying that name.
 */
export default function NamesFixup({ project, members }) {
  const [state, setState] = useState({ loading: true, error: '', names: [] });
  const [choice, setChoice] = useState({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ loading: true, error: '', names: [] });
    try {
      const filter = { project_id: project.id, archived: { $ne: true } };
      const [tasks, locations, commitments] = await Promise.all([
        data.readAll('Task', filter, { fields: ['responsible_engineer', 'assignee_user_id'], max: 20000 }),
        data.readAll('Location', { project_id: project.id }, { fields: ['assigned_engineer', 'assigned_engineer_user_id'] }),
        data.readAll('MeetingCommitment', { project_id: project.id }, { fields: ['responsible_person', 'responsible_user_id'] }),
      ]);
      const counts = new Map();
      const bump = (name) => name && counts.set(name, (counts.get(name) || 0) + 1);
      tasks.items.forEach((t) => !t.assignee_user_id && bump(String(t.responsible_engineer || '').trim()));
      locations.items.forEach((l) => !l.assigned_engineer_user_id && bump(String(l.assigned_engineer || '').trim()));
      commitments.items.forEach((c) => !c.responsible_user_id && bump(String(c.responsible_person || '').trim()));
      const names = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      setState({ loading: false, error: '', names });
      setChoice(Object.fromEntries(names.map(({ name }) => [name, matchMember(name, members)?.user_id || ''])));
    } catch (e) {
      setState({ loading: false, error: errorMessageOf(e, 'The names could not be read.'), names: [] });
    }
  }, [project.id, members]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async () => {
    const mapping = Object.fromEntries(Object.entries(choice).filter(([, userId]) => userId));
    if (!Object.keys(mapping).length) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await data.invoke('migrate', { action: 'assign_names', projectId: project.id, mapping, dryRun: false });
      setStatus(`Linked ${result.written} record(s)${result.failed ? `, ${result.failed} failed` : ''}.`);
      forgetProjectMembers(project.id);
      await load();
    } catch (e) {
      setStatus(errorMessageOf(e, 'The names could not be linked.'));
    } finally {
      setBusy(false);
    }
  };

  const options = [{ value: '', label: 'Leave as typed' }, ...members.map((m) => ({ value: m.user_id, label: m.name }))];

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <h2 className="font-display text-sm font-semibold">Names to link — {project.name}</h2>
        <p className="text-xs text-muted-foreground">
          These engineer and owner names were typed as text. Suggested matches are filled in; check them, then apply. Nothing typed is erased.
        </p>
      </header>
      <div className="px-5 py-3">
        <DataState loading={state.loading} error={state.error} onRetry={load} empty={!state.names.length} emptyTitle="Every name is linked" emptyDescription="Nothing typed is waiting for a match.">
          <ul className="divide-y divide-border">
            {state.names.map(({ name, count }) => (
              <li key={name} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{name} <span className="text-xs text-muted-foreground">· {count} record{count === 1 ? '' : 's'}</span></span>
                <div className="w-52">
                  <EnumSelect value={choice[name] || ''} onChange={(v) => setChoice((c) => ({ ...c, [name]: v }))} options={options} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" onClick={apply} disabled={busy}>{busy ? 'Linking…' : 'Link chosen names'}</Button>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>
        </DataState>
      </div>
    </section>
  );
}
