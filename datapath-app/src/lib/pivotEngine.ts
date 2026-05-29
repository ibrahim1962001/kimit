import type { DataRow } from '../types';

export type AggFn = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'countUnique';

export interface PivotConfig {
  rowField: string;
  colField?: string | null;
  valueField: string;
  agg: AggFn;
}

export interface PivotResult {
  rowKeys: string[];
  colKeys: string[];
  /** matrix[rowKey][colKey] = aggregated value */
  matrix: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function aggregate(values: number[], rawCount: number, uniqueCount: number, agg: AggFn): number {
  const valid = values.filter(v => !Number.isNaN(v));
  switch (agg) {
    case 'count': return rawCount;
    case 'countUnique': return uniqueCount;
    case 'sum': return round(valid.reduce((a, b) => a + b, 0));
    case 'avg': return valid.length ? round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
    case 'min': return valid.length ? Math.min(...valid) : 0;
    case 'max': return valid.length ? Math.max(...valid) : 0;
    case 'median': {
      if (!valid.length) return 0;
      const s = [...valid].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : round((s[mid - 1] + s[mid]) / 2);
    }
    default: return 0;
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function computePivot(data: DataRow[], config: PivotConfig): PivotResult {
  const { rowField, colField, valueField, agg } = config;
  const NO_COL = '__total__';

  // bucket[rowKey][colKey] = { values, uniques }
  const buckets = new Map<string, Map<string, { values: number[]; uniques: Set<string> }>>();
  const rowKeySet = new Set<string>();
  const colKeySet = new Set<string>();

  for (const row of data) {
    const rk = String(row[rowField] ?? '—');
    const ck = colField ? String(row[colField] ?? '—') : NO_COL;
    rowKeySet.add(rk);
    colKeySet.add(ck);
    if (!buckets.has(rk)) buckets.set(rk, new Map());
    const colMap = buckets.get(rk)!;
    if (!colMap.has(ck)) colMap.set(ck, { values: [], uniques: new Set() });
    const cell = colMap.get(ck)!;
    const raw = row[valueField];
    cell.values.push(toNum(raw));
    cell.uniques.add(String(raw ?? ''));
  }

  const rowKeys = [...rowKeySet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const colKeys = colField
    ? [...colKeySet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : [NO_COL];

  const matrix: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  const allValuesByCol: Record<string, number[]> = {};
  const allUniquesByCol: Record<string, Set<string>> = {};
  const allRawCountByCol: Record<string, number> = {};

  for (const rk of rowKeys) {
    matrix[rk] = {};
    const colMap = buckets.get(rk) ?? new Map();
    const rowAllValues: number[] = [];
    const rowAllUniques = new Set<string>();
    let rowRawCount = 0;
    for (const ck of colKeys) {
      const cell = colMap.get(ck);
      const values = cell?.values ?? [];
      const uniques = cell?.uniques ?? new Set<string>();
      const val = aggregate(values, values.length, uniques.size, agg);
      matrix[rk][ck] = val;
      rowAllValues.push(...values);
      uniques.forEach((u: string) => rowAllUniques.add(u));
      rowRawCount += values.length;
      (allValuesByCol[ck] ??= []).push(...values);
      const colUniques: Set<string> = (allUniquesByCol[ck] ??= new Set<string>());
      uniques.forEach((u: string) => colUniques.add(u));
      allRawCountByCol[ck] = (allRawCountByCol[ck] ?? 0) + values.length;
    }
    rowTotals[rk] = aggregate(rowAllValues, rowRawCount, rowAllUniques.size, agg);
  }

  for (const ck of colKeys) {
    colTotals[ck] = aggregate(
      allValuesByCol[ck] ?? [],
      allRawCountByCol[ck] ?? 0,
      (allUniquesByCol[ck] ?? new Set()).size,
      agg,
    );
  }

  const allValues: number[] = [];
  const allUniques = new Set<string>();
  let allRaw = 0;
  for (const ck of colKeys) {
    allValues.push(...(allValuesByCol[ck] ?? []));
    (allUniquesByCol[ck] ?? new Set()).forEach(u => allUniques.add(u));
    allRaw += allRawCountByCol[ck] ?? 0;
  }
  grandTotal = aggregate(allValues, allRaw, allUniques.size, agg);

  return { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal };
}

/** Flatten a pivot result to DataRow[] for export / promotion to a dataset. */
export function pivotToRows(result: PivotResult, config: PivotConfig): DataRow[] {
  const { rowKeys, colKeys, matrix, rowTotals } = result;
  const singleCol = !config.colField;
  return rowKeys.map(rk => {
    const row: DataRow = { [config.rowField]: rk };
    if (singleCol) {
      row[`${config.agg}(${config.valueField})`] = matrix[rk][colKeys[0]] ?? 0;
    } else {
      for (const ck of colKeys) row[ck] = matrix[rk][ck] ?? 0;
      row['Total'] = rowTotals[rk] ?? 0;
    }
    return row;
  });
}

export const AGG_LABELS: Record<AggFn, { en: string; ar: string }> = {
  sum: { en: 'Sum', ar: 'مجموع' },
  avg: { en: 'Average', ar: 'متوسط' },
  count: { en: 'Count', ar: 'عدد' },
  countUnique: { en: 'Distinct count', ar: 'عدد فريد' },
  min: { en: 'Min', ar: 'أصغر' },
  max: { en: 'Max', ar: 'أكبر' },
  median: { en: 'Median', ar: 'وسيط' },
};
