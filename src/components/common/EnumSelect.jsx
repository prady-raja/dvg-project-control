import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const BLANK = '__blank__';

/**
 * Select over a list of enum values. Options may be plain strings or
 * { value, label } objects. A blank value shows the placeholder.
 */
export default function EnumSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  className,
  disabled,
  size = 'default',
}) {
  const normalised = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  // A "no selection" option ("All phases", "Unassigned") carries an empty value,
  // which the dropdown control refuses to render. It travels under this
  // placeholder and is mapped straight back to '' so callers keep seeing ''.
  const encode = (v) => (v === '' || v === undefined || v === null ? BLANK : v);
  const decode = (v) => (v === BLANK || v === '__clear__' ? '' : v);
  return (
    <Select value={encode(value)} onValueChange={(v) => onChange(decode(v))} disabled={disabled}>
      <SelectTrigger
        className={cn(size === 'sm' && 'h-9 text-sm', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {normalised.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">Nothing available</div>
        )}
        {normalised.map((o, index) => (
          <SelectItem key={`${o.label}-${index}`} value={encode(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}