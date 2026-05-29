import type { DataRow } from '../types';

export type JoinType = 'inner' | 'left' | 'right' | 'outer';

export interface JoinConfig {
  leftKey: string;
  rightKey: string;
  type: JoinType;
  /** Prefix added to right-side columns that collide with left columns. */
  rightPrefix?: string;
}

export interface JoinResult {
  data: DataRow[];
  matched: number;
  leftOnly: number;
  rightOnly: number;
  columns: string[];
}

const norm = (v: unknown): string => String(v ?? '').trim().toLowerCase();

export function joinDatasets(
  left: DataRow[],
  right: DataRow[],
  config: JoinConfig,
): JoinResult {
  const { leftKey, rightKey, type } = config;
  const prefix = config.rightPrefix ?? 'r_';

  const leftCols = Object.keys(left[0] ?? {});
  const rightCols = Object.keys(right[0] ?? {});

  // Build a renamed column map for the right side to avoid collisions.
  const rightRename: Record<string, string> = {};
  for (const c of rightCols) {
    rightRename[c] = leftCols.includes(c) && c !== rightKey ? `${prefix}${c}` : c;
  }

  // Index right rows by key.
  const rightIndex = new Map<string, DataRow[]>();
  for (const r of right) {
    const k = norm(r[rightKey]);
    if (!rightIndex.has(k)) rightIndex.set(k, []);
    rightIndex.get(k)!.push(r);
  }

  const emptyRight: DataRow = {};
  for (const c of rightCols) emptyRight[rightRename[c]] = null;
  const emptyLeft: DataRow = {};
  for (const c of leftCols) emptyLeft[c] = null;

  const mergeRow = (l: DataRow | null, r: DataRow | null): DataRow => {
    const base: DataRow = l ? { ...l } : { ...emptyLeft };
    if (r) {
      for (const c of rightCols) base[rightRename[c]] = r[c] ?? null;
    } else {
      for (const c of rightCols) base[rightRename[c]] = null;
    }
    return base;
  };

  const out: DataRow[] = [];
  let matched = 0;
  let leftOnly = 0;
  let rightOnly = 0;
  const usedRightKeys = new Set<string>();

  for (const l of left) {
    const k = norm(l[leftKey]);
    const matches = rightIndex.get(k);
    if (matches && matches.length) {
      usedRightKeys.add(k);
      for (const r of matches) {
        out.push(mergeRow(l, r));
        matched++;
      }
    } else if (type === 'left' || type === 'outer') {
      out.push(mergeRow(l, null));
      leftOnly++;
    }
  }

  if (type === 'right' || type === 'outer') {
    for (const [k, rows] of rightIndex.entries()) {
      if (usedRightKeys.has(k)) continue;
      for (const r of rows) {
        out.push(mergeRow(null, r));
        rightOnly++;
      }
    }
  }

  const columns = out.length ? Object.keys(out[0]) : [...leftCols, ...rightCols.map(c => rightRename[c])];
  return { data: out, matched, leftOnly, rightOnly, columns };
}
