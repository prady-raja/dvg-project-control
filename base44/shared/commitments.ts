/**
 * What a promise is worth today (C-01). A commitment is stored Open until a person
 * confirms how it ended; an Open one whose date has passed is read as Missed
 * without any scheduled job, and without writing anything.
 */
const day = (value) => (value ? String(value).slice(0, 10) : '');

const addDays = (from, days) => {
  const base = Date.parse(`${day(from)}T00:00:00Z`);
  return Number.isNaN(base) ? '' : new Date(base + days * 86400000).toISOString().slice(0, 10);
};

/** The state to show: the stored one, except that Open and past its date is Missed. */
export function commitmentState(commitment, today) {
  const stored = commitment?.status || 'Open';
  const promised = day(commitment?.promised_date);
  if (stored === 'Open' && promised && promised < day(today)) return 'Missed';
  return stored;
}

export const withState = (commitment, today) => ({ ...commitment, state: commitmentState(commitment, today) });

/** Open, missed and due-this-week counts for a list of commitments. */
export function commitmentSummary(commitments = [], today) {
  const horizon = addDays(today, 7);
  const states = commitments.map((c) => ({ c, state: commitmentState(c, today) }));
  const missed = states.filter((s) => s.state === 'Missed');
  const due = states.filter((s) => s.state === 'Open' && day(s.c.promised_date) && day(s.c.promised_date) <= horizon);
  return {
    open: states.filter((s) => s.state === 'Open' || s.state === 'Missed').length,
    missed: missed.length,
    due_this_week: due.length,
    next: [...missed, ...due]
      .sort((a, b) => day(a.c.promised_date).localeCompare(day(b.c.promised_date)))
      .slice(0, 8)
      .map(({ c, state }) => ({
        id: c.id, task_id: c.task_id, task_ref: c.task_ref || '', commitment: c.commitment,
        promised_date: day(c.promised_date), contractor_id: c.contractor_id || '', state,
      })),
  };
}
