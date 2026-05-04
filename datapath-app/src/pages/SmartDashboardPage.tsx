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
  }, [data, numCols, meta, refreshKey]);

  // Bar chart — top categories by first numeric
  const barOpts = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 10).reverse();
    return barOpt(rows.map(r => r.l.length > 16 ? r.l.slice(0, 14) + '…' : r.l), rows.map(r => r.v), meta.s);
  }, [data, catCols, numCols, meta, refreshKey]);

  // Donut chart — category distribution
  const donutOpts = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 7);
    return donutOpt(rows, palette);
  }, [data, catCols, palette, refreshKey]);

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
                <ReactECharts option={trendOpts} style={{ height: 260 }} theme="dark" />
              </div>
            )}

            {/* Horizontal Bar Chart */}
            {barOpts && catCols[0] && (
              <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
                  🏅 Top {catCols[0]} by {numCols[0] ?? 'Count'}
                </div>
                <ReactECharts option={barOpts} style={{ height: 280 }} theme="dark" />
              </div>
            )}
          </div>

          {/* Right Column — Donut */}
          {donutOpts && catCols[0] && (
            <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 20px 14px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                🍩 {catCols[0]} — Distribution
              </div>
              <ReactECharts option={donutOpts} style={{ flex: 1, minHeight: 320 }} theme="dark" />
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
