import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GitBranch } from 'lucide-react';
import Pill from '@/components/common/Pill';

/**
 * A dependency chain drawn only from recorded TaskDependency links. Where no
 * link is recorded the chain stops and says so — the screen never implies a
 * sequence the database does not hold.
 */
export default function DependencyChain({ chain }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <Link to={`/tasks/${chain.root.id}`} className="field-mono text-xs font-semibold hover:underline">
          {chain.root.ref}
        </Link>
        <span className="text-sm">{chain.root.name}</span>
        <span className="text-xs text-muted-foreground">{chain.root.villa} · {chain.root.discipline_name}</span>
        <Pill value={chain.root.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chain.nodes.map((node, index) => (
          <React.Fragment key={`${node.id}-${index}`}>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Link
              to={`/tasks/${node.id}`}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:border-primary/40"
            >
              <span className="field-mono font-semibold">{node.ref}</span>
              <span className="ml-2 text-muted-foreground">{node.discipline_name}</span>
            </Link>
          </React.Fragment>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Drawn from {chain.nodes.length} recorded dependency link(s). Where no further link exists the chain ends here.
      </p>
    </div>
  );
}