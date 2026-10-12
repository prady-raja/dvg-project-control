import React, { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { IMPORT_COLUMNS } from '@shared/workImport.ts';
import EnumSelect from '@/components/common/EnumSelect';
import { Button } from '@/components/ui/button';

const OPTIONS = [{ value: '', label: 'Ignore this column' }, ...IMPORT_COLUMNS.map((c) => ({ value: c.key, label: c.label }))];

/**
 * Headings the app does not recognise. Each can be mapped to one of its columns;
 * the mapping is remembered for the next file with the same headings. A heading
 * that holds data but is left unmapped is called out, never dropped silently.
 */
export default function ColumnMappingPanel({ unrecognised = [], mapping = {}, onApply }) {
  const [draft, setDraft] = useState(mapping);
  if (!unrecognised.length) return null;
  const ignoredWithData = unrecognised.filter((u) => u.filled > 0 && !draft[u.heading]);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
        <Columns3 className="h-4 w-4" /> Match this file’s columns
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        These headings are not ones the app knows. Choose where each belongs, or leave it ignored. Your choice is remembered for files with the same headings.
      </p>
      <ul className="mt-3 space-y-2">
        {unrecognised.map((u) => (
          <li key={u.heading} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm">
              {u.heading} <span className="text-xs text-muted-foreground">· {u.filled} row{u.filled === 1 ? '' : 's'} filled in</span>
            </span>
            <div className="w-56">
              <EnumSelect value={draft[u.heading] || ''} onChange={(v) => setDraft((d) => ({ ...d, [u.heading]: v }))} options={OPTIONS} />
            </div>
          </li>
        ))}
      </ul>
      {ignoredWithData.length > 0 && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {ignoredWithData.length} column{ignoredWithData.length === 1 ? '' : 's'} with data will be ignored: {ignoredWithData.map((u) => u.heading).join(', ')}.
        </p>
      )}
      <div className="mt-3">
        <Button size="sm" onClick={() => onApply(Object.fromEntries(Object.entries(draft).filter(([, v]) => v)))}>
          Apply and re-read the file
        </Button>
      </div>
    </section>
  );
}
