import type { DataRow } from '../types';

// ──────────────────────────────────────────────────────────────
//  Multiple Linear Regression (OLS via normal equations)
// ──────────────────────────────────────────────────────────────

export interface RegressionResult {
  features: string[];
  target: string;
  intercept: number;
  coefficients: number[];
  r2: number;
  adjustedR2: number;
  n: number;
  rmse: number;
  /** standard error per coefficient (intercept first) */
  stdErrors: number[];
  /** t-statistic per coefficient (intercept first) */
  tStats: number[];
  predictions: number[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function transpose(m: number[][]): number[][] {
  return m[0].map((_, i) => m.map(row => row[i]));
}

function matMul(a: number[][], b: number[][]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    out[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let s = 0;
      for (let k = 0; k < b.length; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

/** Invert a square matrix via Gauss-Jordan. Returns null if singular. */
function invert(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const div = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row.slice(n));
}

export function linearRegression(
  data: DataRow[],
  features: string[],
  target: string,
): RegressionResult {
  const rows: { x: number[]; y: number }[] = [];
  for (const r of data) {
    const y = num(r[target]);
    if (Number.isNaN(y)) continue;
    const x = features.map(f => num(r[f]));
    if (x.some(Number.isNaN)) continue;
    rows.push({ x, y });
  }

  const n = rows.length;
  if (n <= features.length + 1) {
    throw new Error('عدد الصفوف الصالحة غير كافٍ للانحدار.');
  }

  // Design matrix X (with intercept column of 1s) and y vector.
  const X = rows.map(r => [1, ...r.x]);
  const y = rows.map(r => [r.y]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = invert(XtX);
  if (!XtXinv) throw new Error('المصفوفة غير قابلة للعكس (تعدد خطي بين المتغيرات).');
  const XtY = matMul(Xt, y);
  const beta = matMul(XtXinv, XtY).map(r => r[0]);

  const predictions = X.map(xr => xr.reduce((s, xi, i) => s + xi * beta[i], 0));
  const yMean = y.reduce((s, r) => s + r[0], 0) / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (y[i][0] - predictions[i]) ** 2;
    ssTot += (y[i][0] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const p = features.length;
  const adjustedR2 = 1 - (1 - r2) * (n - 1) / (n - p - 1);
  const rmse = Math.sqrt(ssRes / n);

  // Standard errors: sigma^2 * diag((X'X)^-1)
  const dof = n - p - 1;
  const sigma2 = dof > 0 ? ssRes / dof : 0;
  const stdErrors = beta.map((_, i) => Math.sqrt(Math.max(0, sigma2 * XtXinv[i][i])));
  const tStats = beta.map((b, i) => (stdErrors[i] > 0 ? b / stdErrors[i] : 0));

  return {
    features,
    target,
    intercept: beta[0],
    coefficients: beta.slice(1),
    r2,
    adjustedR2,
    n,
    rmse,
    stdErrors,
    tStats,
    predictions,
  };
}

// ──────────────────────────────────────────────────────────────
//  K-Means clustering (with z-score normalization + k-means++)
// ──────────────────────────────────────────────────────────────

export interface ClusterResult {
  k: number;
  features: string[];
  assignments: number[];
  /** centroids in original feature units */
  centroids: number[][];
  sizes: number[];
  inertia: number;
  iterations: number;
  /** validRowIndices[i] maps assignment i back to the original row index */
  validRowIndices: number[];
}

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

export function kMeans(
  data: DataRow[],
  features: string[],
  k: number,
  maxIter = 100,
): ClusterResult {
  const validRowIndices: number[] = [];
  const raw: number[][] = [];
  data.forEach((r, idx) => {
    const x = features.map(f => num(r[f]));
    if (!x.some(Number.isNaN)) {
      raw.push(x);
      validRowIndices.push(idx);
    }
  });

  const n = raw.length;
  if (n < k) throw new Error('عدد الصفوف الصالحة أقل من عدد المجموعات.');

  // z-score normalize
  const dim = features.length;
  const means = Array(dim).fill(0);
  const stds = Array(dim).fill(0);
  for (const x of raw) for (let j = 0; j < dim; j++) means[j] += x[j];
  for (let j = 0; j < dim; j++) means[j] /= n;
  for (const x of raw) for (let j = 0; j < dim; j++) stds[j] += (x[j] - means[j]) ** 2;
  for (let j = 0; j < dim; j++) stds[j] = Math.sqrt(stds[j] / n) || 1;
  const norm = raw.map(x => x.map((v, j) => (v - means[j]) / stds[j]));

  // k-means++ init
  const centroids: number[][] = [];
  centroids.push(norm[Math.floor(Math.random() * n)].slice());
  while (centroids.length < k) {
    const d = norm.map(x => Math.min(...centroids.map(c => dist2(x, c))));
    const total = d.reduce((a, b) => a + b, 0);
    let target = Math.random() * total;
    let chosen = 0;
    for (let i = 0; i < n; i++) { target -= d[i]; if (target <= 0) { chosen = i; break; } }
    centroids.push(norm[chosen].slice());
  }

  const assignments = new Array(n).fill(0);
  let iterations = 0;
  for (; iterations < maxIter; iterations++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = dist2(norm[i], centroids[c]);
        if (dd < bestD) { bestD = dd; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    const sums = Array.from({ length: k }, () => Array(dim).fill(0));
    const counts = Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      counts[assignments[i]]++;
      for (let j = 0; j < dim; j++) sums[assignments[i]][j] += norm[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      for (let j = 0; j < dim; j++) centroids[c][j] = sums[c][j] / counts[c];
    }
    if (!changed) { iterations++; break; }
  }

  let inertia = 0;
  for (let i = 0; i < n; i++) inertia += dist2(norm[i], centroids[assignments[i]]);

  const sizes = Array(k).fill(0);
  assignments.forEach(a => sizes[a]++);

  // de-normalize centroids back to original units
  const centroidsOrig = centroids.map(c => c.map((v, j) => v * stds[j] + means[j]));

  return { k, features, assignments, centroids: centroidsOrig, sizes, inertia, iterations, validRowIndices };
}
