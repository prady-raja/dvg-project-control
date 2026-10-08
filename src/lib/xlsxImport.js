/**
 * Excel workbooks for Import Works.
 *
 * The browser reads the `Works` worksheet and turns it into the same CSV text
 * the server has always validated, so an Excel row and a CSV row travel one
 * validation path and cannot drift apart. Nothing is decided here: this module
 * only reads what the cells hold. Every villa, plot, floor, room, contractor and
 * date is still resolved by the server, and nothing is written until the file
 * has been previewed, corrected and confirmed.
 *
 * Only saved cell values are read. A formula is never evaluated — a formula cell
 * imports the value Excel last saved — and a macro can never run, because the
 * workbook is read as a document, not as a program.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The worksheet the work rows live on; every other sheet is reference only. */
export const WORKS_SHEET = 'Works';

/** The reference sheets a workbook may carry. They are never imported. */
export const IGNORED_SHEETS = ['Instructions', 'Review_Only', 'Villa_Mapping'];

export const EXCEL_EXTENSION = /\.xlsx$/i;
/** Spreadsheets we do not read, each with its own message. */
export const EXCEL_REFUSED = /\.(xls|xlsm|xlsb|xlt|xltm|xltx|ods|numbers|gsheet)$/i;
export const IMPORT_ACCEPT = '.xlsx,.csv,.txt';

/** Kept in step with the server's own row limit. */
export const MAX_WORKS_ROWS = 500;

let loader = null;
/** The workbook library is fetched only when a spreadsheet is actually used. */
const xlsxLib = () => {
  if (!loader) loader = import('xlsx').then((mod) => mod.default || mod);
  return loader;
};

const pad = (value) => String(value).padStart(2, '0');

/**
 * One cell as the text the work list means.
 *
 * Numbers stay numbers, text identifiers keep their exact characters, and a date
 * becomes YYYY-MM-DD from the workbook's own calendar — the calendar date is read
 * from the stored serial, so no time zone can shift it by a day.
 */
function cellText(cell, XLSX) {
  if (!cell) return '';
  const value = cell.v;
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (cell.t === 'e') return '';
  if (cell.t === 'b') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    const format = cell.z ? String(cell.z) : '';
    // A percentage cell holds 0.4 and shows 40%: read it as the 40 it means.
    if (format.includes('%')) return String(Math.round(value * 100000) / 1000);
    // A cell Excel formats as a date but holds as a serial.
    if (format && XLSX.SSF && XLSX.SSF.is_date && XLSX.SSF.is_date(format)) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (parts && parts.y) return `${parts.y}-${pad(parts.m)}-${pad(parts.d)}`;
    }
    return String(value);
  }
  return String(value);
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Every row of the sheet with its real worksheet row number, blanks included. */
function rowsOf(XLSX, sheet) {
  const ref = sheet && sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const cells = [];
    let filled = false;
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const text = cellText(sheet[XLSX.utils.encode_cell({ r, c })], XLSX);
      if (text !== '') filled = true;
      cells.push(text);
    }
    rows.push({ excel_row: r + 1, cells, filled });
  }
  return rows;
}

const explainReadFailure = (error) => {
  const message = String((error && error.message) || error || '');
  if (/password|encrypt/i.test(message)) {
    return 'That workbook is password-protected. Open it in Excel, remove the password (File → Info → Protect Workbook), and upload it again.';
  }
  return 'That file could not be opened as an Excel workbook. It may be damaged, or saved in the older .xls format — open it in Excel, save it as .xlsx, and upload that.';
};

/**
 * The `Works` sheet as CSV text, plus the worksheet row each data row sits on so
 * every imported activity can be traced back to the line the person sees in
 * Excel. Completely empty rows are ignored — and they do not disturb the row
 * numbers of the rows that follow them.
 */
export async function readExcelWorkbook(file) {
  if (!file) throw new Error('Choose a workbook first.');
  const XLSX = await xlsxLib();

  let book;
  try {
    book = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
      cellFormula: false, // formulas are not read, let alone evaluated
      cellHTML: false,
      cellNF: true, // the number format tells a percentage from a plain number
      cellStyles: false,
      sheetStubs: false,
    });
  } catch (error) {
    throw new Error(explainReadFailure(error));
  }

  const names = (book.SheetNames || []).map((name) => String(name));
  const sheetName = names.find((name) => name.trim().toLowerCase() === WORKS_SHEET.toLowerCase());
  if (!sheetName) {
    throw new Error(
      `That workbook has no “${WORKS_SHEET}” worksheet. It holds: ${names.join(', ') || 'no sheets'}. `
      + `Put the work rows on a sheet named ${WORKS_SHEET} — ${IGNORED_SHEETS.join(', ')} are reference only and are never imported.`,
    );
  }

  const rows = rowsOf(XLSX, book.Sheets[sheetName]);
  const headerIndex = rows.findIndex((row) => row.filled);
  if (headerIndex === -1) throw new Error(`The “${sheetName}” worksheet is empty.`);

  const header = rows[headerIndex].cells;
  const lastColumn = header.reduce((last, value, index) => (value !== '' ? index : last), -1);
  if (lastColumn === -1) throw new Error(`The “${sheetName}” worksheet has no column headings.`);

  const data = rows.slice(headerIndex + 1).filter((row) => row.filled);
  if (!data.length) throw new Error(`The “${sheetName}” worksheet has a header row but no work rows.`);
  if (data.length > MAX_WORKS_ROWS) {
    throw new Error(`That workbook has ${data.length} work rows on “${sheetName}”. One import takes up to ${MAX_WORKS_ROWS}.`);
  }

  const lines = [header.slice(0, lastColumn + 1).map(csvCell).join(',')];
  data.forEach((row) => lines.push(row.cells.slice(0, lastColumn + 1).map(csvCell).join(',')));

  return {
    text: lines.join('\n'),
    sheet: sheetName,
    rowNumbers: data.map((row) => row.excel_row),
    rows: data.length,
    blankRows: rows.length - headerIndex - 1 - data.length,
  };
}

/**
 * The standard workbook: a `Works` sheet with the template's column headings and
 * nothing else (so an unedited template can never import anything), an
 * `Instructions` sheet carrying the rules and worked examples, and the two
 * reference sheets the Imagine workbook has.
 */
export async function buildWorkbookTemplate({ headers = [], rules = [], examples = [], villas = [], projectName = '' } = {}) {
  const XLSX = await xlsxLib();
  const book = XLSX.utils.book_new();

  const works = XLSX.utils.aoa_to_sheet([headers]);
  works['!cols'] = headers.map((label) => ({ wch: Math.min(40, Math.max(14, String(label).length + 4)) }));
  XLSX.utils.book_append_sheet(book, works, WORKS_SHEET);

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Import Works — Excel template'],
    [projectName ? `Project: ${projectName}` : 'Fill the Works sheet, then upload the workbook from Import Works.'],
    [],
    ['How the workbook is read'],
    ...rules.map((rule) => [rule]),
    [],
    ['Columns, in order (the Works sheet header row)'],
    [headers.join(' · ')],
    [],
    ['Example rows — reference only. The Works sheet is the only sheet that is imported.'],
    [headers.join(' · ')],
    ...examples,
    [],
    ['Notes'],
    ['Formulas are never evaluated: a formula cell imports the value Excel last saved, so paste values if the workbook has not been recalculated.'],
    ['Completely empty rows are ignored, and they do not change the row numbers of the rows that follow.'],
    [`${IGNORED_SHEETS.join(', ')} are kept for reference and are never imported.`],
    ['Nothing is written by an upload alone: every row is checked, corrected where needed, and confirmed before a single task is created.'],
  ]);
  instructions['!cols'] = [{ wch: 130 }];
  XLSX.utils.book_append_sheet(book, instructions, 'Instructions');

  const review = XLSX.utils.aoa_to_sheet([
    ['Reference only — this sheet is never imported.'],
    ['Use it for notes, checks, or the review columns of the source workbook; the importer reads the Works sheet only.'],
    [],
    headers,
  ]);
  review['!cols'] = headers.map((label) => ({ wch: Math.min(40, Math.max(14, String(label).length + 4)) }));
  XLSX.utils.book_append_sheet(book, review, 'Review_Only');

  const mapping = XLSX.utils.aoa_to_sheet([
    ['Reference only — this sheet is never imported.'],
    ['The villas registered on this project, so the Villa/location code column is written exactly as the register holds it.'],
    ['Original plot references may also be written in that column (for example “Plots 5 & 6”); a reference that points to one villa is matched, anything ambiguous is flagged for you to choose.'],
    [],
    ['Villa/location code', 'Original plot numbers', 'Phase', 'Type'],
    ...villas.map((villa) => [villa.code || '', villa.plots || '', villa.phase || '', villa.type || '']),
  ]);
  mapping['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(book, mapping, 'Villa_Mapping');

  const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  return new Blob([bytes], { type: XLSX_MIME });
}