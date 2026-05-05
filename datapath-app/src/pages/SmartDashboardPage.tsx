import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useKimitData } from '../hooks/useKimitData';
import { exportToExcel } from '../lib/exportUtils';
import { ArrowLeft, Download, RefreshCw, LayoutDashboard } from 'lucide-react';

interface Props { onBack: () => void; }

// ── Category Detection ──────────────────────────────────────────
type Cat = 'sales' | 'finance' | 'sports' | 'hr' | 'health' | 'iot' | 'general';

function detectCat(cols: string[]): Cat {
  const s = cols.join(' ').toLowerCase();
  if (/revenue|sales|profit|order|customer|product|price|discount|quantity/.test(s)) return 'sales';
  if (/stock|dividend|asset|market|close|open|volume|fund|portfolio/.test(s))        return 'finance';
  if (/player|team|score|goal|match|win|loss|game|season|point/.test(s))             return 'sports';
  if (/employee|salary|department|hire|position|staff|bonus/.test(s))                return 'hr';
  if (/patient|diagnosis|treatment|blood|health|hospital|drug/.test(s))              return 'health';
  if (/sensor|device|temperature|humidity|pressure|voltage|iot/.test(s))             return 'iot';
  return 'general';
}

const CAT: Record<Cat, { label: string; icon: string; p: string; s: string; bg: string }> = {
  sales:   { label: 'Sales & Commerce',  icon: '🛒', p: '#10b981', s: '#34d399', bg: 'rgba(16,185,129,0.06)' },
  finance: { label: 'Finance & Markets', icon: '💹', p: '#f59e0b', s: '#fbbf24', bg: 'rgba(245,158,11,0.06)' },
  sports:  { label: 'Sports Analytics',  icon: '⚽', p: '#3b82f6', s: '#60a5fa', bg: 'rgba(59,130,246,0.06)'  },
  hr:      { label: 'Human Resources',   icon: '👥', p: '#8b5cf6', s: '#a78bfa', bg: 'rgba(139,92,246,0.06)' },
  health:  { label: 'Health & Medical',  icon: '🏥', p: '#06b6d4', s: '#22d3ee', bg: 'rgba(6,182,212,0.06)'  },
  iot:     { label: 'IoT & Devices',     icon: '📡', p: '#f43f5e', s: '#fb7185', bg: 'rgba(244,63,94,0.06)'  },
  general: { label: 'Data Analytics',    icon: '📊', p: '#6366f1', s: '#818cf8', bg: 'rgba(99,102,241,0.06)' },
};

// ── Helpers ─────────────────────────────────────────────────────
function groupBySum(data: Record<string, unknown>[], cat: string, num: string, n = 10) {
  const m = new Map<string, number>();
  data.forEach(r => { const k = String(r[cat] ?? 'N/A'); m.set(k, (m.get(k) ?? 0) + (Number(r[num]) || 0)); });
  return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, n);
}
function groupByCount(data: Record<string, unknown>[], cat: string, n = 8) {
  const m = new Map<string, number>();
  data.forEach(r => { const k = String(r[cat] ?? 'N/A'); m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].map(([l, v]) => ({ l, v })).sort((a, b) => b.v - a.v).slice(0, n);
}
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}
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
function scatterOpt(pts: [number,number][], xL: string, yL: string, color: string) {
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'item', backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 11 }, formatter: (p: { data: number[] }) => `${xL}: ${fmt(p.data[0])}<br/>${yL}: ${fmt(p.data[1])}` },
    grid: { left: 55, right: 16, top: 16, bottom: 36 },
    xAxis: { type: 'value', name: xL, nameTextStyle: { color: '#64748b', fontSize: 10 }, nameLocation: 'end', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
    yAxis: { type: 'value', name: yL, nameTextStyle: { color: '#64748b', fontSize: 10 }, nameLocation: 'end', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
    series: [{ type: 'scatter', data: pts, symbolSize: 7, itemStyle: { color, opacity: 0.65, borderColor: color + '99', borderWidth: 1 } }],
  };
}

// ── Sparkline SVG ───────────────────────────────────────────────
const Sparkline: React.FC<{ vals: number[]; color: string }> = ({ vals, color }) => {
  if (vals.length < 2) return null;
  const max = Math.max(...vals); const min = Math.min(...vals); const range = max - min || 1;
  const W = 72; const H = 28;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', opacity: 0.85 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── EChart Options ──────────────────────────────────────────────
function lineOpt(labels: string[], values: number[], color: string) {
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', borderColor: color + '55', textStyle: { color: '#f8fafc', fontSize: 12 } },
    grid: { left: 55, right: 16, top: 16, bottom: 36 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#64748b', fontSize: 10, interval: Math.floor(labels.length / 8) }, axisLine: { lineStyle: { color: '#1e293b' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
    series: [{ type: 'line', data: values, smooth: true, symbol: 'none', lineStyle: { color, width: 3 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '44' }, { offset: 1, color: color + '00' }] } } }],
  };
}
function barOpt(labels: string[], values: number[], color: string) {
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', borderColor: color + '55', textStyle: { color: '#f8fafc', fontSize: 12 } },
    grid: { left: 110, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
    yAxis: { type: 'category', data: labels, axisLabel: { color: '#e2e8f0', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', data: values, barMaxWidth: 20, itemStyle: { color, borderRadius: [0, 6, 6, 0] } }],
  };
}
function donutOpt(items: { l: string; v: number }[], colors: string[]) {
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'item', backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 12 }, formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 4, top: 'center', textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
    series: [{ type: 'pie', radius: ['45%', '72%'], center: ['38%', '50%'], data: items.map((it, i) => ({ name: it.l, value: it.v, itemStyle: { color: colors[i % colors.length] } })), label: { show: false }, emphasis: { scale: true, scaleSize: 6 } }],
  };
}
function histOpt(vals: number[], label: string, color: string) {
  if (vals.length === 0) return null;
  const min = Math.min(...vals); const max = Math.max(...vals);
  const bins = Math.min(20, Math.ceil(Math.sqrt(vals.length)));
  const binSize = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);
  vals.forEach(v => { const i = Math.min(Math.floor((v - min) / binSize), bins - 1); counts[i]++; });
  const labels = counts.map((_, i) => fmt(min + i * binSize));
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 12 }, formatter: (p: {name: string; value: number}[]) => `${label}: ${p[0].name}<br/>Count: <b>${p[0].value}</b>` },
    grid: { left: 40, right: 10, top: 10, bottom: 38 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#64748b', fontSize: 9, rotate: 30, interval: Math.floor(bins / 6) }, axisLine: { lineStyle: { color: '#1e293b' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
    series: [{ type: 'bar', data: counts, barCategoryGap: '8%', itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: color + '44' }] }, borderRadius: [4, 4, 0, 0] } }],
  };
}
function multiBarOpt(labels: string[], series: { name: string; data: number[]; color: string }[]) {
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 11 } },
    legend: { top: 4, right: 8, textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
    grid: { left: 45, right: 16, top: 36, bottom: 40 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 10, rotate: labels.some(l => l.length > 6) ? 30 : 0 }, axisLine: { lineStyle: { color: '#1e293b' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
    series: series.map(s => ({ type: 'bar', name: s.name, data: s.data, barMaxWidth: 22, itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] } })),
  };
}
function radarOpt(indicators: { name: string; max: number }[], series: { name: string; value: number[] }[], palette: string[]) {
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 11 } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
    radar: {
      indicator: indicators,
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.01)', 'transparent', 'rgba(255,255,255,0.01)', 'transparent', 'rgba(255,255,255,0.01)'] } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisName: { color: '#94a3b8', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{ type: 'radar', data: series.map((s, i) => ({ name: s.name, value: s.value, lineStyle: { color: palette[i % palette.length], width: 2 }, itemStyle: { color: palette[i % palette.length] }, areaStyle: { color: palette[i % palette.length] + '22' } })) }],
  };
}


function boxOpt(series: { name: string; vals: number[] }[], color: string) {
  const boxData = series.map(s => {
    const v = [...s.vals].sort((a, b) => a - b); const n = v.length;
    if (!n) return [0, 0, 0, 0, 0];
    return [v[0], v[Math.floor(n * 0.25)], n % 2 === 0 ? (v[n/2-1]+v[n/2])/2 : v[Math.floor(n/2)], v[Math.floor(n * 0.75)], v[n - 1]];
  });
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'item', backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 11 }, formatter: (p: { name: string; data: number[] }) => `${p.name}<br/>Min: ${fmt(p.data[1])}<br/>Q1: ${fmt(p.data[2])}<br/>Median: ${fmt(p.data[3])}<br/>Q3: ${fmt(p.data[4])}<br/>Max: ${fmt(p.data[5])}` },
    grid: { left: 90, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
    yAxis: { type: 'category', data: series.map(s => s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name), axisLabel: { color: '#e2e8f0', fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'boxplot', data: boxData, itemStyle: { color: color + '33', borderColor: color, borderWidth: 2 }, emphasis: { itemStyle: { borderWidth: 3 } } }],
  };
}
function paretoOpt(labels: string[], vals: number[], color: string) {
  const total = vals.reduce((a, b) => a + b, 0); let cum = 0;
  const cumPcts = vals.map(v => { cum += (v / total) * 100; return Math.round(cum * 10) / 10; });
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 11 } },
    legend: { data: ['Value', 'Cumulative %'], top: 2, right: 8, textStyle: { color: '#94a3b8', fontSize: 10 }, itemWidth: 10, itemHeight: 8 },
    grid: { left: 45, right: 50, top: 30, bottom: 42 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 30 }, axisLine: { lineStyle: { color: '#1e293b' } }, axisTick: { show: false } },
    yAxis: [
      { type: 'value', axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLine: { show: false } },
      { type: 'value', max: 100, axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => v + '%' }, splitLine: { show: false }, axisLine: { show: false } },
    ],
    series: [
      { name: 'Value', type: 'bar', data: vals, barMaxWidth: 30, itemStyle: { color, borderRadius: [4, 4, 0, 0] } },
      { name: 'Cumulative %', type: 'line', yAxisIndex: 1, data: cumPcts, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#f59e0b', width: 2 }, itemStyle: { color: '#f59e0b' }, markLine: { silent: true, data: [{ yAxis: 80, lineStyle: { color: '#ef444466', type: 'dashed' }, label: { color: '#ef4444', fontSize: 10, formatter: '80%' } }] } },
    ],
  };
}
function heatmapOpt(cols: string[], matrix: number[][]) {
  const data: [number, number, number][] = [];
  matrix.forEach((row, i) => row.forEach((v, j) => data.push([j, i, Math.round(v * 100) / 100])));
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { position: 'top', backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 11 }, formatter: (p: { data: number[] }) => `${cols[p.data[1]]} × ${cols[p.data[0]]}<br/>r = <b>${p.data[2]}</b>` },
    grid: { left: 80, right: 10, top: 10, bottom: 80 },
    xAxis: { type: 'category', data: cols, axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 30 }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'category', data: cols, axisLabel: { color: '#94a3b8', fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: { min: -1, max: 1, calculable: false, orient: 'horizontal', bottom: 0, left: 'center', textStyle: { color: '#94a3b8', fontSize: 9 }, inRange: { color: ['#ef4444', '#1e293b', '#10b981'] } },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 9, color: '#f8fafc' } }],
  };
}
function treemapOpt(data: { name: string; value: number }[], color: string) {
  return {
    backgroundColor: 'transparent', animation: true,
    tooltip: { backgroundColor: '#0f172a', textStyle: { color: '#f8fafc', fontSize: 11 }, formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/>${fmt(p.value)} (${p.percent?.toFixed(1) ?? '0'}%)` },
    series: [{ type: 'treemap', data, roam: false, label: { show: true, fontSize: 11, color: '#fff', fontWeight: 600 }, breadcrumb: { show: false }, itemStyle: { borderColor: '#0f172a', borderWidth: 2, gapWidth: 3 }, levels: [{ itemStyle: { borderColor: color, borderWidth: 3, gapWidth: 4 }, colorSaturation: [0.5, 0.9] }] }],
  };
}

// ── KPI Card ─────────────────────────────────────────────────────
const KpiCard: React.FC<{ title: string; value: string; sub: string; color: string; sparkVals: number[]; icon: string }> = ({ title, value, sub, color, sparkVals, icon }) => (
  <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: `1px solid ${color}22`, borderTop: `3px solid ${color}`, borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
    </div>
    <div style={{ marginTop: 4 }}><Sparkline vals={sparkVals} color={color} /></div>
  </div>
);

// ── Main Page ────────────────────────────────────────────────────
export const SmartDashboardPage: React.FC<Props> = ({ onBack }) => {
  const { info } = useKimitData();
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useMemo(() => info?.workData ?? [], [info]);
  const numCols = useMemo(() => (info?.columns ?? []).filter(c => String(c.type) === 'numeric').map(c => c.name), [info]);
  const catCols = useMemo(() => (info?.columns ?? []).filter(c => String(c.type) !== 'numeric').map(c => c.name), [info]);
  const cat     = useMemo(() => detectCat((info?.columns ?? []).map(c => c.name)), [info]);
  const meta    = CAT[cat];

  // Palette based on category
  const palette = useMemo(() => {
    const base = meta.p;
    return [base, meta.s, '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e'];
  }, [meta]);

  // KPI values
  const kpis = useMemo(() => {
    const result = [];
    const n = numCols[0];
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
  }, [data, numCols, catCols, meta]);

  // Trend (line) chart — use first numeric col sequentially
  const trendOpts = useMemo(() => {
    if (!numCols[0]) return null;
    const col = numCols[0];
    const step = Math.max(1, Math.floor(data.length / 60));
    const sliced = data.filter((_, i) => i % step === 0).slice(0, 60);
    const labels = sliced.map((_, i) => String(i + 1));
    const values = sliced.map(r => Number(r[col]) || 0);
    return lineOpt(labels, values, meta.p);
  }, [data, numCols, meta]);

  // Bar chart — top categories by first numeric
  const barOpts = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 10).reverse();
    return barOpt(rows.map(r => r.l.length > 16 ? r.l.slice(0, 14) + '…' : r.l), rows.map(r => r.v), meta.s);
  }, [data, catCols, numCols, meta]);

  // Donut chart — category distribution
  const donutOpts = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 7);
    return donutOpt(rows, palette);
  }, [data, catCols, palette]);

  // Descriptive statistics per numeric column
  const statsData = useMemo(() =>
    numCols.slice(0, 6).map(col => {
      const vals = data.map(r => Number(r[col]));
      const st = calcStats(vals);
      return st ? { col, ...st } : null;
    }).filter(Boolean) as ({ col: string; mean: number; median: number; std: number; min: number; max: number; q1: number; q3: number; outliers: number; n: number })[],
  [data, numCols]);

  // Auto-generated decision insights
  const insights = useMemo(() => {
    const result: { icon: string; title: string; desc: string; color: string }[] = [];
    if (catCols[0] && numCols[0]) {
      const top = groupBySum(data, catCols[0], numCols[0], 1)[0];
      if (top) result.push({ icon: '🏆', title: 'Top Performer', desc: `"${top.l.slice(0,20)}" leads with ${fmt(top.v)} in ${numCols[0]}`, color: '#10b981' });
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
    return result.slice(0, 4);
  }, [data, numCols, catCols, statsData]);

  // Top 5 & Bottom 5 by primary metric
  const topBottom = useMemo(() => {
    if (!numCols[0]) return { top: [], bottom: [] };
    const sorted = [...data].sort((a, b) => (Number(b[numCols[0]]) || 0) - (Number(a[numCols[0]]) || 0));
    return { top: sorted.slice(0, 5), bottom: [...sorted.slice(-5)].reverse() };
  }, [data, numCols]);

  // Scatter plot (if 2+ numeric columns exist)
  const scatterChart = useMemo(() => {
    if (numCols.length < 2) return null;
    const pts: [number, number][] = data.slice(0, 300).map(r => [Number(r[numCols[0]]) || 0, Number(r[numCols[1]]) || 0]);
    return scatterOpt(pts, numCols[0], numCols[1], meta.p);
  }, [data, numCols, meta]);

  // Missing data per column
  const missingCols = useMemo(() =>
    (info?.columns ?? []).map(c => ({
      col: c.name,
      pct: Math.round((data.filter(r => r[c.name] === null || r[c.name] === undefined || r[c.name] === '').length / (data.length || 1)) * 100),
    })).filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 8),
  [data, info]);

  // Histogram of first numeric column
  const histChart = useMemo(() => {
    if (!numCols[0]) return null;
    const vals = data.map(r => Number(r[numCols[0]])).filter(v => !isNaN(v));
    return histOpt(vals, numCols[0], meta.s);
  }, [data, numCols, meta]);

  // Multi-metric grouped bar (avg per category)
  const multiBarChart = useMemo(() => {
    if (numCols.length < 2 || !catCols[0]) return null;
    const topCats = groupByCount(data, catCols[0], 7).map(g => g.l);
    if (topCats.length < 2) return null;
    const colors = [meta.p, meta.s, '#f59e0b', '#8b5cf6'];
    const series = numCols.slice(0, 3).map((col, i) => ({
      name: col.length > 14 ? col.slice(0, 13) + '…' : col,
      color: colors[i % colors.length],
      data: topCats.map(cat => {
        const rows = data.filter(r => String(r[catCols[0]]) === cat);
        return Math.round(rows.reduce((s, r) => s + (Number(r[col]) || 0), 0) / (rows.length || 1));
      }),
    }));
    return multiBarOpt(topCats.map(l => l.length > 10 ? l.slice(0, 9) + '…' : l), series);
  }, [data, numCols, catCols, meta]);

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
    return radarOpt(indicators, series, palette);
  }, [data, numCols, catCols, palette]);



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

  // Box Plot per numeric column
  const boxChart = useMemo(() => {
    if (!numCols.length) return null;
    const series = numCols.slice(0, 8).map(col => ({ name: col, vals: data.map(r => Number(r[col])).filter(v => !isNaN(v)) }));
    return boxOpt(series, meta.p);
  }, [data, numCols, meta]);

  // Pareto chart (80/20 rule)
  const paretoChart = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 15);
    return paretoOpt(rows.map(r => r.l.length > 10 ? r.l.slice(0, 9) + '…' : r.l), rows.map(r => r.v), meta.p);
  }, [data, catCols, numCols, meta]);

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
    return heatmapOpt(cols.map(c => c.length > 8 ? c.slice(0, 7) + '…' : c), matrix);
  }, [data, numCols]);

  // Treemap
  const treemapChart = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 25);
    return treemapOpt(rows.map(r => ({ name: r.l.length > 20 ? r.l.slice(0, 19) + '…' : r.l, value: Math.max(1, Math.round(r.v)) })), meta.p);
  }, [data, catCols, numCols, meta]);

  if (!info || data.length === 0) {

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <LayoutDashboard size={48} color="#334155" />
        <p style={{ color: '#64748b', fontSize: 14 }}>ارفع ملف بيانات أولاً للعرض هنا</p>
        <button onClick={onBack} style={{ padding: '10px 20px', background: '#10b981', color: '#000', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>← رجوع</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070c18', padding: '0 0 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${meta.p}22`, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{meta.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>Smart Dashboard</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{info.filename} • {info.rows.toLocaleString()} records</div>
            </div>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${meta.p}22`, color: meta.p, border: `1px solid ${meta.p}44` }}>
            {meta.icon} {meta.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => exportToExcel(info.workData, `Dashboard_${info.filename}.xlsx`)} style={{ background: meta.p, border: 'none', color: '#000', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 28px 0' }}>

        {/* ── KPI Strip ── */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
        </div>

        {/* ── Auto Insights Row ── */}
        {insights.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: `1px solid ${ins.color}22`, borderLeft: `4px solid ${ins.color}`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{ins.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ins.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{ins.title}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{ins.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Charts Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: trendOpts ? '1fr 420px' : '1fr', gap: 20, marginBottom: 20 }}>

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Trend / Line Chart */}
            {trendOpts && (
              <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
                  📈 {numCols[0]} — Trend Overview
                </div>
                <ReactECharts key={refreshKey} option={trendOpts} style={{ height: 260 }} theme="dark" />
              </div>
            )}

            {/* Horizontal Bar Chart */}
            {barOpts && catCols[0] && (
              <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
                  🏅 Top {catCols[0]} by {numCols[0] ?? 'Count'}
                </div>
                <ReactECharts key={refreshKey} option={barOpts} style={{ height: 280 }} theme="dark" />
              </div>
            )}
          </div>

          {/* Right Column — Donut */}
          {donutOpts && catCols[0] && (
            <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                🍩 {catCols[0]} — Distribution
              </div>
              <ReactECharts key={refreshKey} option={donutOpts} style={{ flex: 1, minHeight: 320 }} theme="dark" />
              {/* Category count badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {groupByCount(data, catCols[0], 5).map((it, i) => (
                  <span key={it.l} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: `${palette[i % palette.length]}22`, color: palette[i % palette.length], border: `1px solid ${palette[i % palette.length]}44` }}>
                    {it.l.length > 12 ? it.l.slice(0, 11) + '…' : it.l} ({it.v})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Histogram + Multi-Metric Bar ── */}
        {(histChart || multiBarChart) && (
          <div style={{ display: 'grid', gridTemplateColumns: histChart && multiBarChart ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
            {histChart && numCols[0] && (
              <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>📊 Distribution — {numCols[0]}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Frequency of values across all records</div>
                <ReactECharts key={refreshKey} option={histChart} style={{ height: 220 }} theme="dark" />
              </div>
            )}
            {multiBarChart && catCols[0] && (
              <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>📈 Multi-Metric Comparison — by {catCols[0]}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Average value per category across metrics</div>
                <ReactECharts key={refreshKey} option={multiBarChart} style={{ height: 220 }} theme="dark" />
              </div>
            )}
          </div>
        )}

        {/* ── Radar Chart (Multi-Dimensional Performance) ── */}
        {radarChart && (
          <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>🕸️ Multi-Dimensional Comparison — Top Performers</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Compare top {catCols[0]} across all numeric metrics simultaneously</div>
            <ReactECharts key={refreshKey} option={radarChart} style={{ height: 320 }} theme="dark" />
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

        {/* ── Box Plot — IQR Visualization ── */}
        {boxChart && (
          <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>📦 Box Plot — Interquartile Range Analysis</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Shows Min, Q1, Median, Q3, Max for each numeric column — hover for details</div>
            <ReactECharts key={refreshKey} option={boxChart} style={{ height: Math.min(40 * numCols.slice(0, 8).length + 60, 380) }} theme="dark" />
          </div>
        )}

        {/* ── Pareto Chart (80/20 Rule) ── */}
        {paretoChart && (
          <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>📐 Pareto Analysis — 80/20 Rule</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Identify which {catCols[0]} categories drive 80% of total {numCols[0]} — dashed line marks the 80% threshold</div>
            <ReactECharts key={refreshKey} option={paretoChart} style={{ height: 260 }} theme="dark" />
          </div>
        )}

        {/* ── Treemap + Correlation ── */}
        {(treemapChart || correlationChart) && (
          <div style={{ display: 'grid', gridTemplateColumns: treemapChart && correlationChart ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
            {treemapChart && (
              <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>🗺️ Treemap — {catCols[0]} by {numCols[0]}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Size = value. Larger blocks = bigger share of total</div>
                <ReactECharts key={refreshKey} option={treemapChart} style={{ height: 300 }} theme="dark" />
              </div>
            )}
            {correlationChart && (
              <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>🌡️ Correlation Matrix Heatmap</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Green = strong +ve, Red = strong -ve, Dark = no correlation</div>
                <ReactECharts key={refreshKey} option={correlationChart} style={{ height: 300 }} theme="dark" />
              </div>
            )}
          </div>
        )}

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

        {/* ── Top & Bottom 5 + Scatter ── */}
        <div style={{ display: 'grid', gridTemplateColumns: scatterChart ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
          {numCols[0] && (
            <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>🏆 Top 5</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>📉 Bottom 5</span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>by {numCols[0]}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {(['top', 'bottom'] as const).map(side => (
                  <div key={side} style={{ borderRight: side === 'top' ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
                    {topBottom[side].map((row, i) => (
                      <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {catCols[0] ? String(row[catCols[0]] ?? '—').slice(0, 18) : `Row ${i + 1}`}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: side === 'top' ? '#10b981' : '#ef4444', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(Number(row[numCols[0]]) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {scatterChart && (
            <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>🔗 Correlation — {numCols[0]} vs {numCols[1]}</div>
              <ReactECharts key={refreshKey} option={scatterChart} style={{ height: 220 }} theme="dark" />
            </div>
          )}
        </div>

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

        {/* ── Footer Gradient Bar ── */}
        <div style={{ marginTop: 24, height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${meta.p}, ${meta.s}, transparent)` }} />
      </div>

      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
      `}</style>
    </div>
  );
};
