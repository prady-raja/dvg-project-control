import { describe, expect, it } from 'vitest';
import { daySheetRows } from '@/lib/logUpdate';

const tasks = [
  { id: 't1', status: 'In Progress', progress_percent: 40 },
  { id: 't2', status: 'Not Started', progress_percent: null },
  { id: 't3', status: 'In Progress', progress_percent: 10 },
];

describe('day sheet rows', () => {
  it('sends only what was changed', () => {
    const rows = daySheetRows({ t1: { status: 'In Progress', progress: 60 }, t2: {}, t3: { status: 'In Progress', progress: 10, note: '' } }, tasks);
    expect(rows).toEqual([{ client_ref: 't1', task_id: 't1', status: 'In Progress', progress_percent: 60, work_done: '' }]);
  });
  it('a note alone is a report', () => {
    expect(daySheetRows({ t2: { note: ' primer done ' } }, tasks)).toEqual([{ client_ref: 't2', task_id: 't2', status: 'Not Started', work_done: 'primer done' }]);
  });
  it('a status change counts, and a blank progress is left unmeasured', () => {
    expect(daySheetRows({ t2: { status: 'In Progress', progress: '' } }, tasks)).toEqual([{ client_ref: 't2', task_id: 't2', status: 'In Progress', work_done: '' }]);
  });
  it('nothing edited means nothing sent', () => expect(daySheetRows({}, tasks)).toEqual([]));
});
