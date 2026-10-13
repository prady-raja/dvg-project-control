import React, { Children, isValidElement, useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const textOf = (node) => Children.toArray(node).map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement(c) ? textOf(c.props.children) : '')).join('');

/**
 * A select you can type into (U-03): for villas, contractors, tasks and members,
 * where a plain list of a hundred names is slow on a phone. It takes either
 * `options` ({ value, label } or strings) or native-style <option> children, and
 * calls onChange with the value (or, for <option> children, a { target: { value } }
 * event, so a page can swap a native <select> for it without rewriting its handler).
 */
export default function SearchableSelect({ value, onChange, options, children, placeholder = 'Select', className, disabled, searchPlaceholder = 'Type to search…' }) {
  const [open, setOpen] = useState(false);
  const fromChildren = !options;
  const list = useMemo(() => {
    if (options) return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    return Children.toArray(children)
      .filter((c) => isValidElement(c) && c.type === 'option')
      .map((c) => ({ value: c.props.value ?? textOf(c.props.children), label: textOf(c.props.children) }));
  }, [options, children]);
  const selected = list.find((o) => String(o.value) === String(value ?? ''));
  const emit = (v) => onChange?.(fromChildren ? { target: { value: v } } : v);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn('flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm disabled:opacity-50', className)}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.label || placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup>
              {list.map((o, i) => (
                <CommandItem
                  key={`${o.value}-${i}`}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => { emit(o.value); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', String(o.value) === String(value ?? '') ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
