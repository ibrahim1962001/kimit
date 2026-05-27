import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useKimitData } from '../hooks/useKimitData';
import { exportSmartDashboardBundle } from '../lib/smartDashboardHtmlExport';
import {
  barOpt,
  CHART,
  type ChartThemeMode,
  donutOpt,
  heatmapOpt,
  histOpt,
  lineOpt,
  paretoOpt,
  pyramidOpt,
  radarOpt,
  treemapOpt,
} from '../lib/smartDashboardCharts';
import {
  applyDashboardFilters,
  detectSmartCategory,
  fmtCompact as fmt,
  getSmartDashboardLayout,
  groupByCount,
  groupBySum,
  pickBestCategoryColumn,
  pickBestNumericColumn,
  pickDateColumn,
  sampleRowsForCharts,
  SMART_CAT_META,
  type SmartDashboardLayout,
} from '../lib/smartDashboardUtils';
import { ArrowLeft, Download, RefreshCw, LayoutDashboard, Filter, X, Sun, Moon } from 'lucide-react';
import './smart-dashboard-redesign.css';

interface Props { onBack: () => void; }
function calcStats(vals: number[]) {
  const s = vals.filter(v => !isNaN(v) && v !== null).sort((a, b) => a - b);
  const n = s.length; if (n === 0) return null;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0 ? (s[n/2-1] + s[n/2]) / 2 : s[Math.floor(n/2)];
  const std = Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  const q1 = s[Math.floor(n * 0.25)]; const q3 = s[Math.floor(n * 0.75)]; const iqr = q3 - q1;
  const outliers = s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
  return { mean, median, std, min: s[0], max: s[n-1], q1, q3, outliers, n };
}
// ── Statistical Helpers ──────────────────────────────────────────
function calcSkew(vals: number[], mean: number, std: number): number {
  const n = vals.length; if (n < 3 || !std) return 0;
  return (vals.reduce((a, v) => a + Math.pow((v - mean) / std, 3), 0) / n);
}
function calcKurt(vals: number[], mean: number, std: number): number {
  const n = vals.length; if (n < 4 || !std) return 0;
  return (vals.reduce((a, v) => a + Math.pow((v - mean) / std, 4), 0) / n) - 3;
}
function calcMode(vals: number[]): number {
  const freq = new Map<number, number>();
  vals.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx); const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  cell?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, cell, children, className = '' }) => (
  <div className={`sd2-card sd-chart-card${cell ? ` sd2-cell sd2-cell--${cell}` : ''} ${className}`.trim()}>
    <div className="sd2-card-head">
      <div className="sd2-card-title">{title}</div>
      {subtitle ? <div className="sd2-card-sub">{subtitle}</div> : null}
    </div>
    {children}
  </div>
);

// ── Main Page ────────────────────────────────────────────────────
export const SmartDashboardPage: React.FC<Props> = ({ onBack }) => {
  const {
    info,
    activeFilters,
    crossFilters,
    isCrossFiltered,
    clearCrossFilters,
    clearFilters,
  } = useKimitData();
  const [refreshKey, setRefreshKey] = useState(0);
  const [chartTheme, setChartTheme] = useState<ChartThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'light';
    return localStorage.getItem('kimit_sd_theme') === 'dark' ? 'dark' : 'light';
  });

  const toggleChartTheme = () => {
    setChartTheme(prev => {
      const next: ChartThemeMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('kimit_sd_theme', next);
      return next;
    });
  };

  const lang = (typeof localStorage !== 'undefined' ? localStorage.getItem('kimit_lang') : null) || 'en';
  const isAr = lang === 'ar';

  const rawData = useMemo(() => {
    if (!info) return [];
    return applyDashboardFilters(info.workData, activeFilters, crossFilters);
  }, [info, activeFilters, crossFilters]);

  const data = useMemo(() => sampleRowsForCharts(rawData), [rawData]);
  const isSampled = rawData.length > data.length;

  const numCols = useMemo(
    () => (info?.columns ?? []).filter(c => c.type === 'numeric').map(c => c.name),
    [info],
  );

  const primaryCat = useMemo(
    () => (info ? pickBestCategoryColumn(info.columns, rawData) : null),
    [info, rawData],
  );
  const primaryNum = useMemo(
    () => (info ? pickBestNumericColumn(info.columns) : null),
    [info],
  );
  const dateCol = useMemo(
    () => (info ? pickDateColumn(info.columns) : null),
    [info],
  );

  const catCols = useMemo(() => {
    const rest = (info?.columns ?? []).filter(c => c.type !== 'numeric').map(c => c.name);
    if (primaryCat && !rest.includes(primaryCat)) return [primaryCat, ...rest];
    if (primaryCat) return [primaryCat, ...rest.filter(c => c !== primaryCat)];
    return rest;
  }, [info, primaryCat]);

  const orderedNumCols = useMemo(() => {
    if (!primaryNum || !numCols.includes(primaryNum)) return numCols;
    return [primaryNum, ...numCols.filter(c => c !== primaryNum)];
  }, [numCols, primaryNum]);

  const cat = useMemo(
    () => detectSmartCategory((info?.columns ?? []).map(c => c.name)),
    [info],
  );
  const meta = SMART_CAT_META[cat];
  const dashLayout: SmartDashboardLayout = useMemo(() => getSmartDashboardLayout(cat), [cat]);

  const palette = useMemo(() => CHART.palette, []);

  // KPI values
  const kpis = useMemo(() => {
    const result = [];
    const n = orderedNumCols[0];
    if (n) {
      const vals = data.map(r => Number(r[n]) || 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const avg   = total / (vals.length || 1);
      const max   = Math.max(...vals);
      const sparkVals = vals.slice(0, 30);
      result.push({ title: `Total ${n}`,   value: fmt(total), sub: `across ${data.length} rows`, color: meta.p, sparkVals, icon: '📈' });
      result.push({ title: `Avg ${n}`,     value: fmt(Math.round(avg)), sub: 'per record', color: meta.s, sparkVals: sparkVals.map((_, i) => i % 2 === 0 ? avg * 0.9 : avg * 1.1), icon: '⚡' });
      result.push({ title: `Max ${n}`,     value: fmt(max), sub: 'highest value', color: '#f59e0b', sparkVals: sparkVals.map(v => v === max ? max : max * 0.6), icon: '🏆' });
    }
    result.push({ title: 'Total Records', value: fmt(data.length), sub: `${catCols.length} categories`, color: '#6366f1', sparkVals: Array.from({ length: 20 }, (_, i) => i + 1), icon: '📋' });
    return result.slice(0, 4);
  }, [data, orderedNumCols, catCols, meta]);

  // Trend (line) chart — date column when available, else row index
  const trendOpts = useMemo(() => {
    const col = orderedNumCols[0];
    if (!col) return null;

    let rows = [...data];
    if (dateCol) {
      rows.sort((a, b) => String(a[dateCol] ?? '').localeCompare(String(b[dateCol] ?? '')));
    }
    const step = Math.max(1, Math.floor(rows.length / 60));
    const sliced = rows.filter((_, i) => i % step === 0).slice(0, 60);
    const labels = dateCol
      ? sliced.map(r => String(r[dateCol] ?? '').slice(0, 12))
      : sliced.map((_, i) => String(i + 1));
    const values = sliced.map(r => Number(r[col]) || 0);
    return lineOpt(labels, values, meta.p, chartTheme);
  }, [data, orderedNumCols, dateCol, meta, chartTheme]);

  // Bar chart — top categories by first numeric
  const barOpts = useMemo(() => {
    if (!catCols[0] || !orderedNumCols[0]) return null;
    const rows = groupBySum(data, catCols[0], orderedNumCols[0], 10).reverse();
    return barOpt(rows.map(r => r.l.length > 16 ? r.l.slice(0, 14) + '…' : r.l), rows.map(r => r.v), meta.s, chartTheme);
  }, [data, catCols, orderedNumCols, meta, chartTheme]);

  // Donut chart — category distribution
  const donutOpts = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 7);
    return donutOpt(rows, palette, chartTheme);
  }, [data, catCols, palette, chartTheme]);

  // Descriptive statistics per numeric column
  const statsData = useMemo(() =>
    orderedNumCols.slice(0, 6).map(col => {
      const vals = data.map(r => Number(r[col]));
      const st = calcStats(vals);
      return st ? { col, ...st } : null;
    }).filter(Boolean) as ({ col: string; mean: number; median: number; std: number; min: number; max: number; q1: number; q3: number; outliers: number; n: number })[],
  [data, orderedNumCols]);

  // Auto-generated decision insights
  const insights = useMemo(() => {
    const result: { icon: string; title: string; desc: string; color: string }[] = [];
    if (isCrossFiltered) {
      result.push({
        icon: '🔎',
        title: isAr ? 'فلتر نشط' : 'Active Filter',
        desc: isAr
          ? `يعرض ${rawData.length.toLocaleString()} صفاً من أصل ${(info?.workData.length ?? 0).toLocaleString()}`
          : `Showing ${rawData.length.toLocaleString()} of ${(info?.workData.length ?? 0).toLocaleString()} rows`,
        color: '#3b82f6',
      });
    }
    if (catCols[0] && orderedNumCols[0]) {
      const top = groupBySum(data, catCols[0], orderedNumCols[0], 1)[0];
      if (top) {
        result.push({
          icon: '🏆',
          title: isAr ? 'الأعلى أداءً' : 'Top Performer',
          desc: isAr
            ? `"${top.l.slice(0, 20)}" يتصدر بـ ${fmt(top.v)} في ${orderedNumCols[0]}`
            : `"${top.l.slice(0, 20)}" leads with ${fmt(top.v)} in ${orderedNumCols[0]}`,
          color: '#10b981',
        });
      }
    }
    const s0 = statsData[0];
    if (s0 && s0.outliers > 0) {
      const pct = Math.round((s0.outliers / s0.n) * 100);
      result.push({ icon: '⚠️', title: 'Outliers Detected', desc: `${s0.outliers} values (${pct}%) are outliers in "${s0.col}"`, color: '#f59e0b' });
    }
    const missing = data.reduce((a, r) => a + Object.values(r).filter(v => v === null || v === undefined || v === '').length, 0);
    if (missing > 0) result.push({ icon: '🔍', title: 'Missing Data Alert', desc: `${missing.toLocaleString()} empty cells — run Cleaning to fix`, color: '#ef4444' });
    else result.push({ icon: '✅', title: 'Clean Dataset', desc: 'No missing values detected across all columns', color: '#10b981' });
    if (s0) result.push({ icon: '📊', title: 'Value Range', desc: `"${s0.col}" spans ${fmt(s0.min)} → ${fmt(s0.max)}, avg ${fmt(Math.round(s0.mean))}`, color: '#6366f1' });
    if (catCols[0]) {
      const unique = new Set(data.map(r => String(r[catCols[0]]))).size;
      result.push({ icon: '🎯', title: 'Category Diversity', desc: `"${catCols[0]}" contains ${unique} unique values`, color: '#3b82f6' });
    }
    return result.slice(0, 5);
  }, [data, orderedNumCols, catCols, statsData, isCrossFiltered, rawData.length, info?.workData.length, isAr]);

  // Top 5 & Bottom 5 by primary metric
  const topBottom = useMemo(() => {
    if (!orderedNumCols[0]) return { top: [], bottom: [] };
    const col = orderedNumCols[0];
    const sorted = [...data].sort((a, b) => (Number(b[col]) || 0) - (Number(a[col]) || 0));
    return { top: sorted.slice(0, 5), bottom: [...sorted.slice(-5)].reverse() };
  }, [data, orderedNumCols]);

  // Missing data per column
  const missingCols = useMemo(() =>
    (info?.columns ?? []).map(c => ({
      col: c.name,
      pct: Math.round((data.filter(r => r[c.name] === null || r[c.name] === undefined || r[c.name] === '').length / (data.length || 1)) * 100),
    })).filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 8),
  [data, info]);

  // Histogram of first numeric column
  const histChart = useMemo(() => {
    if (!orderedNumCols[0]) return null;
    const vals = data.map(r => Number(r[orderedNumCols[0]])).filter(v => !isNaN(v));
    return histOpt(vals, orderedNumCols[0], meta.s, chartTheme);
  }, [data, orderedNumCols, meta, chartTheme]);

  // Radar chart — top 5 categories across all numeric cols
  const radarChart = useMemo(() => {
    if (numCols.length < 2 || !catCols[0]) return null;
    const topCats = groupByCount(data, catCols[0], 5).map(g => g.l);
    if (topCats.length < 3) return null;
    const numSlice = numCols.slice(0, 5);
    const indicators = numSlice.map(col => {
      const max = Math.max(...data.map(r => Number(r[col]) || 0));
      return { name: col.length > 10 ? col.slice(0, 9) + '…' : col, max: max || 1 };
    });
    const series = topCats.slice(0, 4).map(cat => {
      const rows = data.filter(r => String(r[catCols[0]]) === cat);
      const value = numSlice.map(col => Math.round(rows.reduce((s, r) => s + (Number(r[col]) || 0), 0) / (rows.length || 1)));
      return { name: cat.length > 12 ? cat.slice(0, 11) + '…' : cat, value };
    });
    return radarOpt(indicators, series, palette, chartTheme);
  }, [data, numCols, catCols, palette, chartTheme]);



  // Column profiling — per column detail
  const columnProfile = useMemo(() =>
    (info?.columns ?? []).map(col => {
      const vals = data.map(r => r[col.name]);
      const filled = vals.filter(v => v !== null && v !== undefined && v !== '').length;
      const fillRate = Math.round((filled / (data.length || 1)) * 100);
      const strVals = vals.map(v => String(v ?? '')).filter(v => v && v !== 'null' && v !== 'undefined');
      const uniqCount = new Set(strVals).size;
      const uniqRate = Math.round((uniqCount / (filled || 1)) * 100);
      const freq = new Map<string, number>();
      strVals.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
      const zeros = String(col.type) === 'numeric' ? vals.filter(v => Number(v) === 0).length : 0;
      return { name: col.name, type: String(col.type), fillRate, uniqCount, uniqRate, topVal: top?.[0]?.slice(0, 20) ?? '—', topCount: top?.[1] ?? 0, zeros };
    }), [data, info]);

  // Dataset summary totals
  const summaryStats = useMemo(() => {
    const cols = info?.columns ?? [];
    const totalCells = data.length * cols.length;
    const emptyCells = data.reduce((a, r) => a + Object.values(r).filter(v => v === null || v === undefined || v === '').length, 0);
    const seen = new Set<string>(); let dupRows = 0;
    data.forEach(r => { const k = JSON.stringify(r); if (seen.has(k)) dupRows++; else seen.add(k); });
    return {
      totalCells, emptyCells, dupRows,
      numColsCount: numCols.length,
      catColsCount: cols.filter(c => String(c.type) !== 'numeric').length,
      dateColsCount: cols.filter(c => String(c.type) === 'date').length,
      fillRate: Math.round(((totalCells - emptyCells) / (totalCells || 1)) * 100),
      uniqRows: data.length - dupRows,
      colRowRatio: (cols.length / (data.length || 1)).toFixed(4),
      density: Math.round(((totalCells - emptyCells) / (totalCells || 1)) * 100),
    };
  }, [data, info, numCols]);

  // Pareto chart (80/20 rule)
  const paretoChart = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 15);
    return paretoOpt(rows.map(r => r.l.length > 10 ? r.l.slice(0, 9) + '…' : r.l), rows.map(r => r.v), meta.p, chartTheme);
  }, [data, catCols, numCols, meta, chartTheme]);

  // Correlation Heatmap
  const correlationChart = useMemo(() => {
    if (numCols.length < 3) return null;
    const cols = numCols.slice(0, 7);
    const getVals = (col: string) => data.map(r => Number(r[col]) || 0);
    const corr = (a: number[], b: number[]) => {
      const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
      const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
      const da = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0));
      const db = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
      return da && db ? Math.round((num / (da * db)) * 100) / 100 : 0;
    };
    const matrix = cols.map(ca => cols.map(cb => corr(getVals(ca), getVals(cb))));
    return heatmapOpt(cols.map(c => c.length > 8 ? c.slice(0, 7) + '…' : c), matrix, chartTheme);
  }, [data, numCols, chartTheme]);

  // Treemap
  const treemapChart = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 25);
    return treemapOpt(rows.map(r => ({ name: r.l.length > 20 ? r.l.slice(0, 19) + '…' : r.l, value: Math.max(1, Math.round(r.v)) })), meta.p, chartTheme);
  }, [data, catCols, numCols, meta, chartTheme]);

  // Advanced stats per numeric column (skewness, kurtosis, mode, CV, percentiles, IQR, sum, variance)
  const advStats = useMemo(() =>
    numCols.slice(0, 6).map(col => {
      const vals = data.map(r => Number(r[col])).filter(v => !isNaN(v));
      const sorted = [...vals].sort((a, b) => a - b);
      const n = sorted.length; if (!n) return null;
      const mean = vals.reduce((a, b) => a + b, 0) / n;
      const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);
      const q1 = percentile(sorted, 25); const q3 = percentile(sorted, 75);
      const p5 = percentile(sorted, 5);  const p95 = percentile(sorted, 95);
      const skew = calcSkew(vals, mean, std);
      const kurt = calcKurt(vals, mean, std);
      const mode = calcMode(vals);
      const cv = std / (mean || 1) * 100;
      const sum = vals.reduce((a, b) => a + b, 0);
      const iqr = q3 - q1;
      const neg = vals.filter(v => v < 0).length;
      const pos = vals.filter(v => v > 0).length;
      const skewLabel = Math.abs(skew) < 0.5 ? 'Symmetric' : skew > 0 ? 'Right Skewed' : 'Left Skewed';
      const kurtLabel = Math.abs(kurt) < 1 ? 'Normal' : kurt > 0 ? 'Leptokurtic' : 'Platykurtic';
      return { col, mean, variance, std, q1, q3, p5, p95, skew, kurt, mode, cv, sum, iqr, neg, pos, skewLabel, kurtLabel };
    }).filter(Boolean) as { col: string; mean: number; variance: number; std: number; q1: number; q3: number; p5: number; p95: number; skew: number; kurt: number; mode: number; cv: number; sum: number; iqr: number; neg: number; pos: number; skewLabel: string; kurtLabel: string }[],
  [data, numCols]);

  // Category Intelligence (15 metrics)
  const catIntelligence = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 999);
    const total = rows.reduce((a, r) => a + r.v, 0);
    const n = rows.length;
    const top1Pct = n ? Math.round((rows[0].v / total) * 100) : 0;
    const top3Sum = rows.slice(0, 3).reduce((a, r) => a + r.v, 0);
    const top3Pct = Math.round((top3Sum / total) * 100);
    const avgPerCat = Math.round(total / (n || 1));
    const singletons = rows.filter(r => r.v === 1).length;
    // Entropy (Shannon)
    const entropy = -rows.reduce((a, r) => { const p = r.v / total; return a + (p > 0 ? p * Math.log2(p) : 0); }, 0);
    const maxEntropy = Math.log2(n || 1);
    const balance = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
    // How many cats = 80% of total
    let cum = 0; let cats80 = 0;
    for (const r of rows) { cum += r.v; cats80++; if (cum / total >= 0.8) break; }
    // Long tail: categories with < 1% share
    const longTail = rows.filter(r => r.v / total < 0.01).length;
    const rarest = rows[rows.length - 1];
    // Concentration index (Herfindahl)
    const hhi = Math.round(rows.reduce((a, r) => a + Math.pow(r.v / total, 2), 0) * 10000);
    return { n, top1Pct, top3Pct, avgPerCat, singletons, entropy: Math.round(entropy * 100) / 100, balance, cats80, longTail, hhi, rarest: rarest?.l ?? '—', rarestV: rarest?.v ?? 0, top1: rows[0]?.l ?? '—', top1V: rows[0]?.v ?? 0, total };
  }, [data, catCols]);

  // Quality Grade (A-F)
  const qualityGrade = useMemo(() => {
    const cols = info?.columns ?? [];
    const totalCells = data.length * cols.length;
    const emptyCells = data.reduce((a, r) => a + Object.values(r).filter(v => v === null || v === undefined || v === '').length, 0);
    const fillRate = totalCells > 0 ? ((totalCells - emptyCells) / totalCells) * 100 : 100;
    const seen = new Set<string>(); let dups = 0;
    data.forEach(r => { const k = JSON.stringify(r); if (seen.has(k)) dups++; else seen.add(k); });
    const dupRate = data.length > 0 ? (dups / data.length) * 100 : 0;
    const outlierPct = statsData.length
      ? statsData.reduce((a, s) => a + (s.outliers / (s.n || 1)) * 100, 0) / statsData.length
      : 0;
    const score = Math.round(fillRate * 0.5 + Math.max(0, 100 - dupRate * 5) * 0.3 + Math.max(0, 100 - outlierPct * 2) * 0.2);
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    const gradeColor = score >= 90 ? '#10b981' : score >= 80 ? '#3b82f6' : score >= 70 ? '#f59e0b' : score >= 60 ? '#f97316' : '#ef4444';
    return { score, grade, gradeColor, fillRate: Math.round(fillRate), dupRate: Math.round(dupRate * 10) / 10, outlierPct: Math.round(outlierPct * 10) / 10 };
  }, [data, info, statsData]);

  const pyramidChart = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 7);
    const labels = rows.map(r => (r.l.length > 10 ? r.l.slice(0, 9) + '…' : r.l)).reverse();
    const values = rows.map(r => r.v).reverse();
    return pyramidOpt(labels, values, chartTheme);
  }, [data, catCols, chartTheme]);

  /** Up to 6 priority charts — no duplicate types */
  const coreCharts = useMemo(() => {
    type Slot = { id: string; title: string; subtitle: string; option: object; tall?: boolean };
    const slots: Slot[] = [];
    const used = new Set<string>();

    const push = (id: string, title: string, subtitle: string, option: object | null, tall = false) => {
      if (!option || slots.length >= 6 || used.has(id)) return;
      used.add(id);
      slots.push({ id, title, subtitle, option, tall });
    };

    const overviewOpt = treemapChart ?? trendOpts ?? donutOpts;
    const overviewId = treemapChart ? 'treemap' : trendOpts ? 'trend' : 'donut';
    if (overviewOpt) {
      push(
        overviewId,
        isAr ? 'نظرة عامة على البيانات' : 'Data Overview',
        isAr ? 'توزيع الحجم والقيمة' : 'Size and value distribution',
        overviewOpt,
        true,
      );
    }

    if (trendOpts && overviewId !== 'trend') {
      push(
        'trend',
        `📈 ${orderedNumCols[0] ?? ''} — ${isAr ? 'الاتجاه' : 'Trend'}`,
        isAr ? 'حركة القيم عبر الزمن' : 'Value movement over time',
        trendOpts,
      );
    }

    if (barOpts && catCols[0]) {
      push(
        'breakdown',
        `🏅 ${isAr ? 'أفضل' : 'Top'} ${catCols[0]}`,
        isAr ? 'ترتيب الفئات حسب المقياس' : 'Category ranking by metric',
        barOpts,
      );
    }

    if (donutOpts && catCols[0] && overviewId !== 'donut') {
      push(
        'composition',
        `🍩 ${catCols[0]} — ${isAr ? 'التوزيع' : 'Distribution'}`,
        isAr ? 'حصة كل فئة' : 'Share per category',
        donutOpts,
      );
    }

    const distOpt = pyramidChart ?? histChart;
    if (distOpt) {
      push(
        pyramidChart ? 'pyramid' : 'histogram',
        pyramidChart ? (isAr ? 'توزيع الفئات' : 'Category Split') : (isAr ? 'توزيع القيم' : 'Value Distribution'),
        catCols[0] ?? orderedNumCols[0] ?? '',
        distOpt,
      );
    }

    const sixth = radarChart ?? paretoChart ?? correlationChart;
    if (sixth) {
      push(
        radarChart ? 'radar' : paretoChart ? 'pareto' : 'heatmap',
        radarChart
          ? (isAr ? 'مقارنة الأبعاد' : 'Multi-Metric Radar')
          : paretoChart
            ? (isAr ? 'قاعدة 80/20' : 'Pareto 80/20')
            : (isAr ? 'مصفوفة الارتباط' : 'Correlation Matrix'),
        isAr ? 'تحليل متقدم' : 'Advanced analysis',
        sixth,
      );
    }

    return slots;
  }, [
    treemapChart, trendOpts, donutOpts, barOpts, pyramidChart, histChart,
    radarChart, paretoChart, correlationChart,
    orderedNumCols, catCols, isAr,
  ]);

  if (!info || rawData.length === 0) {
    return (
      <div className="sd2-page sd2-empty" data-cat="general">
        <LayoutDashboard size={48} color="#334155" />
        <h2>{isAr ? 'السمارت داشبورد' : 'Smart Dashboard'}</h2>
        <p>
          {isAr
            ? 'ارفع ملف بيانات أولاً لعرض لوحة تحليل ذكية تلقائية حسب نوع البيانات.'
            : 'Upload a dataset first to unlock an auto-detected analytics dashboard.'}
        </p>
        <div className="sd2-empty-actions">
          <button type="button" className="sd2-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('kimit:navigate', { detail: 'home' }))}>
            {isAr ? 'رفع ملف' : 'Upload File'}
          </button>
          <button type="button" className="sd2-btn-ghost" onClick={onBack}>
            {isAr ? 'رجوع' : 'Back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sd2-page sd-page" data-cat={cat} data-theme={chartTheme}>

      <header className="sd2-header">
        <div className="sd2-header-brand">
          <button type="button" className="sd2-back-btn" onClick={onBack}>
            <ArrowLeft size={15} /> {isAr ? 'رجوع' : 'Back'}
          </button>
          <div className="sd2-header-icon">{meta.icon}</div>
          <div>
            <div className="sd2-header-title">
              {isAr ? 'السمارت داشبورد' : 'Smart Dashboard'}
              <span className="sd2-cat-badge">{isAr ? meta.labelAr : meta.label}</span>
            </div>
            <div className="sd2-header-sub">
              {info.filename} • {rawData.length.toLocaleString()}{isSampled ? ` (${isAr ? 'عينة' : 'sampled'})` : ''} {isAr ? 'صف' : 'rows'}
            </div>
          </div>
        </div>
        <div className="sd2-header-actions">
          <button
            type="button"
            className="sd2-icon-btn sd2-theme-btn"
            onClick={toggleChartTheme}
            aria-label={chartTheme === 'light' ? (isAr ? 'وضع داكن' : 'Dark mode') : (isAr ? 'وضع فاتح' : 'Light mode')}
            title={chartTheme === 'light' ? (isAr ? 'وضع داكن' : 'Dark mode') : (isAr ? 'وضع فاتح' : 'Light mode')}
          >
            {chartTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span className="sd2-theme-label">{chartTheme === 'light' ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light')}</span>
          </button>
          <button type="button" className="sd2-icon-btn" onClick={() => setRefreshKey(k => k + 1)} aria-label="Refresh">
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            className="sd2-export-btn"
            title={isAr ? 'تنزيل Excel + فتح داشبورد تفاعلي' : 'Download Excel + open interactive dashboard'}
            onClick={() =>
              exportSmartDashboardBundle({
                filename: `Smart_Dashboard_${info.filename.replace(/\.[^.]+$/, '')}.xlsx`,
                datasetName: info.filename.replace(/\.[^.]+$/, '') || info.filename,
                data: rawData,
                categoryColumn: catCols[0] ?? null,
                metricColumn: orderedNumCols[0] ?? null,
                dateColumn: dateCol ?? null,
                kpis: kpis.map(k => ({ title: k.title, value: k.value, sub: k.sub })),
                insights: insights.slice(0, 6).map(i => ({ title: i.title, desc: i.desc })),
                topRows: topBottom.top.slice(0, 10),
                quality: {
                  score: qualityGrade.score,
                  grade: qualityGrade.grade,
                  fillRate: qualityGrade.fillRate,
                  dupRate: qualityGrade.dupRate,
                  outlierPct: qualityGrade.outlierPct,
                },
                charts: coreCharts.map(c => ({
                  title: c.title,
                  subtitle: c.subtitle,
                  option: c.option,
                })),
                theme: chartTheme,
                isAr,
              })
            }
          >
            <Download size={14} /> {isAr ? 'تصدير Excel + داشبورد' : 'Export Excel + Dashboard'}
          </button>
        </div>
      </header>

      <div className="sd2-body">

        {(isCrossFiltered || Object.keys(activeFilters).some(k => activeFilters[k] && activeFilters[k] !== 'all')) && (
          <div className="sd2-filter-banner">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} />
              {isAr
                ? `فلتر نشط — ${rawData.length.toLocaleString()} من ${info.workData.length.toLocaleString()} صف`
                : `Filtered view — ${rawData.length.toLocaleString()} of ${info.workData.length.toLocaleString()} rows`}
            </span>
            <button type="button" className="sd2-filter-clear" onClick={() => { clearCrossFilters(); clearFilters(); }}>
              <X size={14} />
              {isAr ? 'إزالة الفلاتر' : 'Clear filters'}
            </button>
          </div>
        )}

        <div className="sd2-campaign-head">
          <div className="sd2-campaign-left">
            <div className="sd2-campaign-avatar">{meta.icon}</div>
            <div>
              <h1 className="sd2-campaign-title">{info.filename.replace(/\.[^.]+$/, '') || info.filename}</h1>
              <p className="sd2-campaign-sub">{isAr ? meta.labelAr : meta.label} · {isAr ? dashLayout.taglineAr : dashLayout.taglineEn}</p>
            </div>
          </div>
          <span className="sd2-status-pill">{isAr ? 'نشط' : 'Active'}</span>
        </div>

        <div className="sd2-card sd2-metrics-panel sd2-metrics-full">
          {kpis.map((k, i) => (
            <div key={i} className="sd2-metric-item">
              <div className="sd2-metric-icon-wrap">{k.icon}</div>
              <div className="sd2-metric-body">
                <div className="sd2-metric-label">{k.title}</div>
                <div className="sd2-metric-value">{k.value}</div>
                <div className="sd2-metric-sub">{k.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {coreCharts.length > 0 && (
          <div className="sd2-charts-grid">
            {coreCharts.map(slot => (
              <ChartCard
                key={slot.id}
                title={slot.title}
                subtitle={slot.subtitle}
                className={slot.tall ? 'sd2-chart-card--tall' : ''}
              >
                <ReactECharts
                  key={`${slot.id}-${refreshKey}-${chartTheme}`}
                  option={slot.option}
                  style={{ height: slot.tall ? 300 : 260 }}
                />
              </ChartCard>
            ))}
          </div>
        )}

        {insights.length > 0 && (
          <div className="sd2-insights">
            {insights.slice(0, 4).map((ins, i) => (
              <div key={i} className="sd2-insight" style={{ ['--sd-insight-color' as string]: ins.color }}>
                <span className="sd2-insight-icon">{ins.icon}</span>
                <div>
                  <div className="sd2-insight-title">{ins.title}</div>
                  <div className="sd2-insight-desc">{ins.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {catCols[0] && orderedNumCols[0] && (
          <div className="sd2-card sd2-table-card sd2-table-standalone">
            <div className="sd2-card-head sd2-card-head-row">
              <div className="sd2-card-title">{isAr ? 'أفضل القيم' : 'Top Records'}</div>
              <span className="sd2-card-link">{isAr ? 'حسب' : 'by'} {orderedNumCols[0]}</span>
            </div>
            <table className="sd2-rank-table">
              <thead>
                <tr>
                  <th>{catCols[0]}</th>
                  <th>{orderedNumCols[0]}</th>
                </tr>
              </thead>
              <tbody>
                {topBottom.top.map((row, i) => (
                  <tr key={i}>
                    <td>{String(row[catCols[0]] ?? '—').slice(0, 24)}</td>
                    <td className="sd2-rank-val">{fmt(Number(row[orderedNumCols[0]]) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="sd2-section sd2-quality" style={{ borderColor: `${qualityGrade.gradeColor}33` }}>
          <div>
            <div className="sd2-grade" style={{ color: qualityGrade.gradeColor }}>{qualityGrade.grade}</div>
            <div className="sd2-grade-label">{isAr ? 'درجة الجودة' : 'Quality Grade'}</div>
          </div>
          <div className="sd2-mini-grid" style={{ flex: 1, minWidth: 240 }}>
            {[
              { label: isAr ? 'نقاط الجودة' : 'Quality Score', val: qualityGrade.score + '/100', color: qualityGrade.gradeColor },
              { label: isAr ? 'نسبة الامتلاء' : 'Fill Rate', val: qualityGrade.fillRate + '%', color: qualityGrade.fillRate > 95 ? '#10b981' : '#f59e0b' },
              { label: isAr ? 'التكرار' : 'Duplicate Rate', val: qualityGrade.dupRate + '%', color: qualityGrade.dupRate > 5 ? '#ef4444' : '#10b981' },
            ].map(item => (
              <div key={item.label} className="sd2-mini" style={{ borderColor: `${item.color}22` }}>
                <div className="sd2-mini-val" style={{ color: item.color }}>{item.val}</div>
                <div className="sd2-mini-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Category Intelligence Panel (15 metrics) ── */}
        {catIntelligence && (
          <div className="sd2-analytics-panel">
            <div className="sd2-panel-title">🧠 Category Intelligence — "{catCols[0]}"</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: 'Total Categories', val: catIntelligence.n.toLocaleString(), icon: '📂', color: meta.p },
                { label: 'Total Records', val: catIntelligence.total.toLocaleString(), icon: '📊', color: '#3b82f6' },
                { label: 'Top Category', val: catIntelligence.top1.slice(0, 16), icon: '🥇', color: '#10b981' },
                { label: 'Top Cat Share', val: catIntelligence.top1Pct + '%', icon: '👑', color: '#f59e0b' },
                { label: 'Top 3 Share', val: catIntelligence.top3Pct + '%', icon: '🏅', color: '#6366f1' },
                { label: 'Avg per Category', val: catIntelligence.avgPerCat.toLocaleString(), icon: '📐', color: '#06b6d4' },
                { label: 'Cats for 80%', val: catIntelligence.cats80.toString(), icon: '📐', color: '#8b5cf6' },
                { label: 'Long Tail Cats', val: catIntelligence.longTail.toString(), icon: '🦀', color: '#94a3b8' },
                { label: 'Singletons', val: catIntelligence.singletons.toString(), icon: '🔂', color: '#64748b' },
                { label: 'Balance Score', val: catIntelligence.balance + '%', icon: '⚖️', color: catIntelligence.balance > 70 ? '#10b981' : '#f59e0b' },
                { label: 'Shannon Entropy', val: catIntelligence.entropy.toFixed(2), icon: '🌊', color: '#3b82f6' },
                { label: 'HHI (Concentration)', val: catIntelligence.hhi.toString(), icon: '🎯', color: catIntelligence.hhi > 2500 ? '#ef4444' : '#10b981' },
                { label: 'Rarest Category', val: catIntelligence.rarest.slice(0, 14), icon: '💎', color: '#f43f5e' },
                { label: 'Rarest Count', val: catIntelligence.rarestV.toString(), icon: '🔬', color: '#64748b' },
                { label: 'Dominant?', val: catIntelligence.top1Pct > 50 ? 'Yes' : 'Distributed', icon: '📡', color: catIntelligence.top1Pct > 50 ? '#f59e0b' : '#10b981' },
              ].map(item => (
                <div key={item.label} style={{ background: `${item.color}0d`, border: `1px solid ${item.color}22`, borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{item.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: item.color, lineHeight: 1.1 }}>{item.val}</div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Advanced Statistical Analysis Table ── */}
        {advStats.length > 0 && (
          <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🔭 Advanced Statistical Analysis</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['Column','Sum','Variance','Skewness','Shape','Kurtosis','Type','Mode','CV%','P5','P95','IQR','Neg#','Pos#'].map(h => (
                      <th key={h} style={{ padding: '8px 11px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(advStats as unknown as {col:string;sum:number;variance:number;skew:number;skewLabel:string;kurt:number;kurtLabel:string;mode:number;cv:number;p5:number;p95:number;iqr:number;neg:number;pos:number}[]).map((s, i) => (
                    <tr key={s.col} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '7px 11px', color: meta.p, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.col}</td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.sum)}</td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.variance))}</td>
                      <td style={{ padding: '7px 11px', color: Math.abs(s.skew) > 1 ? '#f59e0b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{s.skew.toFixed(2)}</td>
                      <td style={{ padding: '7px 11px' }}><span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', whiteSpace: 'nowrap' }}>{s.skewLabel}</span></td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{s.kurt.toFixed(2)}</td>
                      <td style={{ padding: '7px 11px' }}><span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', whiteSpace: 'nowrap' }}>{s.kurtLabel}</span></td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.mode)}</td>
                      <td style={{ padding: '7px 11px', color: s.cv > 100 ? '#f59e0b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{s.cv.toFixed(1)}%</td>
                      <td style={{ padding: '7px 11px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.p5))}</td>
                      <td style={{ padding: '7px 11px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.p95))}</td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.iqr))}</td>
                      <td style={{ padding: '7px 11px', color: s.neg > 0 ? '#ef4444' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>{s.neg}</td>
                      <td style={{ padding: '7px 11px', color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{s.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Dataset Summary Cards (10 mini details) ── */}
        <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>🗂️ Dataset Overview — Full Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { label: 'Total Cells', val: fmt(summaryStats.totalCells), icon: '📦', color: meta.p },
              { label: 'Filled Cells', val: fmt(summaryStats.totalCells - summaryStats.emptyCells), icon: '✅', color: '#10b981' },
              { label: 'Empty Cells', val: fmt(summaryStats.emptyCells), icon: '⬜', color: '#ef4444' },
              { label: 'Data Density', val: summaryStats.density + '%', icon: '💧', color: meta.s },
              { label: 'Unique Rows', val: fmt(summaryStats.uniqRows), icon: '🔑', color: '#6366f1' },
              { label: 'Duplicate Rows', val: fmt(summaryStats.dupRows), icon: '📋', color: summaryStats.dupRows > 0 ? '#f59e0b' : '#10b981' },
              { label: 'Numeric Cols', val: summaryStats.numColsCount.toString(), icon: '#️⃣', color: '#3b82f6' },
              { label: 'Text Cols', val: summaryStats.catColsCount.toString(), icon: '🔤', color: '#8b5cf6' },
              { label: 'Date Cols', val: summaryStats.dateColsCount.toString(), icon: '📅', color: '#f59e0b' },
              { label: 'Col/Row Ratio', val: summaryStats.colRowRatio, icon: '⚖️', color: '#06b6d4' },
            ].map(item => (
              <div key={item.label} style={{ background: `${item.color}0e`, border: `1px solid ${item.color}22`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{item.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Column Profiling Table ── */}
        <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🔬 Column Profiling — Detailed Field Analysis</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Column', 'Type', 'Fill Rate', 'Fill Bar', 'Unique #', 'Unique %', 'Top Value', 'Top Freq', 'Zeros'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columnProfile.map((col, i) => (
                  <tr key={col.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '8px 12px', color: meta.p, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.type === 'numeric' ? 'rgba(59,130,246,0.12)' : col.type === 'date' ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)', color: col.type === 'numeric' ? '#3b82f6' : col.type === 'date' ? '#8b5cf6' : '#10b981' }}>
                        {col.type === 'numeric' ? '#' : col.type === 'date' ? '📅' : 'A'} {col.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: col.fillRate < 80 ? '#ef4444' : col.fillRate < 95 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>{col.fillRate}%</td>
                    <td style={{ padding: '8px 12px', minWidth: 80 }}>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${col.fillRate}%`, background: col.fillRate < 80 ? '#ef4444' : col.fillRate < 95 ? '#f59e0b' : '#10b981' }} />
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{col.uniqCount.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{col.uniqRate}%</td>
                    <td style={{ padding: '8px 12px', color: '#e2e8f0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.topVal}>{col.topVal}</td>
                    <td style={{ padding: '8px 12px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{col.topCount.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: col.zeros > 0 ? '#f59e0b' : '#10b981' }}>{col.type === 'numeric' ? col.zeros : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Descriptive Statistics Table ── */}

        {statsData.length > 0 && (
          <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>📐 Descriptive Statistics</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['Column','Min','Max','Mean','Median','Std Dev','Outliers'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statsData.map((s, i) => (
                    <tr key={s.col} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '9px 14px', color: meta.p, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.col}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.min)}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.max)}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.mean))}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.median))}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.std))}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: s.outliers > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)', color: s.outliers > 0 ? '#f59e0b' : '#10b981' }}>
                          {s.outliers > 0 ? `⚠️ ${s.outliers}` : '✅ 0'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Missing Data Alert ── */}
        {missingCols.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>🔍 Missing Data by Column</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {missingCols.map(mc => (
                <div key={mc.col} style={{ flex: '1 1 180px', minWidth: 160 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{mc.col}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: mc.pct > 30 ? '#ef4444' : '#f59e0b' }}>{mc.pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${mc.pct}%`, background: mc.pct > 30 ? '#ef4444' : '#f59e0b', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Data Preview Table ── */}
        <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>📋 Data Preview — Top 8 Rows</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{info.rows.toLocaleString()} total rows</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {(info.columns ?? []).slice(0, 8).map(c => (
                    <th key={c.name} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: String(c.type) === 'numeric' ? meta.p : String(c.type) === 'date' ? '#8b5cf6' : '#94a3b8' }}>
                        {String(c.type) === 'numeric' ? '# ' : String(c.type) === 'date' ? '📅 ' : 'A '}
                      </span>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 8).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    {(info.columns ?? []).slice(0, 8).map(c => (
                      <td key={c.name} style={{ padding: '9px 14px', color: String(c.type) === 'numeric' ? meta.p : '#e2e8f0', fontWeight: String(c.type) === 'numeric' ? 600 : 400, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(row[c.name] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sd2-footer-bar" />
      </div>
    </div>
  );
};
