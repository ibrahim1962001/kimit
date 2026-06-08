import type { DataRow } from '../types';

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// ──────────────────────────────────────────────────────────────
//  Column management: rename / drop / duplicate
// ──────────────────────────────────────────────────────────────
export function renameColumn(data: DataRow[], from: string, to: string): DataRow[] {
  if (!to.trim() || from === to) return data;
  return data.map(row => {
    const next: DataRow = {};
    for (const k of Object.keys(row)) {
      next[k === from ? to : k] = row[k];
    }
    return next;
  });
}

export function dropColumn(data: DataRow[], col: string): DataRow[] {
  return data.map(row => {
    const next = { ...row };
    delete next[col];
    return next;
  });
}

export function duplicateColumn(data: DataRow[], col: string): { data: DataRow[]; newColumn: string } {
  const newColumn = `${col}_copy`;
  return { data: data.map(row => ({ ...row, [newColumn]: row[col] ?? null })), newColumn };
}

// ──────────────────────────────────────────────────────────────
//  Sort rows
// ──────────────────────────────────────────────────────────────
export function sortRows(data: DataRow[], col: string, dir: 'asc' | 'desc'): DataRow[] {
  const sorted = [...data].sort((a, b) => {
    const av = a[col]; const bv = b[col];
    const an = toNum(av); const bn = toNum(bv);
    let cmp: number;
    if (!Number.isNaN(an) && !Number.isNaN(bn)) cmp = an - bn;
    else cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

// ──────────────────────────────────────────────────────────────
//  Outliers (IQR or z-score)
// ──────────────────────────────────────────────────────────────
export type OutlierMethod = 'iqr' | 'zscore';
export type OutlierAction = 'remove' | 'cap' | 'null';

export interface OutlierBounds {
  lower: number;
  upper: number;
  count: number;
}

export function detectOutliers(data: DataRow[], col: string, method: OutlierMethod): OutlierBounds {
  const vals = data.map(r => toNum(r[col])).filter(v => !Number.isNaN(v));
  if (vals.length === 0) return { lower: 0, upper: 0, count: 0 };

  let lower: number, upper: number;
  if (method === 'iqr') {
    const s = [...vals].sort((a, b) => a - b);
    const q1 = s[Math.floor(s.length * 0.25)];
    const q3 = s[Math.floor(s.length * 0.75)];
    const iqr = q3 - q1;
    lower = q1 - 1.5 * iqr;
    upper = q3 + 1.5 * iqr;
  } else {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
    lower = mean - 3 * std;
    upper = mean + 3 * std;
  }
  lower = Math.round(lower * 1000) / 1000;
  upper = Math.round(upper * 1000) / 1000;
  const count = vals.filter(v => v < lower || v > upper).length;
  return { lower, upper, count };
}

export function handleOutliers(
  data: DataRow[],
  col: string,
  method: OutlierMethod,
  action: OutlierAction,
): { data: DataRow[]; affected: number } {
  const { lower, upper } = detectOutliers(data, col, method);
  let affected = 0;

  if (action === 'remove') {
    const out = data.filter(row => {
      const n = toNum(row[col]);
      if (Number.isNaN(n)) return true;
      const isOut = n < lower || n > upper;
      if (isOut) affected++;
      return !isOut;
    });
    return { data: out, affected };
  }

  const out = data.map(row => {
    const n = toNum(row[col]);
    if (Number.isNaN(n)) return row;
    if (n < lower || n > upper) {
      affected++;
      if (action === 'cap') return { ...row, [col]: n < lower ? lower : upper };
      return { ...row, [col]: null };
    }
    return row;
  });
  return { data: out, affected };
}

// ──────────────────────────────────────────────────────────────
//  One-Hot encoding
// ──────────────────────────────────────────────────────────────
export function oneHotEncode(
  data: DataRow[],
  col: string,
  topN: number,
): { data: DataRow[]; newColumns: string[] } {
  const freq = new Map<string, number>();
  for (const r of data) {
    const v = r[col];
    if (v === null || v === undefined || v === '') continue;
    const k = String(v);
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const categories = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN > 0 ? topN : freq.size)
    .map(([k]) => k);

  const sanitize = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'val';
  const newColumns = categories.map(c => `${col}_${sanitize(c)}`);

  const out = data.map(row => {
    const v = String(row[col] ?? '');
    const add: DataRow = {};
    categories.forEach((cat, i) => { add[newColumns[i]] = v === cat ? 1 : 0; });
    return { ...row, ...add };
  });
  return { data: out, newColumns };
}

// ──────────────────────────────────────────────────────────────
//  Scaling / normalization
// ──────────────────────────────────────────────────────────────
export type ScaleMethod = 'minmax' | 'zscore';

export function scaleColumn(
  data: DataRow[],
  col: string,
  method: ScaleMethod,
  asNewColumn: boolean,
): { data: DataRow[]; target: string } {
  const vals = data.map(r => toNum(r[col])).filter(v => !Number.isNaN(v));
  const target = asNewColumn ? `${col}_${method}` : col;
  if (vals.length === 0) return { data, target };

  let transform: (n: number) => number;
  if (method === 'minmax') {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    transform = (n) => Math.round(((n - min) / range) * 1e6) / 1e6;
  } else {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
    transform = (n) => Math.round(((n - mean) / std) * 1e6) / 1e6;
  }

  const out = data.map(row => {
    const n = toNum(row[col]);
    if (Number.isNaN(n)) return asNewColumn ? { ...row, [target]: null } : row;
    return { ...row, [target]: transform(n) };
  });
  return { data: out, target };
}
