import React from 'react';
import { Clock, CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HEALTH_TOKENS } from '@/lib/tokens';

const ICONS = { CircleCheck, TriangleAlert, Clock };

/** Schedule health, shown apart from status: On track, At risk or Late. */
export default function HealthBadge({ health, slipDays, className }) {
  const token = HEALTH_TOKENS[health];
  if (!token) return null;
  const Icon = ICONS[token.icon];
  const slip = typeof slipDays === 'number' && slipDays !== 0 ? ` · ${slipDays > 0 ? '+' : ''}${slipDays}d` : '';
  return (
    <span
      title={token.help}
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-5', token.tone, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {health}{slip}
    </span>
  );
}
