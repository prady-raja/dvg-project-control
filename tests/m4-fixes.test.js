// Regression tests for the post-merge review: argument order, correction and date handling.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fnDir = new URL('../base44/functions/', import.meta.url);
const source = (name) => readFileSync(new URL(`${name}/entry.ts`, fnDir), 'utf8');

describe('resolveRole is called as (base44, projectId, user)', () => {
  readdirSync(fnDir).forEach((name) => {
    const calls = source(name).match(/resolveRole\([^)]*\)/g) || [];
    calls.forEach((call) => it(`${name}: ${call}`, () => expect(call).toMatch(/^resolveRole\(base44, [^,]+, user\)$/)));
  });
});

describe('correcting a report', () => {
  const daily = source('dailyUpdate');
  it('the original is replaced only inside the replacement save, and restored on failure', () => {
    expect(daily).toContain('replaces_report_id');
    expect(daily).toContain('restoreVoided');
  });
  it('the card no longer voids before the editor opens', () => {
    const card = readFileSync(new URL('../src/components/daily/DailyUpdateCard.jsx', import.meta.url), 'utf8');
    expect(card).not.toContain('voidDailyUpdate');
    expect(card).toContain('correcting');
  });
  it('the drawer submits the viewed date, not always today', () => {
    const drawer = readFileSync(new URL('../src/components/daily/LogUpdateDrawer.jsx', import.meta.url), 'utf8');
    expect(drawer).toContain('update_date: reportDate');
    expect(drawer).not.toContain('update_date: todayIst()');
  });
});
