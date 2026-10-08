import React from 'react';
import { cn } from '@/lib/utils';

export default function Field({ label, hint, required, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}