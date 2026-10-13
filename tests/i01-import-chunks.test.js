// I-01 — a full work list in chunks, with remembered column mapping.
import { describe, expect, it } from 'vitest';
import {
  addCounts, applyHeaderMapping, headerFingerprint, mergePreviews, mergeResults, restrictToRows, splitIntoChunks, unrecognisedHeadings,
} from '../base44/shared/importChunks.ts';
import { readImportFile } from '../base44/shared/workImport.ts';

const header = 'Villa/location code,Task description,Remarks\n';
const makeCsv = (n) => header + Array.from({ length: n }, (_, i) => `A-${String(i + 1).padStart(2, '0')},"Task ${i + 1}, with comma",note ${i + 1}`).join('\n');

describe('I-01 chunks', () => {
  it('splits a long file into chunks that each read like a small file', () => {
    const chunks = splitIntoChunks(makeCsv(600), { size: 250 });
    expect(chunks.map((c) => c.rowNumbers.length)).toEqual([250, 250, 100]);
    const second = readImportFile(chunks[1].text, { rowNumbers: chunks[1].rowNumbers });
    expect(second.total).toBe(250);
    expect(second.rows[0].row_number).toBe(252); // the file's own row number, not 2
    expect(second.rows[0].values.name).toBe('Task 251, with comma');
  });

  it('keeps worksheet row numbers when they are supplied (blank rows in Excel)', () => {
    const numbers = [3, 4, 7];
    const [only] = splitIntoChunks(makeCsv(3), { rowNumbers: numbers });
    expect(only.rowNumbers).toEqual(numbers);
  });

  it('a file with no data rows is returned as one chunk and left to the server to refuse', () => {
    expect(splitIntoChunks(header)).toHaveLength(1);
  });

  it('restricts decisions to the rows of a chunk', () => {
    expect(restrictToRows({ 2: 'a', 300: 'b', 301: 'c' }, [300, 301])).toEqual({ 300: 'b', 301: 'c' });
  });

  it('adds counts and keeps non-numbers', () => {
    expect(addCounts({ a: 1, label: 'x' }, { a: 2, b: 3 })).toEqual({ a: 3, label: 'x', b: 3 });
  });

  it('merges chunk previews as if the file were read at once', () => {
    const merged = mergePreviews([
      { file: { rows: 250, name: 'f' }, summary: { total: 250, valid: 240 }, reconciliation: { create: 250 }, rows: [{ row_number: 2 }], prior_batches: [] },
      { file: { rows: 100 }, summary: { total: 100, valid: 100 }, reconciliation: { create: 90, update: 10 }, rows: [{ row_number: 252 }] },
    ]);
    expect(merged.file.rows).toBe(350);
    expect(merged.summary).toEqual({ total: 350, valid: 340 });
    expect(merged.reconciliation).toEqual({ create: 340, update: 10 });
    expect(merged.rows.map((r) => r.row_number)).toEqual([2, 252]);
  });

  it('merges chunk results into one report', () => {
    const merged = mergeResults([
      { batch_ref: 'IMP-1', counts: { created: 250 }, created: [{ row_number: 2 }], failed: [], by_villa: [{ label: 'A-01', count: 2 }] },
      { batch_ref: 'IMP-1', counts: { created: 10, failed: 1 }, created: [{ row_number: 252 }], failed: [{ row_number: 253 }], by_villa: [{ label: 'A-01', count: 1 }, { label: 'A-02', count: 4 }] },
    ]);
    expect(merged.counts).toEqual({ created: 260, failed: 1 });
    expect(merged.created).toHaveLength(2);
    expect(merged.failed).toHaveLength(1);
    expect(merged.by_villa).toEqual([{ label: 'A-02', count: 4 }, { label: 'A-01', count: 3 }]);
  });
});

describe('I-01 column mapping', () => {
  const text = 'Plot,Work,Contractor Name,Site Notes\nA-01,Paint walls,Alpha,call first\nA-02,Fix door,,\n';

  it('finds headings the app does not know and how many rows use them', () => {
    expect(unrecognisedHeadings(text)).toEqual([
      { heading: 'Work', filled: 2 },
      { heading: 'Site Notes', filled: 1 },
    ]);
  });

  it('renames mapped headings so the file reads as a normal work list', () => {
    const mapped = applyHeaderMapping(text, { Work: 'name', 'Site Notes': 'remarks' });
    const file = readImportFile(mapped);
    expect(file.error).toBeUndefined();
    expect(file.rows[0].values).toMatchObject({ villa_code: 'A-01', name: 'Paint walls', contractor: 'Alpha', remarks: 'call first' });
    expect(file.unmapped).toEqual([]);
  });

  it('never overrides a heading the app already knows, or claims a column twice', () => {
    const mapped = applyHeaderMapping('Task description,Work\nA,B\n', { Work: 'name' });
    expect(readImportFile(mapped).rows[0].values.name).toBe('A');
    const twice = applyHeaderMapping('Foo,Bar,Task description\n1,2,3\n', { Foo: 'remarks', Bar: 'remarks' });
    expect(readImportFile(twice).rows[0].values.remarks).toBe('1');
  });

  it('recognises the same source again by its headings', () => {
    expect(headerFingerprint(text)).toBe(headerFingerprint(text.replace('A-01', 'B-07')));
    expect(headerFingerprint(text)).not.toBe(headerFingerprint('Other,Headings\n1,2\n'));
  });
});
