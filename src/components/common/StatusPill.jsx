import React from 'react';
import { Circle, CircleCheck, CirclePause, CirclePlay, Loader, OctagonAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OTHER_TOKENS, STATUS_TOKENS } from '@/lib/tokens';

const ICONS = { Circle, CircleCheck, CirclePause, CirclePlay, Loader, OctagonAlert };

/** A status as icon + colour + text, with a one-line explanation as its tooltip. */
export default function StatusPill({ status, className }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const token = STATUS_TOKENS[status] || OTHER_TOKENS[status];
  if (!token) return null;
  const Icon = ICONS[token.icon] || Circle;
  return (
    <span
      title={token.help}
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5',
        token.tone,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{status}</span>
    </span>
  );
}
