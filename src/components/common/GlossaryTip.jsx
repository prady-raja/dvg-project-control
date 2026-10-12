import React from 'react';
import { CircleHelp } from 'lucide-react';
import { glossaryFor } from '@/lib/glossary';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** A small "?" that explains one term in a sentence. */
export default function GlossaryTip({ term, className = '' }) {
  const entry = glossaryFor(term);
  if (!entry) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`What does ${term} mean?`} className={`inline-flex rounded-full text-muted-foreground hover:text-foreground ${className}`}>
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs leading-relaxed">
        <p className="mb-1 font-semibold">{entry.term}</p>
        {entry.meaning}
      </PopoverContent>
    </Popover>
  );
}
