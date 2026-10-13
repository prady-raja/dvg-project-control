import React, { cloneElement, isValidElement, useId } from 'react';
import { cn } from '@/lib/utils';

/** A labelled control. The label is tied to the control so a tap on it focuses the field and a screen reader reads it (U-02). */
export default function Field({ label, hint, required, children, className }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const only = React.Children.count(children) === 1 && isValidElement(children) && typeof children.type !== 'symbol';
  const control = only && !children.props.id
    ? cloneElement(children, { id, ...(hint ? { 'aria-describedby': hintId } : {}) })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={only ? children.props.id || id : undefined} className="block text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {control}
      {hint && <p id={hintId} className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
