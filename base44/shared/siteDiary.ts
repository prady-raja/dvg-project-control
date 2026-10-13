/**
 * The site diary (F-03): what is recorded for one project and one IST day, checked
 * and tidied before it is stored. Headcount is the sum of the labour rows — each
 * crew counted once for the day, unlike task-level manpower which repeats a crew
 * for every task it worked on.
 */
import { fail } from './records.ts';

const clean = (value, max) => String(value === null || value === undefined ? '' : value).trim().slice(0, max);
const num = (value) => (value === '' || value === null || value === undefined ? null : Number(value));
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

export const MAX_LABOUR_ROWS = 40;
export const MAX_DELIVERIES = 40;

export const headcountOf = (labour = []) => labour.reduce((sum, row) => sum + (Number(row?.heads) || 0), 0);

export function diaryInput(input = {}, { today = '', backdateLimitDays = 7, shift } = {}) {
  const date = clean(input.diary_date, 10);
  if (!isDay(date)) throw fail('Choose the day this diary is for.');
  if (today && date > today) throw fail('A diary cannot be written for a day that has not happened.');
  if (today && shift && date < shift(today, -backdateLimitDays)) throw fail(`A diary can be written up to ${backdateLimitDays} days back.`);

  const seen = new Set();
  const labour = (Array.isArray(input.labour) ? input.labour : []).slice(0, MAX_LABOUR_ROWS).map((row) => {
    const raw = row?.heads;
    const heads = raw === '' || raw === null || raw === undefined ? NaN : Math.round(Number(raw));
    return {
      contractor_id: clean(row?.contractor_id, 80),
      contractor_name: clean(row?.contractor_name, 160),
      heads: Number.isFinite(heads) ? heads : NaN,
      villa_ids: (Array.isArray(row?.villa_ids) ? row.villa_ids : []).map((v) => clean(v, 80)).filter(Boolean).slice(0, 60),
    };
  }).filter((row) => row.contractor_id || row.contractor_name);
  labour.forEach((row) => {
    if (!Number.isInteger(row.heads) || row.heads < 0 || row.heads > 5000) throw fail(`Enter the number of people for ${row.contractor_name || 'each contractor'} (0 to 5000).`);
    const key = row.contractor_id || row.contractor_name.toLowerCase();
    if (seen.has(key)) throw fail(`${row.contractor_name || 'A contractor'} is listed twice. Count each crew once.`);
    seen.add(key);
  });

  const deliveries = (Array.isArray(input.deliveries) ? input.deliveries : []).slice(0, MAX_DELIVERIES).map((d) => ({
    material: clean(d?.material, 200),
    quantity: clean(d?.quantity, 80),
    task_id: clean(d?.task_id, 80),
    task_ref: clean(d?.task_ref, 40),
    notes: clean(d?.notes, 400),
    challan_uri: clean(d?.challan_uri, 500),
    mark_delivered: d?.mark_delivered === true,
  })).filter((d) => d.material);

  const stopped = num(input.work_stopped_hours);
  if (stopped !== null && (!Number.isFinite(stopped) || stopped < 0 || stopped > 24)) throw fail('Hours lost must be between 0 and 24.');
  if (stopped && !clean(input.work_stopped_reason, 300)) throw fail('Say why work stopped.');
  const rain = num(input.rain_mm);
  const temp = num(input.temperature_c);
  if (rain !== null && (!Number.isFinite(rain) || rain < 0 || rain > 1000)) throw fail('Rainfall must be between 0 and 1000 mm.');
  if (temp !== null && (!Number.isFinite(temp) || temp < -20 || temp > 60)) throw fail('Temperature must be between -20 and 60 °C.');

  return {
    diary_date: date,
    labour,
    total_heads: headcountOf(labour),
    weather_summary: clean(input.weather_summary, 200),
    temperature_c: temp,
    rain_mm: rain,
    weather_source: input.weather_source === 'Open-Meteo' ? 'Open-Meteo' : 'Manual',
    work_stopped_hours: stopped,
    work_stopped_reason: stopped ? clean(input.work_stopped_reason, 300) : '',
    deliveries,
    visitors: clean(input.visitors, 1000),
    incidents: clean(input.incidents, 2000),
    notes: clean(input.notes, 2000),
  };
}

/** Whether a day may still be changed: closed days are administrator-only. */
export function canChangeDiary(diary, { isAdmin }) {
  if (!diary || diary.closed !== true) return { ok: true };
  return isAdmin ? { ok: true } : { ok: false, reason: 'This day has been closed by an administrator.' };
}
