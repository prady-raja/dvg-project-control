import React from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { dialDigits, whatsappLink } from '@/lib/shared/constraints.ts';
import { cn } from '@/lib/utils';

/**
 * A name with Call and WhatsApp beside it (K-05). The WhatsApp message arrives
 * filled in with the villa, task or snag it is about, so the person called knows
 * which crack or socket is meant. Without a number it shows the name alone.
 */
export default function ContactChip({ name, phone, message = '', label = '', className }) {
  const digits = dialDigits(phone);
  const text = message || (label ? `Hello ${name || ''} — about ${label}.` : `Hello ${name || ''}`);
  const wa = digits ? whatsappLink(phone, text) : '';
  const btn = 'inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border bg-card px-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground';
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-sm">{name || 'Not assigned'}</span>
      {digits && (
        <>
          <a href={`tel:+${digits}`} className={btn} aria-label={`Call ${name || 'contact'}`}><Phone className="h-4 w-4" aria-hidden /></a>
          <a href={wa} target="_blank" rel="noreferrer" className={btn} aria-label={`WhatsApp ${name || 'contact'}`}><MessageCircle className="h-4 w-4" aria-hidden /></a>
        </>
      )}
    </span>
  );
}
