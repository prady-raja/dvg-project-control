import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GLOSSARY } from '@/lib/glossary';
import { STATUS_TOKENS } from '@/lib/tokens';
import PageHeader from '@/components/common/PageHeader';
import StatusPill from '@/components/common/StatusPill';
import { Input } from '@/components/ui/input';

const FLOW = ['Not Started', 'In Progress', 'Execution Complete', 'Under Inspection', 'Approved', 'Closed'];

const HOW_TO = [
  { title: 'Log an update (about a minute)', steps: ['Tap + in the bottom bar, then Log update.', 'Choose the villa, then the task.', 'Tap the new status and a progress chip.', 'Add a photo if you have one, then Save. You can Undo straight away.'], to: '/today' },
  { title: 'Block a task', steps: ['Open Log update (or the task) and choose Blocked.', 'Say what is holding it up and who must clear it.', 'Set the date it should clear by — without one it cannot be chased.', 'When it clears, tap Resolve on the Blockers page.'], to: '/blockers' },
  { title: 'Raise a snag', steps: ['Tap + then Raise a snag.', 'Say what is wrong and, if you can, where in the villa.', 'Add a photo. Mark it if it must be fixed before handover.'], to: '/handover' },
  { title: 'Send an owner the pending works', steps: ['Open the villa and tap Pending works statement.', 'Check the list reads right.', 'Tap Share to send it on WhatsApp, or Print / PDF.'], to: '/matrix' },
  { title: 'Import a work list', steps: ['Open Import works and drop the Excel file.', 'Check each column is matched to the right heading.', 'Fix or decide the rows that need you, then confirm.', 'Changed your mind? Import history has Undo batch.'], to: '/import' },
  { title: 'Chase a blocker', steps: ['Open Blockers.', 'Find the owner’s group and tap Chase.', 'WhatsApp opens with the message ready.'], to: '/blockers' },
];

/** Help (O-02): the status lifecycle, a glossary and one-minute how-tos, in the same words the app uses. */
export default function Help() {
  const [term, setTerm] = useState('');
  const groups = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = q ? GLOSSARY.filter((g) => `${g.term} ${g.meaning}`.toLowerCase().includes(q)) : GLOSSARY;
    return [...new Set(list.map((g) => g.group))].map((group) => ({ group, entries: list.filter((g) => g.group === group) }));
  }, [term]);

  return (
    <>
      <PageHeader eyebrow="Help" title="Help & guides" description="How work moves through the app, what the words mean, and the tasks you do every day." />

      <section className="rounded-xl border border-border bg-card p-5" aria-label="Status lifecycle">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">How a task moves</h2>
        <ol className="mt-3 flex flex-wrap items-center gap-2">
          {FLOW.map((status, i) => (
            <li key={status} className="flex items-center gap-2">
              <StatusPill status={status} />
              {i < FLOW.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          <StatusPill status="Blocked" /> can happen to work that is still to be done, whenever something stops it; clearing the blocker puts it back in progress.
          Whoever marks work Execution Complete cannot also approve it — another person inspects it.
        </p>
        <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
          {FLOW.concat('Blocked').map((s) => <li key={s}><strong className="text-foreground">{s}</strong> — {STATUS_TOKENS[s].help}</li>)}
        </ul>
      </section>

      <section className="mt-6" aria-label="One-minute guides">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">One-minute guides</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {HOW_TO.map((card) => (
            <article key={card.title} className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">{card.title}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {card.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <Link to={card.to} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Open it</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-label="Glossary">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">What the words mean</h2>
          <Input className="max-w-xs" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search the glossary" aria-label="Search the glossary" />
        </div>
        <div className="space-y-4">
          {groups.map(({ group, entries }) => (
            <div key={group} className="rounded-xl border border-border bg-card">
              <h3 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
              <dl className="divide-y divide-border">
                {entries.map((e) => (
                  <div key={e.term} className="px-4 py-2.5 text-sm">
                    <dt className="font-medium">{e.term}</dt>
                    <dd className="text-muted-foreground">{e.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing in the glossary matches “{term}”.</p>}
        </div>
      </section>
    </>
  );
}
