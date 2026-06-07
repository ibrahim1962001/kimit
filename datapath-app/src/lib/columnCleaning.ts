import type { DataRow } from '../types';

// ──────────────────────────────────────────────────────────────
//  Smart numeric normalization
//  Handles: 12k → 12000, 1.5M → 1500000, "1,234" → 1234,
//  "$99.99" → 99.99, "45%" → 45 (or 0.45), "Free"/"N/A" → 0/null.
// ──────────────────────────────────────────────────────────────

export interface NumericNormalizeOptions {
  /** Map words like Free / None / N/A to 0 (true) or null (false). */
  textToZero: boolean;
  /** Treat 45% as 0.45 (true) or 45 (false). */
  percentAsFraction: boolean;
}

const ZERO_WORDS = new Set(['free', 'none', 'n/a', 'na', 'null', 'nil', '-', '—', 'gratis', 'مجاني', 'مجانا', 'لا يوجد']);

export function normalizeNumericValue(
  raw: unknown,
  opts: NumericNormalizeOptions,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  let s = String(raw).trim();
  if (s === '') return null;

  const lower = s.toLowerCase();
  if (ZERO_WORDS.has(lower)) return opts.textToZero ? 0 : null;

  // Strip currency symbols, spaces, thousands separators.
  s = s.replace(/[\s,\u00A0$€£¥﷼]/g, '');
  // Arabic-Indic digits → Latin.
  s = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  let percent = false;
  if (s.endsWith('%')) { percent = true; s = s.slice(0, -1); }

  const match = s.match(/^(-?\d*\.?\d+)\s*([kKmMbBtT])?$/);
  if (!match) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return percent && opts.percentAsFraction ? n / 100 : n;
  }

  let n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = (match[2] || '').toLowerCase();
  const mult = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : suffix === 'b' ? 1e9 : suffix === 't' ? 1e12 : 1;
  n *= mult;
  if (percent && opts.percentAsFraction) n /= 100;
  return Math.round(n * 1e6) / 1e6;
}

export interface ColumnIssueReport {
  column: string;
  totalCells: number;
  /** numeric values stored as plain numbers already */
  cleanNumeric: number;
  /** values that need conversion (12k, $99, Free, 1,234, 45%) */
  fixable: number;
  /** values that cannot be parsed to a number at all */
  unparseable: number;
  /** sample of messy → fixed conversions for preview */
  samples: Array<{ from: string; to: string }>;
  /** true if the column is worth normalizing */
  recommended: boolean;
}

/** Analyze a column for mixed/messy numeric formats. */
export function analyzeNumericColumn(
  data: DataRow[],
  column: string,
  opts: NumericNormalizeOptions,
): ColumnIssueReport {
  let cleanNumeric = 0;
  let fixable = 0;
  let unparseable = 0;
  const samples: Array<{ from: string; to: string }> = [];
  let total = 0;

  for (const row of data) {
    const raw = row[column];
    if (raw === null || raw === undefined || raw === '') continue;
    total++;
    const isPlainNumber = typeof raw === 'number' || /^-?\d*\.?\d+$/.test(String(raw).trim());
    const normalized = normalizeNumericValue(raw, opts);
    if (normalized === null) {
      unparseable++;
      continue;
    }
    if (isPlainNumber) {
      cleanNumeric++;
    } else {
      fixable++;
      if (samples.length < 6) samples.push({ from: String(raw), to: String(normalized) });
    }
  }

  return {
    column,
    totalCells: total,
    cleanNumeric,
    fixable,
    unparseable,
    samples,
    // Recommend if there's a meaningful mix that's mostly numeric.
    recommended: fixable > 0 && cleanNumeric + fixable >= total * 0.6,
  };
}

export function normalizeNumericColumn(
  data: DataRow[],
  column: string,
  opts: NumericNormalizeOptions,
): { data: DataRow[]; changed: number } {
  let changed = 0;
  const out = data.map(row => {
    const raw = row[column];
    const normalized = normalizeNumericValue(raw, opts);
    const before = raw === undefined ? null : raw;
    if (String(before) !== String(normalized)) changed++;
    return { ...row, [column]: normalized };
  });
  return { data: out, changed };
}

// ──────────────────────────────────────────────────────────────
//  Text standardization (trim, casing, unify empty tokens)
// ──────────────────────────────────────────────────────────────

export type TextCase = 'none' | 'lower' | 'upper' | 'title' | 'trim';

export function standardizeTextColumn(
  data: DataRow[],
  column: string,
  mode: TextCase,
): { data: DataRow[]; changed: number } {
  let changed = 0;
  const transform = (v: string): string => {
    let s = v.replace(/\s+/g, ' ').trim();
    if (mode === 'lower') s = s.toLowerCase();
    else if (mode === 'upper') s = s.toUpperCase();
    else if (mode === 'title') s = s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return s;
  };
  const out = data.map(row => {
    const raw = row[column];
    if (raw === null || raw === undefined) return row;
    const next = transform(String(raw));
    if (next !== String(raw)) changed++;
    return { ...row, [column]: next };
  });
  return { data: out, changed };
}
