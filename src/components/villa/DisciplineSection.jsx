import React from 'react';
import ProgressNote from '@/components/common/ProgressNote';
import ActivityRows from '@/components/common/ActivityRows';

/** One discipline of a villa's work: counts, measured progress, and the tasks. */
export default function DisciplineSection({ group, onTask }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold">{group.discipline_name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {group.counts.open} open · {group.counts.overdue} overdue · {group.counts.blocked} blocked ·{' '}
            {group.counts.awaitingVerification} awaiting verification
          </p>
        </div>
      </header>
      <div className="grid gap-3 p-4 lg:grid-cols-4">
        <ProgressNote progress={group.progress} counts={group.counts} className="lg:col-span-1" />
        <div className="lg:col-span-3">
          <ActivityRows
            rows={group.tasks}
            emptyLabel="No task recorded for this discipline on this villa."
            rowAction={onTask}
            rowActionLabel="Open"
          />
        </div>
      </div>
    </section>
  );
}