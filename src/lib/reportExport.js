import { formatDateBlank } from '@/lib/format';

/** Copy plain text to the clipboard, tolerating older browsers. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const cell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows, columns) {
  const head = columns.map((column) => cell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => cell(column.value(row))).join(',')).join('\n');
  return `${head}\n${body}`;
}

/** The activity columns every board and report shares. */
export const ACTIVITY_COLUMNS = [
  { key: 'ref', label: 'Task ref', value: (row) => row.ref },
  { key: 'villa', label: 'Villa / location', value: (row) => row.villa },
  { key: 'name', label: 'Work', value: (row) => row.name },
  { key: 'discipline', label: 'Discipline', value: (row) => row.discipline_name },
  { key: 'contractor', label: 'Contractor', value: (row) => row.contractor },
  { key: 'engineer', label: 'Engineer', value: (row) => row.engineer },
  { key: 'baseline', label: 'Baseline finish', value: (row) => formatDateBlank(row.baseline_finish) },
  { key: 'forecast', label: 'Forecast finish', value: (row) => formatDateBlank(row.forecast_finish) },
  { key: 'status', label: 'Status', value: (row) => row.status },
  { key: 'blocker', label: 'Blocker', value: (row) => row.blocker },
];

export const todayStamp = () => new Date().toISOString().slice(0, 10);