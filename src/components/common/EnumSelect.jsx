import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
  return (
    <Select value={value || ''} onValueChange={(v) => onChange(v === '__clear__' ? '' : v)} disabled={disabled}>
      <SelectTrigger
        className={cn(size === 'sm' && 'h-9 text-sm', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {normalised.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">Nothing available</div>
        )}
        {normalised.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}