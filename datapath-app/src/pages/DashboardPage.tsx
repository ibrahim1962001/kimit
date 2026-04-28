import React, { useState } from 'react';
import { useKimitData } from '../hooks/useKimitData';
import { useKimitEngine } from '../hooks/useKimitEngine';
import { DataChart } from '../components/DataChart';
import {
  Plus, Trash2, FileText, Loader2, Sparkles, Database,
  Activity, AlertTriangle, TrendingUp, TrendingDown,
  Minus, GitBranch, Wand2,
} from 'lucide-react';
import type { Lang, ChartInfo } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { DataGrid } from '../components/Analysis/DataGrid';
import { TransformationTimeline } from '../components/Analysis/TransformationTimeline';
import { CorrelationHeatmap } from '../components/Analysis/CorrelationHeatmap';
import { InsightSummary } from '../components/Analysis/InsightSummary';
import { PowerBIPanel } from '../components/Analysis/PowerBIPanel';
import { CreatorFooter } from '../components/CreatorFooter';
import { exportBrandedPDF, exportToExcel } from '../lib/exportUtils';
import { generateAInarrative } from '../lib/narrativeEngine';

interface Props { lang: Lang; }

const T = {
  ar: {
    title: 'منصة التحليل المتقدمة',
    healthTitle: 'مؤشر صحة البيانات',
    insights: 'رؤى الذكاء الاصطناعي',
    builder: 'صانع المخططات',
    records: 'سجل',
    columns: 'عمود',
    outliers: 'كشف القيم الشاذة',
    correlation: 'مصفوفة الارتباط',
    growth: 'مؤشرات النمو',
  },
  en: {
    title: 'Advanced Analyst Suite',
    healthTitle: 'Data Health Score',
    insights: 'AI Narrative Insights',
    builder: 'Custom Chart Builder',
    records: 'Records',
    columns: 'Columns',
    outliers: 'Anomaly Detection',
    correlation: 'Correlation Matrix',
    growth: 'Growth Indicators',
  },
};

// ── Growth Badge Component ──────────────────────────────────────
const GrowthBadge: React.FC<{ pct: number; trend: 'up' | 'down' | 'flat' }> = ({ pct, trend }) => {
  if (trend === 'flat') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10,
      color: '#64748b', background: 'rgba(100,116,139,0.1)', borderRadius: 6, padding: '2px 6px' }}>
      <Minus size={9} /> Flat
    </span>
  );
  const isUp = trend === 'up';
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700,
        color: isUp ? '#10b981' : '#ef4444',
        background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isUp ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
        borderRadius: 6, padding: '2px 7px' }}
    >
      {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {isUp ? '+' : ''}{pct.toFixed(1)}%
    </motion.span>
  );
};

export const DashboardPage: React.FC<Props> = ({ lang }) => {
  const { info, rollback } = useKimitData();
  const {
    removeDuplicates, fillMissingValues, getHealthStats,
    outlierMap, allOutlierRowIndices, correlationMatrix, growthIndicators,
  } = useKimitEngine();

  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [customCharts, setCustomCharts] = useState<ChartInfo[]>([]);
  const [builder, setBuilder] = useState<{ x: string; y: string; type: ChartInfo['type'] }>({ x: '', y: '', type: 'bar' });
  const [activeChartFilter, setActiveChartFilter] = useState('');
  const [showOutliers, setShowOutliers] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'correlation'>('grid');

  const health = getHealthStats();
  const t = T[lang];
  const insights = info ? generateAInarrative(info) : [];

  // Magic Clean: remove duplicates + fill nulls in one click
  const handleMagicClean = async () => {
    setCleaning(true);
    await new Promise(r => setTimeout(r, 300)); // brief animation delay
    removeDuplicates();
    fillMissingValues();
    setCleaning(false);
  };

  if (!info) return <div className="p-20 text-center">No Data found. Please upload a file.</div>;

  const handleAddCustomChart = () => {
    if (!builder.x || !builder.y) return;
    const agg: Record<string, number> = {};
    info.workData.forEach(r => {
      const key = String(r[builder.x]);
      agg[key] = (agg[key] || 0) + (Number(r[builder.y]) || 0);
    });
    setCustomCharts([{
      title: `${builder.y} vs ${builder.x}`,
      type: builder.type,
      data: Object.entries(agg).map(([x, y]) => ({ x, y })),
    }, ...customCharts]);
  };

  const handleFullPDF = async () => {
    setExporting(true);
    await exportBrandedPDF('dashboard-main-content', `Kimit_Report_${info.filename}.pdf`);
    setExporting(false);
  };

  // Growth: pick first 3 numeric columns for KPI display
  const kpiGrowth = growthIndicators.slice(0, 3);

  return (
    <div className="dash-layout-container">

      {/* ── Header ── */}
      <div className="dash-header-wrap">
        <div className="title-group">
          <motion.h2 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Sparkles className="text-primary" /> {t.title}
          </motion.h2>
          <p className="page-sub">{info.filename} • {info.rows.toLocaleString()} {t.records}</p>
        </div>
        <div className="actions-group" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* ✨ Magic Clean */}
          <motion.button
            className="premium-button"
            onClick={handleMagicClean}
            disabled={cleaning}
            whileTap={{ scale: 0.96 }}
            style={{ background: 'linear-gradient(135deg, #d4af37, #a3820a)', color: '#000' }}
          >
            {cleaning ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
            Magic Clean
          </motion.button>
          <button className="premium-button secondary" onClick={() => exportToExcel(info.workData, `Kimit_Data_${info.filename}.xlsx`)}>
            <Database size={16} /> Excel
          </button>
          <button className="premium-button" onClick={handleFullPDF} disabled={exporting}>
            {exporting ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
            {lang === 'ar' ? 'تصدير PDF' : 'Branded PDF'}
          </button>
        </div>
      </div>

      <TransformationTimeline />

      {/* ── KPI Row with Growth Indicators ── */}
      <div className="kpi-mini-row">
        {/* Records */}
        <motion.div className="glass-card kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <div className="kpi-label">{t.records}</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>{info.rows.toLocaleString()}</div>
          {kpiGrowth[0] && <GrowthBadge pct={kpiGrowth[0].pctChange} trend={kpiGrowth[0].trend} />}
          {kpiGrowth[0] && <div className="kpi-sub">{kpiGrowth[0].column}</div>}
        </motion.div>

        {/* Columns */}
        <motion.div className="glass-card kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="kpi-label">{t.columns}</div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>{info.columns.length}</div>
          {kpiGrowth[1] && <GrowthBadge pct={kpiGrowth[1].pctChange} trend={kpiGrowth[1].trend} />}
          {kpiGrowth[1] && <div className="kpi-sub">{kpiGrowth[1].column}</div>}
        </motion.div>

        {/* Health */}
        <motion.div className="glass-card kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="kpi-label">{health.label}</div>
          <div className="kpi-value" style={{ color: health.color }}>{health.score}%</div>
          {kpiGrowth[2] && <GrowthBadge pct={kpiGrowth[2].pctChange} trend={kpiGrowth[2].trend} />}
          {kpiGrowth[2] && <div className="kpi-sub">{kpiGrowth[2].column}</div>}
        </motion.div>

        {/* Outlier toggle card */}
        <motion.div
          className="glass-card kpi-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          onClick={() => setShowOutliers(v => !v)}
          style={{ cursor: 'pointer', borderColor: showOutliers ? 'rgba(239,68,68,0.4)' : undefined,
            background: showOutliers ? 'rgba(239,68,68,0.06)' : undefined }}
        >
          <div className="kpi-label" style={{ color: showOutliers ? '#ef4444' : undefined }}>{t.outliers}</div>
          <div className="kpi-value" style={{ color: showOutliers ? '#ef4444' : '#64748b', fontSize: 22 }}>
            {allOutlierRowIndices.size}
          </div>
          <span style={{ fontSize: 10, color: showOutliers ? '#ef4444' : '#475569',
            background: showOutliers ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${showOutliers ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 6, padding: '2px 7px' }}>
            <AlertTriangle size={9} style={{ display: 'inline', marginRight: 3 }} />
            {showOutliers ? 'Hide' : 'Show'} Outliers
          </span>
        </motion.div>
      </div>

      {/* ── Main Grid ── */}
      <div className="dash-main-grid">

        {/* Left Column */}
        <div className="main-analytics-flow" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Data Grid / Correlation tabs */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
              {(['grid', 'correlation'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none',
                    borderBottom: activeTab === tab ? '2px solid #d4af37' : '2px solid transparent',
                    color: activeTab === tab ? '#d4af37' : '#64748b', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 6, transition: 'color 0.2s' }}>
                  {tab === 'grid' ? <Database size={13} /> : <GitBranch size={13} />}
                  {tab === 'grid' ? 'Data Grid' : t.correlation}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'grid' ? (
                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ height: '45vh', minHeight: 280 }}>
                  <DataGrid
                    data={info.workData}
                    columns={info.columns.map(c => c.name)}
                    externalFilter={activeChartFilter}
                    outlierRowIndices={allOutlierRowIndices}
                    outlierMap={outlierMap}
                    showOutliers={showOutliers}
                  />
                </motion.div>
              ) : (
                <motion.div key="corr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ padding: 20, minHeight: 280, maxHeight: '55vh', overflowY: 'auto' }}>
                  {correlationMatrix
                    ? <CorrelationHeatmap data={correlationMatrix} />
                    : <div style={{ textAlign: 'center', color: '#475569', paddingTop: 60 }}>Need ≥ 2 numeric columns</div>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chart Builder */}
          <div className="glass-panel p-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t.builder}</h3>
              {activeChartFilter && (
                <button onClick={() => setActiveChartFilter('')}
                  style={{ fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>
                  Clear Filter
                </button>
              )}
            </div>
            <div className="builder-controls">
              <select className="kimit-select" value={builder.x} onChange={e => setBuilder({ ...builder, x: e.target.value })}>
                <option value="">X-Axis</option>
                {info.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <select className="kimit-select" value={builder.y} onChange={e => setBuilder({ ...builder, y: e.target.value })}>
                <option value="">Y-Axis</option>
                {info.columns.filter(c => c.type === 'numeric').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <select className="kimit-select" value={builder.type} onChange={e => setBuilder({ ...builder, type: e.target.value as ChartInfo['type'] })}>
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
              </select>
              <button className="premium-button" onClick={handleAddCustomChart}><Plus size={16} /> Add</button>
            </div>
            <div className="charts-display-grid">
              {customCharts.map((ch, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <DataChart chart={ch} onFilterClick={(_col: string, v: string) => setActiveChartFilter(v)} />
                  <button onClick={() => setCustomCharts(customCharts.filter((_ch, idx) => idx !== i))}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.15)',
                      color: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {info.charts.slice(0, 4).map((ch, i) => (
                <DataChart key={i} chart={ch} onFilterClick={(_col: string, v: string) => setActiveChartFilter(v)} />
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="sidebar-analytics" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Health Gauge */}
          <div className="glass-panel p-6" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(16,185,129,0.05), transparent)' }}>
            <h4 style={{ fontSize: 14, opacity: 0.7, marginBottom: 15 }}>{t.healthTitle}</h4>
            <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={health.color} strokeWidth="3" strokeDasharray={`${health.score}, 100`} />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                fontWeight: 800, fontSize: 22, color: health.color }}>{health.score}%</div>
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>Data Integrity: <b>{health.label}</b></p>
          </div>

          {/* Growth Indicators Panel */}
          {growthIndicators.length > 0 && (
            <div className="glass-panel p-6">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <TrendingUp size={16} style={{ color: '#d4af37' }} />
                <h4 style={{ margin: 0, fontSize: 14, color: '#d4af37' }}>{t.growth}</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {growthIndicators.slice(0, 5).map((g, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 12px', borderRadius: 10,
                      background: g.trend === 'up' ? 'rgba(16,185,129,0.05)' : g.trend === 'down' ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${g.trend === 'up' ? 'rgba(16,185,129,0.12)' : g.trend === 'down' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)'}` }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{g.column}</span>
                    <GrowthBadge pct={g.pctChange} trend={g.trend} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insight Summary */}
          <InsightSummary insights={insights} />

          {/* Power BI Bridge */}
          <PowerBIPanel />

          {/* Smart Transformations */}
          <div className="glass-panel p-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Activity size={16} style={{ color: '#38bdf8' }} />
              <h4 style={{ margin: 0, fontSize: 14 }}>Smart Transformations</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={removeDuplicates} className="action-row-btn">
                <span>Remove Duplicates</span><Trash2 size={13} />
              </button>
              <button onClick={fillMissingValues} className="action-row-btn">
                <span>Auto-Fill Missing</span><Plus size={13} />
              </button>
              <button onClick={rollback} className="action-row-btn" style={{ marginTop: 8, background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.1)' }}>
                <span>Undo Last Action</span><AlertTriangle size={13} />
              </button>
            </div>
          </div>

        </div>
      </div>

      <CreatorFooter lang={lang} />

      <style>{`
        .kpi-card { padding: 14px 16px !important; cursor: default; display: flex; flex-direction: column; gap: 4px; transition: border-color 0.2s, background 0.2s; }
        .kpi-card:hover { border-color: rgba(212,175,55,0.2) !important; }
        .kpi-label { font-size: 10px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.06em; }
        .kpi-value { font-size: 26px; font-weight: 800; line-height: 1.1; }
        .kpi-sub { font-size: 10px; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .glass-panel { background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; backdrop-filter: blur(10px); }
        .glass-card { background: rgba(30,41,59,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; }
        .premium-button { display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--primary); color: #000; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: all 0.2s; }
        .premium-button:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(16,185,129,0.3); }
        .premium-button.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .kimit-select { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: #f1f5f9; padding: 8px 12px; border-radius: 8px; font-size: 13px; outline: none; }
        .action-row-btn { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 11px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; color: #cbd5e1; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .action-row-btn:hover { background: rgba(255,255,255,0.07); color: #fff; }
        @media (max-width: 768px) {
          .dash-layout-container { padding: 12px 10px !important; }
          .dash-header-wrap { flex-direction: column !important; gap: 12px !important; }
          .actions-group { flex-direction: column !important; width: 100% !important; }
          .actions-group .premium-button { width: 100% !important; height: 48px !important; justify-content: center !important; }
          .kpi-mini-row { grid-template-columns: 1fr 1fr !important; }
          .dash-main-grid { grid-template-columns: 1fr !important; }
          .charts-display-grid { grid-template-columns: 1fr !important; }
          .builder-controls { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};
