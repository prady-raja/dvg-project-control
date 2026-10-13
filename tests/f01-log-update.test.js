// F-01 — one Log update path: legal steps, progress chips, photo sizing, undo.
import { describe, expect, it } from 'vitest';
import {
  draftFrom, isRestorable, nextProgress, orderTasks, statusChips, withRecentVilla,
} from '@/lib/logUpdate';
import { fitWithin, uploadPhotos } from '@/lib/photoUpload';
import { appliedChanges, planVoid } from '../base44/shared/reportVoid.ts';

describe('F-01 status and progress chips', () => {
  it('offers the current status, the legal steps and Execution complete — never approval or closure', () => {
    const chips = statusChips({ status: 'Not Started' }).map((c) => c.status);
    expect(chips).toEqual(['Not Started', 'In Progress', 'Blocked', 'Execution Complete']);
    expect(chips).not.toContain('Approved');
    expect(chips).not.toContain('Closed');
  });

  it('Blocked opens the Block sheet instead of being a plain status', () => {
    const blocked = statusChips({ status: 'In Progress' }).find((c) => c.status === 'Blocked');
    expect(blocked.opensBlockSheet).toBe(true);
    const unblock = statusChips({ status: 'Blocked' }).find((c) => c.status === 'Blocked');
    expect(unblock.opensBlockSheet).toBe(false);
  });

  it('progress chips set a value and +10 adds, capped at 100', () => {
    expect(nextProgress(10, 50)).toBe(50);
    expect(nextProgress(10, '+10')).toBe(20);
    expect(nextProgress(95, '+10')).toBe(100);
    expect(nextProgress('', '+10')).toBe(10);
  });

  it('lists my open work first, then the most urgent', () => {
    const ordered = orderTasks([
      { id: 'a', task_ref: 'A', status: 'Not Started', baseline_finish: '2026-10-01' },
      { id: 'b', task_ref: 'B', status: 'In Progress', baseline_finish: '2026-12-01', assignee_user_id: 'me' },
      { id: 'c', task_ref: 'C', status: 'Blocked', baseline_finish: '2026-11-01' },
    ], { id: 'me' });
    expect(ordered.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('F-01 recent villas and the draft', () => {
  it('keeps the last five, newest first, without repeats', () => {
    let list = [];
    ['a', 'b', 'c', 'd', 'e', 'f', 'c'].forEach((id) => { list = withRecentVilla(list, id); });
    expect(list).toEqual(['c', 'f', 'e', 'd', 'b']);
  });

  it('a draft survives as ids only and expires after a day', () => {
    const draft = draftFrom({ taskId: 't1', note: 'half done', photos: [{ file_uri: 'u1', preview: 'blob:x', caption: 'crack' }] }, 1000);
    // The preview address is not kept; the caption and the original of a marked-up photo are.
    expect(draft.photos).toEqual([{ file_uri: 'u1', caption: 'crack', original_uri: '' }]);
    expect(isRestorable(draft, 1000 + 3600000)).toBe(true);
    expect(isRestorable(draft, 1000 + 25 * 3600000)).toBe(false);
    expect(isRestorable(draftFrom({}, 1000), 1000)).toBe(false);
  });
});

describe('F-01 photos', () => {
  it('shrinks the long side to 1600 and never enlarges', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('uploads three at a time, reports progress and names a photo that failed', async () => {
    let running = 0;
    let peak = 0;
    const progress = [];
    const files = Array.from({ length: 7 }, (_, i) => ({ name: `p${i}.jpg`, type: 'text/plain' }));
    const result = await uploadPhotos(files, {
      onProgress: (p) => progress.push(p.done),
      upload: async (file) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        if (file.name === 'p3.jpg') throw new Error('network');
        return `uri-${file.name}`;
      },
    });
    expect(peak).toBe(3);
    expect(result.photos.map((p) => p.file_uri)).toHaveLength(6);
    expect(result.failed).toEqual(['p3.jpg']);
    expect(progress[progress.length - 1]).toBe(7);
  });
});

describe('F-01 undo a report the same day', () => {
  const today = '2026-10-12';
  const report = {
    id: 'r1', reported_by_id: 'me', reported_at: '2026-10-12T05:00:00Z', update_date: today, created_date: '2026-10-12T05:00:01Z',
    applied: [{ field: 'status', from: 'Not Started', to: 'In Progress' }, { field: 'progress_percent', from: null, to: 40 }, { field: 'actual_start', from: null, to: today }],
    prev_latest_report_date: '2026-10-08',
  };
  const task = { latest_report_date: today, updated_date: '2026-10-12T05:00:00Z' };

  it('puts every changed field back and restores the previous report date', () => {
    const plan = planVoid({ report, task, userId: 'me', today });
    expect(plan.patch).toEqual({ actual_start: null, progress_percent: null, status: 'Not Started', latest_report_date: '2026-10-08' });
  });

  it('only the author, only today, only once', () => {
    expect(planVoid({ report, task, userId: 'someone', today }).error).toMatch(/person who filed/);
    expect(planVoid({ report, task, userId: 'me', today: '2026-10-13' }).error).toMatch(/day it was filed/);
    expect(planVoid({ report: { ...report, voided: true }, task, userId: 'me', today }).error).toMatch(/already/);
  });

  it('refuses when the task has moved on since', () => {
    expect(planVoid({ report, task: { ...task, latest_report_date: '2026-10-12', updated_date: '2026-10-12T09:00:00Z' }, userId: 'me', today }).error).toMatch(/changed after/);
    expect(planVoid({ report, task: { ...task, latest_report_date: '2026-10-13' }, userId: 'me', today }).error).toMatch(/newer report/);
  });

  it('a report filed as history only changes nothing on the task', () => {
    expect(planVoid({ report: { ...report, history_only: true }, task, userId: 'me', today })).toEqual({ patch: null });
  });

  it('records what a report changed, including the stamps the rules added', () => {
    const applied = appliedChanges({
      entries: [{ field_changed: 'status', old_value: 'Not Started', new_value: 'In Progress' }],
      effectsPatch: { actual_start: today, status: 'In Progress' },
      task: { actual_start: null },
    });
    expect(applied).toEqual([
      { field: 'status', from: 'Not Started', to: 'In Progress' },
      { field: 'actual_start', from: null, to: today },
    ]);
  });
});
