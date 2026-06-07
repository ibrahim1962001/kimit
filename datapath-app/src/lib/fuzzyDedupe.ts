import type { DataRow } from '../types';

/**
 * Fuzzy duplicate detection: catches near-identical rows that exact dedupe
 * misses (e.g. "Machine Learning Basics" vs "machine  learning basics",
 * "Ahmed Ali" vs "Ahmad Aly").
 */

/** Normalize a key: lowercase, strip punctuation, collapse spaces, token-sort. */
export function normalizeKey(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value)
    .toLowerCase()
    .replace(/[\u0640]/g, '') // Arabic tatweel
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // token-sort so word order doesn't matter
  return s.split(' ').filter(Boolean).sort().join(' ');
}

/** Levenshtein distance with early-exit cap. */
function levenshtein(a: string, b: string, cap: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > cap) return cap + 1;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similarity ratio 0..1 based on normalized Levenshtein distance. */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const cap = Math.ceil(maxLen * 0.5);
  const dist = levenshtein(a, b, cap);
  return 1 - dist / maxLen;
}

// ── Union-Find ──────────────────────────────────────────────
class UnionFind {
  parent: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a); const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export interface DuplicateGroup {
  rowIndices: number[];
  values: string[];
}

export interface FuzzyResult {
  groups: DuplicateGroup[];
  duplicateRows: number;
}

/**
 * Find groups of fuzzy-duplicate rows based on a combined key from the
 * selected columns. threshold 0..1 (1 = identical).
 */
export function findFuzzyDuplicates(
  data: DataRow[],
  columns: string[],
  threshold: number,
): FuzzyResult {
  const n = data.length;
  const keys = data.map(row => normalizeKey(columns.map(c => row[c]).join(' ')));
  const uf = new UnionFind(n);

  // 1) Exact normalized matches via hash map (fast).
  const byKey = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    if (!keys[i]) continue;
    const arr = byKey.get(keys[i]);
    if (arr) { uf.union(arr[0], i); arr.push(i); }
    else byKey.set(keys[i], [i]);
  }

  // 2) Fuzzy matches between distinct normalized keys (blocked + windowed).
  if (threshold < 1) {
    const uniqueKeys = [...byKey.keys()].filter(Boolean).sort();
    const WINDOW = 40; // compare each key to nearby sorted keys
    for (let i = 0; i < uniqueKeys.length; i++) {
      for (let j = i + 1; j < Math.min(uniqueKeys.length, i + WINDOW); j++) {
        if (similarity(uniqueKeys[i], uniqueKeys[j]) >= threshold) {
          uf.union(byKey.get(uniqueKeys[i])![0], byKey.get(uniqueKeys[j])![0]);
        }
      }
    }
  }

  // 3) Collect groups.
  const groupsMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (!keys[i]) continue;
    const root = uf.find(i);
    const arr = groupsMap.get(root);
    if (arr) arr.push(i);
    else groupsMap.set(root, [i]);
  }

  const groups: DuplicateGroup[] = [];
  let duplicateRows = 0;
  for (const indices of groupsMap.values()) {
    if (indices.length < 2) continue;
    duplicateRows += indices.length - 1;
    groups.push({
      rowIndices: indices,
      values: indices.slice(0, 5).map(idx => columns.map(c => String(data[idx][c] ?? '')).join(' • ')),
    });
  }
  groups.sort((a, b) => b.rowIndices.length - a.rowIndices.length);
  return { groups, duplicateRows };
}

/** Remove fuzzy duplicates, keeping the first row of each group. */
export function removeFuzzyDuplicates(
  data: DataRow[],
  columns: string[],
  threshold: number,
): { data: DataRow[]; removed: number } {
  const { groups } = findFuzzyDuplicates(data, columns, threshold);
  const toRemove = new Set<number>();
  for (const g of groups) {
    for (let k = 1; k < g.rowIndices.length; k++) toRemove.add(g.rowIndices[k]);
  }
  const out = data.filter((_, idx) => !toRemove.has(idx));
  return { data: out, removed: toRemove.size };
}
