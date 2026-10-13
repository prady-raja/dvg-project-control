import React from 'react';

/** Why forecasts moved, ranked by days of slip (a Pareto): the causes worth fixing first. */
export default function DelayCauses({ causes = [] }) {
  if (!causes.length) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">No forecast has moved with a reason yet, so there are no delay causes to rank.</p>;
  }
  const max = Math.max(...causes.map((c) => c.slip_days || c.tasks), 1);
  return (
    <ul className="space-y-2" aria-label="Delay causes">
      {causes.map((c) => (
        <li key={c.category} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{c.category}</span>
            <span className="field-mono text-xs text-muted-foreground">{c.tasks} task{c.tasks === 1 ? '' : 's'} · {c.slip_days} day{c.slip_days === 1 ? '' : 's'} of slip · {c.cumulative_percent}% cumulative</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted" role="img" aria-label={`${c.category}: ${c.slip_days} days of slip`}>
            <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(((c.slip_days || c.tasks) / max) * 100, 3)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
