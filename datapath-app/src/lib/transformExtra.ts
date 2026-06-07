import type { DataRow } from '../types';

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const isEmpty = (v: unknown): boolean => v === null || v === undefined || String(v).trim() === '';

// ──────────────────────────────────────────────────────────────
//  Filter rows
// ──────────────────────────────────────────────────────────────
export type FilterOp =
  | 'eq' | 'neq' | 'contains' | 'notContains' | 'startsWith' | 'endsWith'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'empty' | 'notEmpty';

export const FILTER_OP_LABELS: Record<FilterOp, { en: string; ar: string }> = {
  eq: { en: 'equals', ar: 'يساوي' },
  neq: { en: 'not equals', ar: 'لا يساوي' },
  contains: { en: 'contains', ar: 'يحتوي' },
  notContains: { en: "doesn't contain", ar: 'لا يحتوي' },
  startsWith: { en: 'starts with', ar: 'يبدأ بـ' },
  endsWith: { en: 'ends with', ar: 'ينتهي بـ' },
  gt: { en: '>', ar: '>' },
  gte: { en: '>=', ar: '>=' },
  lt: { en: '<', ar: '<' },
  lte: { en: '<=', ar: '<=' },
  between: { en: 'between', ar: 'بين' },
  empty: { en: 'is empty', ar: 'فارغ' },
  notEmpty: { en: 'is not empty', ar: 'غير فارغ' },
};

function matchFilter(cell: unknown, op: FilterOp, v: string, v2: string): boolean {
  const s = String(cell ?? '').toLowerCase();
  const t = v.toLowerCase();
  switch (op) {
    case 'eq': return s === t;
    case 'neq': return s !== t;
    case 'contains': return s.includes(t);
    case 'notContains': return !s.includes(t);
    case 'startsWith': return s.startsWith(t);
    case 'endsWith': return s.endsWith(t);
    case 'gt': return toNum(cell) > toNum(v);
    case 'gte': return toNum(cell) >= toNum(v);
    case 'lt': return toNum(cell) < toNum(v);
    case 'lte': return toNum(cell) <= toNum(v);
    case 'between': { const n = toNum(cell); return n >= toNum(v) && n <= toNum(v2); }
    case 'empty': return isEmpty(cell);
    case 'notEmpty': return !isEmpty(cell);
    default: return false;
  }
}

export function filterRows(
  data: DataRow[],
  column: string,
  op: FilterOp,
  value: string,
  value2: string,
  mode: 'keep' | 'drop',
): { data: DataRow[]; matched: number } {
  let matched = 0;
  const out = data.filter(row => {
    const hit = matchFilter(row[column], op, value, value2);
    if (hit) matched++;
    return mode === 'keep' ? hit : !hit;
  });
  return { data: out, matched };
}

export function countFilter(
  data: DataRow[], column: string, op: FilterOp, value: string, value2: string,
): number {
  let matched = 0;
  for (const row of data) if (matchFilter(row[column], op, value, value2)) matched++;
  return matched;
}

// ──────────────────────────────────────────────────────────────
//  Split column by delimiter
// ──────────────────────────────────────────────────────────────
export function splitColumn(
  data: DataRow[],
  column: string,
  delimiter: string,
  maxParts: number,
): { data: DataRow[]; newColumns: string[] } {
  const delim = delimiter === '\\t' ? '\t' : delimiter;
  let widest = 0;
  for (const row of data) {
    const parts = String(row[column] ?? '').split(delim);
    widest = Math.max(widest, parts.length);
  }
  const count = Math.min(widest, maxParts > 0 ? maxParts : widest);
  const newColumns = Array.from({ length: count }, (_, i) => `${column}_${i + 1}`);
  const out = data.map(row => {
    const parts = String(row[column] ?? '').split(delim).map(p => p.trim());
    const add: DataRow = {};
    for (let i = 0; i < count; i++) add[newColumns[i]] = parts[i] ?? null;
    return { ...row, ...add };
  });
  return { data: out, newColumns };
}

// ──────────────────────────────────────────────────────────────
//  Find & Replace
// ──────────────────────────────────────────────────────────────
export function findReplace(
  data: DataRow[],
  column: string,
  find: string,
  replace: string,
  options: { regex: boolean; caseSensitive: boolean; wholeCell: boolean },
): { data: DataRow[]; changed: number } {
  let changed = 0;
  let rx: RegExp | null = null;
  if (options.regex) {
    try { rx = new RegExp(find, options.caseSensitive ? 'g' : 'gi'); } catch { rx = null; }
  }
  const out = data.map(row => {
    const raw = row[column];
    if (raw === null || raw === undefined) return row;
    const s = String(raw);
    let next: string;
    if (options.wholeCell) {
      const eq = options.caseSensitive ? s === find : s.toLowerCase() === find.toLowerCase();
      next = eq ? replace : s;
    } else if (rx) {
      next = s.replace(rx, replace);
    } else if (options.caseSensitive) {
      next = s.split(find).join(replace);
    } else {
      // case-insensitive literal replace
      const safe = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      next = s.replace(new RegExp(safe, 'gi'), replace);
    }
    if (next !== s) changed++;
    return { ...row, [column]: next };
  });
  return { data: out, changed };
}

// ──────────────────────────────────────────────────────────────
//  Bin / bucket a numeric column
// ──────────────────────────────────────────────────────────────
export function binColumn(
  data: DataRow[],
  column: string,
  binCount: number,
): { data: DataRow[]; newColumn: string; edges: number[] } {
  const vals = data.map(r => toNum(r[column])).filter(v => !Number.isNaN(v));
  const newColumn = `${column}_bin`;
  if (vals.length === 0) return { data, newColumn, edges: [] };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const width = (max - min) / binCount || 1;
  const edges = Array.from({ length: binCount + 1 }, (_, i) => Math.round((min + i * width) * 100) / 100);

  const labelFor = (n: number): string => {
    if (Number.isNaN(n)) return '';
    let idx = Math.floor((n - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    return `${edges[idx]} – ${edges[idx + 1]}`;
  };
  const out = data.map(row => {
    const n = toNum(row[column]);
    return { ...row, [newColumn]: Number.isNaN(n) ? null : labelFor(n) };
  });
  return { data: out, newColumn, edges };
}

// ──────────────────────────────────────────────────────────────
//  Fill missing values
// ──────────────────────────────────────────────────────────────
export type FillStrategy = 'mean' | 'median' | 'mode' | 'constant' | 'ffill' | 'bfill' | 'zero';

export const FILL_LABELS: Record<FillStrategy, { en: string; ar: string }> = {
  mean: { en: 'Mean (numeric)', ar: 'المتوسط (رقمي)' },
  median: { en: 'Median (numeric)', ar: 'الوسيط (رقمي)' },
  mode: { en: 'Most frequent', ar: 'الأكثر تكراراً' },
  zero: { en: 'Zero', ar: 'صفر' },
  constant: { en: 'Custom value', ar: 'قيمة مخصصة' },
  ffill: { en: 'Forward fill', ar: 'تعبئة للأمام' },
  bfill: { en: 'Backward fill', ar: 'تعبئة للخلف' },
};

export function fillMissing(
  data: DataRow[],
  column: string,
  strategy: FillStrategy,
  constant: string,
): { data: DataRow[]; filled: number } {
  let fillValue: string | number | null = null;

  if (strategy === 'mean' || strategy === 'median') {
    const nums = data.map(r => toNum(r[column])).filter(v => !Number.isNaN(v)).sort((a, b) => a - b);
    if (nums.length) {
      fillValue = strategy === 'mean'
        ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000
        : nums[Math.floor(nums.length / 2)];
    }
  } else if (strategy === 'mode') {
    const freq = new Map<string, number>();
    for (const r of data) { if (!isEmpty(r[column])) { const k = String(r[column]); freq.set(k, (freq.get(k) ?? 0) + 1); } }
    let best = ''; let bestN = -1;
    for (const [k, c] of freq) if (c > bestN) { best = k; bestN = c; }
    fillValue = best;
  } else if (strategy === 'zero') {
    fillValue = 0;
  } else if (strategy === 'constant') {
    fillValue = constant;
  }

  let filled = 0;
  if (strategy === 'ffill' || strategy === 'bfill') {
    const out = data.map(r => ({ ...r }));
    const order = strategy === 'ffill' ? out : [...out].reverse();
    let last: string | number | null = null;
    for (const row of order) {
      if (isEmpty(row[column])) {
        if (last !== null) { row[column] = last; filled++; }
      } else {
        last = row[column];
      }
    }
    return { data: out, filled };
  }

  const out = data.map(row => {
    if (isEmpty(row[column]) && fillValue !== null) {
      filled++;
      return { ...row, [column]: fillValue };
    }
    return row;
  });
  return { data: out, filled };
}

export function countMissing(data: DataRow[], column: string): number {
  let c = 0;
  for (const r of data) if (isEmpty(r[column])) c++;
  return c;
}
