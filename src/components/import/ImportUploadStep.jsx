import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import EnumSelect from '@/components/common/EnumSelect';
import { IMPORT_TEMPLATE_HEADERS } from '@/lib/workImportService';

const RULES = [
  'Project, Discipline and Task description are needed on every row.',
  'Work category is “Villa Work” or “Site-Wide Work”. Leave it blank when the villa column already makes it obvious.',
  'Dates: YYYY-MM-DD or DD-MMM-YY (2026-10-14 or 14-Oct-26). A date that cannot be read is reported, never guessed.',
  'Progress is a whole percentage 0–100. Leave it blank when progress is unknown — it stays blank, not 0%.',
  'Contractor may be left blank: the project default for that discipline and phase is applied. Nothing is invented.',
  'Priority and Status may be left blank: Medium and Not Started are used.',
  'Villa/location column: use the villa code as registered (A-01, B-05-06, B-14A). Original plot references are matched where they point to one villa; anything ambiguous is flagged for you to confirm.',
  'Excel work lists are cleaned and saved as CSV outside the app before importing.',
];

export default function ImportUploadStep({ projects, projectId, onProjectChange, onFile, onError, busy, file }) {
  const options = useMemo(() => projects.map((project) => ({ value: project.id, label: project.name })), [projects]);

  const handleChange = async (event) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (!/\.(csv|txt)$/i.test(chosen.name)) {
      onError('Choose a CSV file (.csv). Excel files are converted to CSV outside the app first.');
      event.target.value = '';
      return;
    }
    const text = await chosen.text();
    onFile(text, chosen.name);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="import-project">
              Project this file belongs to
            </label>
            <EnumSelect
              value={projectId}
              onChange={onProjectChange}
              options={options}
              placeholder="Choose a project"
              className="w-full"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Work list</span>
            <Button asChild variant="outline" className="gap-2">
              <label className="cursor-pointer">
                Choose CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleChange}
                  disabled={!projectId || busy === 'preview'}
                />
              </label>
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {file?.name ? (
                <span className="field-mono">{file.name}</span>
              ) : projectId ? (
                'Nothing is written until you review the preview and confirm.'
              ) : (
                'Choose the project first.'
              )}
            </p>
          </div>
        </div>
        {busy === 'preview' && <p className="mt-3 text-xs text-muted-foreground">Reading and checking the file…</p>}
      </section>

      <details className="rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer font-display text-sm font-semibold">Import template and rules</summary>
        <div className="mt-4 space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-medium text-foreground">Template columns, in order</p>
            <p className="field-mono mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {IMPORT_TEMPLATE_HEADERS.join(' · ')}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Example row</p>
            <p className="field-mono mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Imagine, A, A-01, Villa Work, FIN, Painting, Repaint bedroom ceilings, Hariom, , High, In Progress, 2026-10-10,
              2026-10-20, , 40, 120, , , IMG-EXCEL-14
            </p>
          </div>
        </div>
      </details>

      <section className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Repeated imports are caught before anything is written</p>
        <p className="mt-1">
          A file that has already been imported is reported by its file fingerprint, and rows whose work is already on the
          register are offered as links rather than silently created a second time.
        </p>
      </section>
    </div>
  );
}