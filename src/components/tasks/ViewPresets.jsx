import React from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { copyText } from '@/lib/reportExport';
import { cn } from '@/lib/utils';

/** The views people ask for most, one tap each (N-04), and a button that copies the address of what is on screen. */
export const TASK_PRESETS = [
  { key: 'mine', label: 'My work', patch: { assignee: 'me', status: '' } },
  { key: 'blocked', label: 'Blocked', patch: { status: 'Blocked', assignee: '' } },
  { key: 'verify', label: 'Awaiting verification', patch: { status: 'Execution Complete', assignee: '' } },
  { key: 'closure', label: 'Approved, to close', patch: { status: 'Approved', assignee: '' } },
];

export default function ViewPresets({ filters, apply }) {
  const { toast } = useToast();
  const active = TASK_PRESETS.find((p) => Object.entries(p.patch).every(([k, v]) => (filters[k] || '') === v) && (filters.assignee || filters.status));
  const copy = async () => {
    const ok = await copyText(window.location.href);
    toast({ description: ok ? 'Link copied. It opens this same view.' : 'Could not copy the link.' });
  };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {TASK_PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => apply(p.patch)}
          className={cn('min-h-9 rounded-full border px-3 text-xs font-medium transition-colors', active?.key === p.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40')}
        >
          {p.label}
        </button>
      ))}
      <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-xs" onClick={copy}><Link2 className="h-3.5 w-3.5" /> Copy link</Button>
    </div>
  );
}
