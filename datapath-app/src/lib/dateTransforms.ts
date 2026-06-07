import type { DataRow } from '../types';

/**
 * Robust date parser supporting ISO, common separators, and day/month-first
 * ambiguity resolution.
 */
export function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();
  if (!s) return null;

  // Native parse first (handles ISO 8601 like 2023-10-05T16:20:00Z).
  const native = new Date(s);
  if (!Number.isNaN(native.getTime()) && /\d{4}/.test(s)) return native;

  // dd/mm/yyyy or mm/dd/yyyy or yyyy/mm/dd with - . / separators.
  const m = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    let [, p1, p2, p3, hh, mm, ss] = m;
    let year: number, month: number, day: number;
    if (p1.length === 4) {
      // yyyy-mm-dd
      year = +p1; month = +p2; day = +p3;
    } else {
      // dd/mm/yyyy — prefer day-first (most non-US); fall back if invalid.
      day = +p1; month = +p2; year = +p3;
      if (month > 12 && day <= 12) { [day, month] = [month, day]; }
      if (year < 100) year += year < 50 ? 2000 : 1900;
    }
    const d = new Date(year, month - 1, day, +(hh || 0), +(mm || 0), +(ss || 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeString(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** How many cells in a column parse as dates (for detection). */
export function dateParseRatio(data: DataRow[], column: string): number {
  let total = 0;
  let ok = 0;
  for (const row of data) {
    const v = row[column];
    if (v === null || v === undefined || v === '') continue;
    total++;
    if (parseFlexibleDate(v)) ok++;
  }
  return total === 0 ? 0 : ok / total;
}

/** Convert a column in place to a normalized ISO date string. */
export function convertColumnToDate(
  data: DataRow[],
  column: string,
  withTime: boolean,
): { data: DataRow[]; converted: number; failed: number } {
  let converted = 0;
  let failed = 0;
  const out = data.map(row => {
    const d = parseFlexibleDate(row[column]);
    if (!d) {
      if (row[column] !== null && row[column] !== undefined && row[column] !== '') failed++;
      return { ...row, [column]: row[column] ?? null };
    }
    converted++;
    return { ...row, [column]: withTime ? `${toISODate(d)} ${toTimeString(d)}` : toISODate(d) };
  });
  return { data: out, converted, failed };
}

/** Split a datetime column into separate <col>_date and <col>_time columns. */
export function splitDateTimeColumn(
  data: DataRow[],
  column: string,
): { data: DataRow[]; converted: number } {
  let converted = 0;
  const out = data.map(row => {
    const d = parseFlexibleDate(row[column]);
    if (!d) return { ...row, [`${column}_date`]: null, [`${column}_time`]: null };
    converted++;
    return { ...row, [`${column}_date`]: toISODate(d), [`${column}_time`]: toTimeString(d) };
  });
  return { data: out, converted };
}

export type DatePart = 'year' | 'month' | 'monthName' | 'day' | 'hour' | 'minute' | 'weekday' | 'quarter';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DATE_PART_LABELS: Record<DatePart, { en: string; ar: string }> = {
  year: { en: 'Year', ar: 'السنة' },
  quarter: { en: 'Quarter', ar: 'الربع' },
  month: { en: 'Month (number)', ar: 'الشهر (رقم)' },
  monthName: { en: 'Month name', ar: 'اسم الشهر' },
  day: { en: 'Day', ar: 'اليوم' },
  weekday: { en: 'Weekday', ar: 'يوم الأسبوع' },
  hour: { en: 'Hour', ar: 'الساعة' },
  minute: { en: 'Minute', ar: 'الدقيقة' },
};

function extractPart(d: Date, part: DatePart): string | number {
  switch (part) {
    case 'year': return d.getFullYear();
    case 'quarter': return `Q${Math.floor(d.getMonth() / 3) + 1}`;
    case 'month': return d.getMonth() + 1;
    case 'monthName': return MONTH_NAMES[d.getMonth()];
    case 'day': return d.getDate();
    case 'weekday': return WEEKDAYS[d.getDay()];
    case 'hour': return d.getHours();
    case 'minute': return d.getMinutes();
    default: return '';
  }
}

/** Add a new column with an extracted date part. */
export function extractDatePartColumn(
  data: DataRow[],
  column: string,
  part: DatePart,
): { data: DataRow[]; newColumn: string; converted: number } {
  const newColumn = `${column}_${part}`;
  let converted = 0;
  const out = data.map(row => {
    const d = parseFlexibleDate(row[column]);
    if (!d) return { ...row, [newColumn]: null };
    converted++;
    return { ...row, [newColumn]: extractPart(d, part) };
  });
  return { data: out, newColumn, converted };
}
