// O-02 — adoption measured from the app's own reports.
import { describe, expect, it } from 'vitest';
import { adoptionView } from '../base44/shared/adoption.ts';
import { projectSettings } from '../base44/shared/calendar.ts';
import { GLOSSARY, glossaryFor } from '@/lib/glossary';
import { TASK_STATUSES } from '../base44/shared/enums.ts';
import { ATTENTION_CODES } from '../base44/shared/attention.ts';

const settings = projectSettings(null);
const locations = [
  { id: 'v1', location_type: 'Villa' }, { id: 'v2', location_type: 'Villa' }, { id: 'v3', location_type: 'Villa', active_status: 'On Hold' },
];
const members = [{ user_id: 'u1', name: 'Priya' }, { user_id: 'u2', name: 'Ravi' }];

describe('O-02 adoption', () => {
  const updates = [
    { reported_by_id: 'u1', update_date: '2026-10-12', location_id: 'v1' },
    { reported_by_id: 'u1', update_date: '2026-10-12', location_id: 'v1' },
    { reported_by_id: 'u1', update_date: '2026-10-10', location_id: 'v2' },
    { reported_by_id: 'u1', update_date: '2026-10-11', location_id: 'v2' }, // a Sunday: not a working day
    { reported_by_id: 'u2', update_date: '2026-10-12', location_id: 'v2', voided: true },
  ];
  const view = adoptionView({ updates, members, locations, settings, asOf: '2026-10-12', days: 7 });

  it('counts reports per person over the working days only, ignoring voided reports', () => {
    const priya = view.rows.find((r) => r.user_id === 'u1');
    expect(priya.total).toBe(3);
    expect(priya.days_reported).toBe(2);
    expect(view.working_days).toBe(6); // 7 days minus one Sunday
    expect(view.rows.find((r) => r.user_id === 'u2').total).toBe(0);
  });

  it('counts the villas reported today, leaving villas on hold out', () => {
    expect(view.villas_total).toBe(2);
    expect(view.villas_reported_today).toBe(1);
    expect(view.reports_today).toBe(2);
  });
});

describe('O-02 glossary', () => {
  it('explains every status and every Needs Attention issue', () => {
    TASK_STATUSES.forEach((s) => expect(glossaryFor(s)?.meaning).toBeTruthy());
    Object.values(ATTENTION_CODES).forEach((c) => expect(glossaryFor(c.label)).toBeTruthy());
  });

  it('has no term twice', () => {
    const terms = GLOSSARY.map((g) => g.term);
    expect(new Set(terms).size).toBe(terms.length);
  });
});
