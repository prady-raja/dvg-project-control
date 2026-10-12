import React from 'react';
import { cn } from '@/lib/utils';
import GlossaryTip from '@/components/common/GlossaryTip';

const TILES = [
  { key: 'overdue_tasks', delta: 'overdue', label: 'Overdue', term: 'Overdue', metric: 'overdue', tone: 'danger', help: 'Still to be executed, and the finish date has passed.' },
  { key: 'at_risk_tasks', delta: 'at_risk', label: 'At risk', term: 'At risk', metric: 'at_risk', tone: 'warning', help: 'Due soon and not on track: no recent update, a predecessor still open, or blocked.' },
  { key: 'blocked_tasks', delta: 'blocked', label: 'Blocked', term: 'Blocked tasks', metric: 'blocked', tone: 'danger', help: 'Marked Blocked, or carrying a recorded blocker.' },
  { key: 'awaiting_verification', delta: 'awaiting_verification', label: 'Awaiting verification', term: 'Awaiting verification', metric: 'awaiting_verification', tone: 'default', help: 'Executed, waiting for DVG to inspect and approve. Not overdue.' },
];

const TONE = { danger: 'text-destructive', warning: 'text-[hsl(var(--warning))]', default: 'text-foreground' };

/** The four numbers management reads first. Each opens the list behind it and shows the change since last week once history exists. */
export default function HeadlineTiles({ metrics = {}, change, onOpen }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((tile) => {
        const value = metrics[tile.key] ?? 0;
        const delta = change?.deltas?.[tile.delta];
        return (
          <div key={tile.key} className="relative">
          <button
            type="button"
            title={tile.help}
            onClick={() => onOpen(tile.metric, `${tile.label} tasks`, tile.help)}
            className="rounded-xl border border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
          >
            <p className={cn('field-mono text-4xl font-semibold tnum', value ? TONE[tile.tone] : 'text-foreground')}>{value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {typeof delta === 'number'
                ? delta === 0 ? 'No change since last week' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} since ${change.since}`
                : 'Change shows after a week of history'}
            </p>
          </button>
          <GlossaryTip term={tile.term} className="absolute right-2.5 top-2.5" />
          </div>
        );
      })}
    </div>
  );
}
