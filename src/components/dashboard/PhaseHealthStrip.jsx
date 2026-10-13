import React from 'react';
import { cn } from '@/lib/utils';

const RAG = {
  red: { label: 'Red', tone: 'border-red-300 bg-red-50 text-red-900', dot: 'bg-red-600' },
  amber: { label: 'Amber', tone: 'border-amber-300 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  green: { label: 'Green', tone: 'border-emerald-300 bg-emerald-50 text-emerald-900', dot: 'bg-emerald-600' },
};

/** One line per phase. The colour is always written out as well, and the rule is stated. */
export default function PhaseHealthStrip({ phases = [] }) {
  if (!phases.length) return null;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {phases.map((p) => {
          const rag = RAG[p.rag] || RAG.green;
          return (
            <div key={p.phase_id} className={cn('rounded-xl border p-3', rag.tone)}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn('h-2.5 w-2.5 rounded-full', rag.dot)} aria-hidden />
                {p.name} <span className="text-xs font-medium">— {rag.label}</span>
              </p>
              <p className="mt-1 text-xs">{p.open} open · {p.overdue} overdue · {p.at_risk} at risk · {p.blocked} blocked</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Red: 15% or more of open work overdue, or 10% or more blocked. Amber: anything overdue, blocked or at risk. Green: none of these.
      </p>
    </div>
  );
}
