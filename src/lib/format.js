import { format, isValid, parseISO } from 'date-fns';

export const EMPTY = '—';
export const IST_OFFSET_MINUTES = 330;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

/** A stored date or timestamp as a Date; null when it cannot be read. */
const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? parseISO(value) : new Date(value));
  return isValid(d) ? d : null;
};

/** The wall-clock parts of an instant in Asia/Kolkata. */
const istParts = (instant) => {
  const d = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
};
const istDate = (p) => `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`;
const istClock = (p) => `${pad(p.h)}:${pad(p.mi)}`;

/** Display date: DD-MMM-YY. */
export const formatDate = (value) => {
  const d = toDate(value);
  return d ? format(d, 'dd-MMM-yy') : EMPTY;
};

/** Same as formatDate but blank instead of a dash — for table cells and print. */
export const formatDateBlank = (value) => {
  const d = toDate(value);
  return d ? format(d, 'dd-MMM-yy') : '';
};

/** Timestamps are stored as UTC — render them in Asia/Kolkata. */
export const formatDateTime = (value) => {
  const d = toDate(value);
  if (!d) return EMPTY;
  const p = istParts(d);
  return `${pad(p.d)}-${MONTHS[p.mo]}-${String(p.y).slice(2)} ${istClock(p)}`;
};

export const todayIst = () => istDate(istParts(new Date()));

export const nowIst = () => {
  const p = istParts(new Date());
  return `${istDate(p)} ${istClock(p)}`;
};

/** Value for an <input type="date"> */
export const toDateInput = (value) => {
  const d = toDate(value);
  return d ? format(d, 'yyyy-MM-dd') : '';
};

export const formatDateTimeIst = (value) => (value ? formatDateTime(value) : '');
