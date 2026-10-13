import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EnumSelect from '@/components/common/EnumSelect';
import {
  EXCEL_EXTENSION,
  EXCEL_REFUSED,
  IMPORT_ACCEPT,
  readExcelWorkbook,
} from '@/lib/xlsxImport';
import { IMPORT_EXAMPLE_ROWS, IMPORT_RULES, IMPORT_TEMPLATE_HEADERS, MAX_FILE_BYTES } from '@/lib/workImportService';

export default function ImportUploadStep({ projects, projectId, onProjectChange, onFile, onError, busy, file }) {
  const [reading, setReading] = useState(false);
  const options = useMemo(() => projects.map((project) => ({ value: project.id, label: project.name })), [projects]);

  const refuse = (message, event) => {
    onError(message);
    setReading(false);
    if (event) event.target.value = '';
  };

  const [dragging, setDragging] = useState(false);

  const handleChange = async (event) => {
    await takeFile(event.target.files?.[0], event);
  };

  const onDrop = async (event) => {
    event.preventDefault();
    setDragging(false);
    if (!projectId) {
      onError('Choose the project first, then drop the file.');
      return;
    }
    await takeFile(event.dataTransfer?.files?.[0], null);
  };

  const takeFile = async (chosen, event) => {
    if (!chosen) return;
    onError('');

    if (EXCEL_REFUSED.test(chosen.name)) {
      refuse('That is an older or macro-enabled spreadsheet. Open it in Excel, use Save As → Excel Workbook (.xlsx), and upload that file.', event);
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      refuse('That file is larger than 8 MB. Split the work list into smaller files.', event);
      return;
    }
    if (EXCEL_EXTENSION.test(chosen.name)) {
      setReading(true);
      try {
        onFile({ name: chosen.name, ...(await readExcelWorkbook(chosen)) });
      } catch (error) {
        onError(error.message);
      } finally {
        setReading(false);
        if (event) event.target.value = '';
      }
      return;
    }
    if (!/\.(csv|txt)$/i.test(chosen.name)) {
      refuse('Upload an Excel workbook (.xlsx) or a CSV file (.csv).', event);
      return;
    }

    onFile({ name: chosen.name, text: await chosen.text(), sheet: '', rowNumbers: [] });
    if (event) event.target.value = '';
  };

  return (
    <div className="space-y-5">
      <section
        className={`rounded-xl border bg-card p-5 transition-colors ${dragging ? 'border-primary bg-secondary/40' : 'border-border'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
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
                Upload Excel or CSV
                <input
                  type="file"
                  accept={IMPORT_ACCEPT}
                  className="hidden"
                  onChange={handleChange}
                  disabled={!projectId || busy === 'preview' || reading}
                />
              </label>
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {file?.name ? (
                <>
                  <span className="field-mono">{file.name}</span>
                  {file.sheet ? <> · worksheet <span className="field-mono">{file.sheet}</span></> : ' · CSV'}
                  {file.rows ? ` · ${file.rows} work row(s)` : ''}
                </>
              ) : projectId ? (
                'Drop the file here or choose it. Nothing is written until you review the preview and confirm.'
              ) : (
                'Choose the project first.'
              )}
            </p>
          </div>
        </div>
        {(reading || busy === 'preview') && (
          <p className="mt-3 text-xs text-muted-foreground">
            {reading ? 'Reading the worksheet…' : 'Reading and checking the file…'}
          </p>
        )}
      </section>

      <details className="rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer font-display text-sm font-semibold">Import template and rules</summary>
        <div className="mt-4 space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
            {IMPORT_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-medium text-foreground">Excel workbook</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Work rows go on a worksheet named <span className="field-mono">Works</span>. Instructions, Review_Only and
              Villa_Mapping are reference sheets and are never imported. Download the Excel template for the standard
              workbook, with the column headings on the Works sheet.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Template columns, in order</p>
            <p className="field-mono mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {IMPORT_TEMPLATE_HEADERS.join(' · ')}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Example row</p>
            <p className="field-mono mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {IMPORT_EXAMPLE_ROWS[0].join(', ')}
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