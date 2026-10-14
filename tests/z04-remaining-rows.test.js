// The "rows still to upload" file keeps each kept row on its original worksheet row.
import { describe, expect, it } from 'vitest';
import { remainingRowsSheets } from '../src/lib/workImportService.js';
import { buildWorkbookFromSheets, readExcelWorkbook } from '../src/lib/xlsxImport.js';

const rawText = 'Villa/location code,Task description,Discipline\nB-01,Niche,Finishes\nB-01,Cubicals,Finishes\nA-12,Wiring,Electrical\nA-12,Plumbing,Plumbing';
const file = { name: 'works.xlsx', rawText, rowNumbers: [2, 3, 5, 9] };
const row = (n, outcome, extra = {}) => ({ row_number: n, reconcile: { outcome, label: outcome.toUpperCase(), match: {}, clarifications: [], ...extra } });
const preview = { rows: [row(2, 'create'), row(3, 'unchanged', { match: { task_ref: 'IMG-B-0003', batch_ref: 'IMP-1' } }), row(5, 'duplicate'), row(9, 'create')] };

describe('remaining rows file', () => {
  it('keeps only new rows, on their original rows, and lists the rest', async () => {
    const result = remainingRowsSheets({ file, preview, decisions: { 5: 'import' } });
    expect(result.kept).toBe(3);
    expect(result.left).toBe(1);
    expect(result.sheets.Left_Out[1].slice(0, 3)).toEqual([3, 'UNCHANGED', 'IMG-B-0003']);

    const blob = await buildWorkbookFromSheets(result.sheets);
    const back = await readExcelWorkbook({ arrayBuffer: async () => blob.arrayBuffer() });
    expect(back.rowNumbers).toEqual([2, 5, 9]);
    expect(back.text.split('\n')).toHaveLength(4);
  });
  it('does not keep a duplicate nobody decided to import', () => {
    expect(remainingRowsSheets({ file, preview, decisions: {} }).kept).toBe(2);
  });
});
