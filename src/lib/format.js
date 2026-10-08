import moment from 'moment';

export const EMPTY = '—';
export const IST_OFFSET_MINUTES = 330;

/** Display date: DD-MMM-YY in Asia/Kolkata. */
export const formatDate = (value) => (value ? moment(value).format('DD-MMM-YY') : EMPTY);

/** Same as formatDate but blank instead of a dash — for table cells and print. */
export const formatDateBlank = (value) => (value ? moment(value).format('DD-MMM-YY') : '');

/** Timestamps are stored as UTC — render them in Asia/Kolkata. */
export const formatDateTime = (value) =>
  value ? moment.utc(value).utcOffset(IST_OFFSET_MINUTES).format('DD-MMM-YY HH:mm') : EMPTY;

export const todayIst = () => moment.utc().utcOffset(IST_OFFSET_MINUTES).format('YYYY-MM-DD');

export const nowIst = () => moment.utc().utcOffset(IST_OFFSET_MINUTES).format('YYYY-MM-DD HH:mm');

/** Value for an <input type="date"> */
export const toDateInput = (value) => (value ? moment(value).format('YYYY-MM-DD') : '');

export const formatDateTimeIst = (value) => (value ? moment.utc(value).utcOffset(IST_OFFSET_MINUTES).format('DD-MMM-YY HH:mm') : '');