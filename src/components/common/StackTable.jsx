import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [role="combobox"]';

/**
 * Wrap a table to have it stack into cards on a phone (MVP gap, step 2). Each cell is
 * labelled from its column heading; the first three show (plus the villa, whichever column it is) and a tap opens the rest.
 * On a desktop nothing changes. Clicks on links, buttons and fields inside a card do
 * their own job and never fold it.
 */
export default function StackTable({ children, className }) {
  const ref = useRef(null);

  // Label cells from the heading, and mark the cards that have more to show. Runs after
  // every render so a table that gains rows stays labelled.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll('table').forEach((table) => {
      const heads = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach((tr) => {
        const cells = Array.from(tr.children);
        cells.forEach((td, i) => {
          if (heads[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i]);
          // Which villa a card is about is never folded away, wherever its column sits.
          if (/^villa\b/i.test(heads[i] || '')) td.setAttribute('data-keep', '');
        });
        if (cells.length > 3) tr.setAttribute('data-more', ''); else tr.removeAttribute('data-more');
      });
    });
  });

  const toggle = (event) => {
    if (event.target.closest(INTERACTIVE)) return;
    const tr = event.target.closest('tr[data-more]');
    if (!tr) return;
    if (tr.hasAttribute('data-open')) tr.removeAttribute('data-open'); else tr.setAttribute('data-open', '');
  };

  return <div ref={ref} className={cn('stack-table', className)} onClick={toggle}>{children}</div>;
}
