import type { DataRow } from '../types';

// ─────────────────────────────────────────────
//  Core Stats Primitives
// ─────────────────────────────────────────────

export function getNumericValues(data: DataRow[], col: string): number[] {
  return data.map(r => Number(r[col])).filter(v => !isNaN(v) && isFinite(v));
}

function sortedAsc(vals: number[]): number[] {
  return [...vals].sort((a, b) => a - b);
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

// ─────────────────────────────────────────────
//  1. IQR Outlier Detection
// ─────────────────────────────────────────────

export interface IQRResult {
  column: string;
  q1: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
  outlierCount: number;
  outlierPct: number;
  /** Set of row indices that are outliers */
  outlierRowIndices: Set<number>;
}

/**
 * Calculate IQR-based outlier bounds for a single column.
 * Returns the row indices of outliers for O(n) DataGrid highlighting.
 */
export function calcIQR(data: DataRow[], col: string): IQRResult | null {
  const vals = getNumericValues(data, col);
  if (vals.length < 10) return null;

  const sorted = sortedAsc(vals);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outlierRowIndices = new Set<number>();
  data.forEach((row, idx) => {
    const v = Number(row[col]);
    if (!isNaN(v) && isFinite(v) && (v < lowerBound || v > upperBound)) {
      outlierRowIndices.add(idx);
    }
  });

  return {
    column: col,
    q1, q3, iqr, lowerBound, upperBound,
    outlierCount: outlierRowIndices.size,
    outlierPct: (outlierRowIndices.size / data.length) * 100,
    outlierRowIndices,
  };
}

/**
 * Run IQR across all numeric columns.
 * Returns a map: columnName → IQRResult for fast lookups.
 */
export function calcAllIQR(
  data: DataRow[],
  numericCols: string[],
): Map<string, IQRResult> {
  const map = new Map<string, IQRResult>();
  for (const col of numericCols) {
    const result = calcIQR(data, col);
    if (result) map.set(col, result);
  }
  return map;
}

// ─────────────────────────────────────────────
//  2. Full Pearson Correlation Matrix
// ─────────────────────────────────────────────

export interface CorrelationMatrix {
  columns: string[];
  /** matrix[i][j] = Pearson r between columns[i] and columns[j] */
  matrix: number[][];
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const mA = sumA / n, mB = sumB / n;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - mA, db = b[i] - mB;
    num += da * db;
    dA += da * da;
    dB += db * db;
  }
  const denom = Math.sqrt(dA) * Math.sqrt(dB);
  return denom === 0 ? 0 : Math.max(-1, Math.min(1, num / denom));
}

/**
 * Compute the full n×n Pearson correlation matrix for all numeric columns.
 * Uses a sample cap (5000 rows) to stay fast on large files.
 */
export function calcCorrelationMatrix(
  data: DataRow[],
  numericCols: string[],
  sampleCap = 5000,
): CorrelationMatrix {
  const sample = data.length > sampleCap ? data.slice(0, sampleCap) : data;
  const cols = numericCols.slice(0, 20); // cap at 20×20

  // Pre-extract numeric arrays once
  const arrays: number[][] = cols.map(col => getNumericValues(sample, col));

  const n = cols.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const r = pearson(arrays[i], arrays[j]);
      matrix[i][j] = r;
      matrix[j][i] = r; // symmetric
    }
  }

  return { columns: cols, matrix };
}

// ─────────────────────────────────────────────
//  3. Growth Indicators (Half-Split Comparison)
// ─────────────────────────────────────────────

export interface GrowthIndicator {
  column: string;
  firstHalfAvg: number;
  secondHalfAvg: number;
  /** Positive = growth, negative = decline */
  pctChange: number;
  trend: 'up' | 'down' | 'flat';
}

/**
 * Split data in half (or by date column if detected) and compute
 * average change between the two halves for each numeric column.
 */
export function calcGrowthIndicators(
  data: DataRow[],
  numericCols: string[],
  dateCol?: string,
): GrowthIndicator[] {
  if (data.length < 4) return [];

  let ordered = data;

  // If a date column exists, sort by it first
  if (dateCol) {
    ordered = [...data].sort((a, b) => {
      const da = new Date(String(a[dateCol] ?? '')).getTime();
      const db = new Date(String(b[dateCol] ?? '')).getTime();
      return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
    });
  }

  const mid = Math.floor(ordered.length / 2);
  const firstHalf = ordered.slice(0, mid);
  const secondHalf = ordered.slice(mid);

  const avg = (rows: DataRow[], col: string): number => {
    const vals = getNumericValues(rows, col);
    return vals.length === 0 ? 0 : vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  return numericCols.map(col => {
    const a = avg(firstHalf, col);
    const b = avg(secondHalf, col);
    const pctChange = a === 0 ? 0 : ((b - a) / Math.abs(a)) * 100;
    return {
      column: col,
      firstHalfAvg: a,
      secondHalfAvg: b,
      pctChange,
      trend: Math.abs(pctChange) < 0.5 ? 'flat' : pctChange > 0 ? 'up' : 'down',
    };
  });
}

/**
 * Detect if any column looks like a date/time column.
 * Returns the first plausible date column name or undefined.
 */
export function detectDateColumn(data: DataRow[], columns: string[]): string | undefined {
  const dateKeywords = /date|time|year|month|day|dt|created|updated|timestamp/i;
  for (const col of columns) {
    if (!dateKeywords.test(col)) continue;
    // Verify some values parse as dates
    const sample = data.slice(0, 20).map(r => new Date(String(r[col] ?? '')).getTime());
    const valid = sample.filter(d => !isNaN(d));
    if (valid.length >= 5) return col;
  }
  return undefined;
}
