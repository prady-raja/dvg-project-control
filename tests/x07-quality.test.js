// X-07 — the small defects that eroded trust.
import { describe, expect, it } from 'vitest';
import { MAX_PHOTOS } from '@/lib/constants';
import { MAX_REPORT_PHOTOS } from '../base44/shared/dailyReportRules.ts';
import { todayIst } from '../base44/shared/dashboardCore.ts';
import { todayIst as clientToday } from '@/lib/format';

describe('X-07 quality sweep', () => {
  it('the photo picker stops at the same number the server accepts', () => {
    expect(MAX_PHOTOS).toBe(MAX_REPORT_PHOTOS);
  });

  it('"today" is the Asia/Kolkata day on both sides, even when UTC is still yesterday', () => {
    // 20:00 UTC on 1 Oct is 01:30 IST on 2 Oct.
    const lateUtc = Date.UTC(2026, 9, 1, 20, 0, 0);
    expect(todayIst(lateUtc)).toBe('2026-10-02');
    expect(clientToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
