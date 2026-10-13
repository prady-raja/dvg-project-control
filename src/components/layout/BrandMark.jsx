import React from 'react';

export default function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--brand))] font-mono text-xs font-medium leading-none text-[hsl(var(--brand-foreground))]">
        DVG
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold leading-tight text-sidebar-foreground">
            Project Control
          </span>
          <span className="block truncate font-mono text-xs uppercase tracking-[0.16em] text-sidebar-foreground/50">
            Dream Valley Group
          </span>
        </span>
      )}
    </div>
  );
}