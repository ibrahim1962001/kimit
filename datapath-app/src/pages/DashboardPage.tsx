import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useKimitData } from '../hooks/useKimitData';
import { useKimitEngine } from '../hooks/useKimitEngine';
import { DataChart } from '../components/DataChart';
import {
  Plus, Trash2, FileText, Loader2, Sparkles, Database,
  Activity, AlertTriangle, TrendingUp, TrendingDown,
  Minus, GitBranch, Wand2, BookOpen, Plug, X, Filter,
} from 'lucide-react';
import type { Lang, ChartInfo } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { DataGrid } from '../components/Analysis/DataGrid';
import { TransformationTimeline } from '../components/Analysis/TransformationTimeline';
import { CorrelationHeatmap } from '../components/Analysis/CorrelationHeatmap';
import { InsightSummary } from '../components/Analysis/InsightSummary';
import { ExportActions } from '../components/Analysis/ExportActions';
import { PowerBIPanel } from '../components/Analysis/PowerBIPanel';
import { PredictiveSuite } from '../components/Analysis/PredictiveSuite';
import { SourceManager } from '../components/SourceManager';
import { CreatorFooter } from '../components/CreatorFooter';
import { exportBrandedPDF, exportToExcel } from '../lib/exportUtils';
import { convertBackendResultToDatasetInfo, type BackendResult } from '../lib/dataUtils';
import { generateAInarrative } from '../lib/narrativeEngine';
import { generateExecutiveReport } from '../lib/report-gen';

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

// ===== LIVE DASHBOARD SECTION — NEW =====

// ── Count-Up Hook ────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    // Use rAF for all cases to avoid synchronous setState in effect body
    let start: number | null = null;
    let rafId: number;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = target === 0 ? 0 : 1 - Math.pow(1 - progress, 4);
      setValue(Math.floor(eased * target));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return value;
}

// ── Status Line ──────────────────────────────────────────────────
const StatusLine: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
    <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
  </div>
);

// ── KPI Card ─────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  borderColor: string;
  icon: React.ReactNode;
  delay: number;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, borderColor, icon, delay }) => {
  const animated = useCountUp(value);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        animation: `slideUpFade 0.5s ease both`,
        animationDelay: `${delay}ms`,
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        boxShadow: hovered ? `0 0 20px ${borderColor}33` : 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: borderColor }}>
        {icon}
        <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
        {animated.toLocaleString()}
      </div>
    </div>
  );
};

// ── Quick Action Button ──────────────────────────────────────────
const QuickActionBtn: React.FC<{ label: string; color: string; icon: React.ReactNode; onClick: () => void }> = ({ label, color, icon, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 20px',
        background: hovered ? `rgba(${color === '#10b981' ? '16,185,129' : color === '#3b82f6' ? '59,130,246' : color === '#f59e0b' ? '245,158,11' : '239,68,68'},0.08)` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? color : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 10,
        color: '#f8fafc',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 600,
        transition: 'all 0.2s ease',
        boxShadow: hovered ? `0 0 12px ${color}26` : 'none',
      }}
    >
      <span style={{ color: hovered ? color : '#94a3b8', transition: 'color 0.2s' }}>{icon}</span>
      {label}
    </button>
  );
};

// ===== END LIVE DASHBOARD SECTION =====

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
  const {
    info, rollback, setDataset,
    crossFilters, crossFilteredData, isCrossFiltered,
    setCrossFilter, clearCrossFilters,
  } = useKimitData();
  const {
    removeDuplicates, fillMissingValues, magicClean, getHealthStats,
    outlierMap, allOutlierRowIndices, correlationMatrix, growthIndicators,
  } = useKimitEngine();

  const [exporting, setExporting] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [customCharts, setCustomCharts] = useState<ChartInfo[]>([]);
  const [builder, setBuilder] = useState<{ x: string; y: string; type: ChartInfo['type'] }>({ x: '', y: '', type: 'bar' });
  const [activeChartFilter, setActiveChartFilter] = useState('');
  const [showOutliers, setShowOutliers] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'correlation'>('grid');
  const [showSourceManager, setShowSourceManager] = useState(false);

  const health = getHealthStats();
  const t = T[lang];

  // ── insights must be memoized so it doesn't change every render ──────────
  const insights = useMemo(
    () => (info ? generateAInarrative(info) : []),
    [info]
  );

  // ===== LIVE DASHBOARD MEMOS =====
  const dataset = useMemo(() => info?.workData ?? [], [info]);
  const totalRows = dataset.length;
  const totalCols = useMemo(() => dataset.length > 0 ? Object.keys(dataset[0]).length : 0, [dataset]);

  const totalMissing = useMemo(() => {
    return dataset.reduce((acc, row) => {
      return acc + Object.values(row).filter(v => v === null || v === undefined || v === '').length;
    }, 0);
  }, [dataset]);

  const totalDuplicates = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    dataset.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) count++;
      else seen.add(key);
    });
    return count;
  }, [dataset]);

  const qualityScore = useMemo(() => {
    if (totalRows === 0) return 0;
    const score = ((totalRows - totalMissing - totalDuplicates) / totalRows) * 100;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [totalRows, totalMissing, totalDuplicates]);

  const scoreColor = qualityScore >= 80 ? '#10b981' : qualityScore >= 60 ? '#f59e0b' : '#ef4444';

  const columnStats = useMemo(() => {
    if (dataset.length === 0) return [];
    const cols = Object.keys(dataset[0]);
    return cols.map(col => {
      const values = dataset.map(row => row[col]);
      const missing = values.filter(v => v === null || v === undefined || v === '').length;
      const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
      const isNumeric = nonNull.length > 0 && nonNull.every(v => !isNaN(Number(v)));
      const isDate = !isNumeric && nonNull.some(v => !isNaN(Date.parse(String(v))));
      const type = isNumeric ? 'رقمي' : isDate ? 'تاريخ' : 'نصي';
      const typeColor = isNumeric ? '#3b82f6' : isDate ? '#8b5cf6' : '#10b981';
      const colHealth = totalRows > 0 ? Math.round(((totalRows - missing) / totalRows) * 100) : 0;
      const healthColor = colHealth >= 80 ? '#10b981' : colHealth >= 50 ? '#f59e0b' : '#ef4444';
      return { col, type, typeColor, missing, health: colHealth, healthColor };
    });
  }, [dataset, totalRows]);

  // ── SVG ring animation ─────────────────────────────────────────
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference * (1 - qualityScore / 100);
  const [animatedOffset, setAnimatedOffset] = useState(circumference);
  const ringAnimRef = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    const from = circumference;
    const to = targetOffset;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimatedOffset(from + (to - from) * eased);
      if (progress < 1) ringAnimRef.current = requestAnimationFrame(animate);
    };
    ringAnimRef.current = requestAnimationFrame(animate);
    return () => { if (ringAnimRef.current) cancelAnimationFrame(ringAnimRef.current); };
  }, [targetOffset, circumference]);
  // ===== END LIVE DASHBOARD MEMOS =====

  // ── All hooks MUST be declared before any early return ───────────────────

  // Magic Clean: Atomic dedup + mean fill
  const handleMagicClean = async () => {
    setCleaning(true);
    await new Promise(r => setTimeout(r, 600));
    magicClean();
    setCleaning(false);
  };

  const handleAddCustomChart = useCallback(() => {
    if (!info || !builder.x || !builder.y) return;
    const agg: Record<string, number> = {};
    info.workData.forEach(r => {
      const key = String(r[builder.x]);
      agg[key] = (agg[key] || 0) + (Number(r[builder.y]) || 0);
    });
    setCustomCharts(prev => [{
      title: `${builder.y} vs ${builder.x}`,
      type: builder.type,
      data: Object.entries(agg).map(([x, y]) => ({ x, y })),
    }, ...prev]);
  }, [info, builder]);

  const handleFullPDF = useCallback(async () => {
    if (!info) return;
    setExporting(true);
    await exportBrandedPDF('dashboard-main-content', `Kimit_Report_${info.filename}.pdf`);
    setExporting(false);
  }, [info]);

  // ── AI Executive Report (Task 1) ──────────────────────────────────────────
  const handleExecutiveReport = useCallback(async () => {
    if (!info) return;
    setReportGenerating(true);
    await generateExecutiveReport(info, health, {
      title: `${info.filename} — Executive Report`,
      subtitle: 'Kimit AI Studio — Advanced Analytics',
      author: 'Kimit AI System',
      insights: insights.map(ins => ({ title: ins.title, description: ins.description, type: ins.type })),
    });
    setReportGenerating(false);
  }, [info, health, insights]);

  // ── Cross-Filter handlers (Task 4) ────────────────────────────────────────
  const handleChartSegmentClick = useCallback((column: string, value: string) => {
    setCrossFilter(column, value);
    setActiveChartFilter(value);
  }, [setCrossFilter]);

  // ── Google Sheets Live Sync ────────────────────────────────────────
  useEffect(() => {
    if (!info?.sourceUrl) return;
    const interval = setInterval(async () => {
      try {
        const { datasetsApi } = await import('../api/datasets.api');
        const res = await datasetsApi.importSheets(info.sourceUrl!);
        setDataset(convertBackendResultToDatasetInfo(res as unknown as BackendResult));
      } catch (err) {
        console.error("Live Sync failed", err);
      }
    }, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, [info?.sourceUrl, setDataset]);

  const handleClearAllFilters = useCallback(() => {
    clearCrossFilters();
    setActiveChartFilter('');
  }, [clearCrossFilters]);

  // ── Early return guard — AFTER all hooks ──────────────────────────────────
  const hasData = !!info && dataset.length > 0;

  // Growth: pick first 3 numeric columns for KPI display
  const kpiGrowth = growthIndicators.slice(0, 3);

  if (!info) {
    return (
      <div className="dash-layout-container">
        {/* ===== EMPTY STATE ===== */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 20px',
          background: 'rgba(30,41,59,0.4)',
          borderRadius: 16,
          border: '2px dashed rgba(16,185,129,0.3)',
          marginBottom: 24,
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <h3 style={{ color: '#f8fafc', margin: '16px 0 8px', fontSize: 20 }}>ارفع ملف البيانات للبدء</h3>
          <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400, fontSize: 14 }}>
            يدعم النظام ملفات CSV و Excel بأي حجم. سيتم تحليل بياناتك فوراً.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 24, width: '100%', maxWidth: 500 }}>
            {[0,1,2].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
          </div>
        </div>
        <style>{`
          @keyframes shimmer {
            0%   { background-position: -400px 0; }
            100% { background-position:  400px 0; }
          }
          .skeleton {
            background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
            background-size: 400px 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 8px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dash-layout-container">

      {/* ── Source Manager Modal (Task 3) ── */}
      <AnimatePresence>
        {showSourceManager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setShowSourceManager(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 540,
                background: '#0a0f1d',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 20, padding: '24px',
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(212,175,55,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plug size={18} color="#d4af37" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>Source Manager</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>Connect to a data source</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowSourceManager(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                  <X size={18} />
                </button>
              </div>
              <SourceManager
                onFileUploadMode={() => setShowSourceManager(false)}
                onSuccess={(res) => {
                  setDataset(convertBackendResultToDatasetInfo(res as unknown as BackendResult));
                  setShowSourceManager(false);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="dash-header-wrap">
        <div className="title-group">
          <motion.h2 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Sparkles className="text-primary" /> {t.title}
          </motion.h2>
          <p className="page-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {info.filename} • {info.rows.toLocaleString()} {t.records}
            {info.sourceUrl && (
              <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
                Live Sync
              </span>
            )}
          </p>
        </div>
        <div className="actions-group" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Source Manager */}
          <button
            className="premium-button secondary"
            onClick={() => setShowSourceManager(true)}
            style={{ fontSize: '12px' }}
          >
            <Plug size={14} /> Sources
          </button>
          {/* 📥 Download Original */}
          <button
            className="premium-button secondary"
            onClick={async () => {
              if (info?.datasetId) {
                try {
                  const { datasetsApi } = await import('../api/datasets.api');
                  await datasetsApi.downloadRaw(info.datasetId, info.filename);
                } catch (err) {
                  alert("Download failed: " + err);
                }
              }
            }}
            style={{ fontSize: '12px' }}
          >
            <FileText size={14} /> Download Original
          </button>
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
          {/* AI Executive Report (Task 1) */}
          <button
            className="premium-button"
            onClick={handleExecutiveReport}
            disabled={reportGenerating}
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2040)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}
          >
            {reportGenerating ? <Loader2 className="spin" size={16} /> : <BookOpen size={16} />}
            AI Report
          </button>
        </div>
      </div>

      {/* ===== LIVE DASHBOARD SECTION — NEW ===== */}
      {hasData && (
        <>
          {/* ── SECTION 1: KPI Strip ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 16,
          }} className="live-kpi-grid">
            <KpiCard
              label="إجمالي الصفوف / Total Rows"
              value={totalRows}
              borderColor="#10b981"
              delay={0}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                </svg>
              }
            />
            <KpiCard
              label="إجمالي الأعمدة / Total Columns"
              value={totalCols}
              borderColor="#3b82f6"
              delay={100}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <line x1="15" y1="3" x2="15" y2="21"/>
                </svg>
              }
            />
            <KpiCard
              label="قيم مفقودة / Missing Values"
              value={totalMissing}
              borderColor="#f59e0b"
              delay={200}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
            />
            <KpiCard
              label="مكررات / Duplicates"
              value={totalDuplicates}
              borderColor="#ef4444"
              delay={300}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              }
            />
          </div>

          {/* ── SECTION 2: Quality Ring + Column Health ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 3fr',
            gap: 16,
            marginBottom: 16,
          }} className="live-quality-grid">
            {/* Left: Quality Ring */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>جودة البيانات / Data Quality</div>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
                <circle
                  cx="70" cy="70" r={r}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={animatedOffset}
                  transform="rotate(-90 70 70)"
                  style={{ transition: 'stroke 0.3s ease' }}
                />
                <text x="70" y="65" textAnchor="middle" fill="#f8fafc" fontSize="28" fontWeight="bold">{qualityScore}</text>
                <text x="70" y="85" textAnchor="middle" fill="#94a3b8" fontSize="13">%</text>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, width: '100%' }}>
                <StatusLine color="#10b981" label={`بيانات محللة: ${totalRows.toLocaleString()} صف`} />
                <StatusLine color="#f59e0b" label={`مشاكل مكتشفة: ${totalMissing + totalDuplicates}`} />
                <StatusLine color="#3b82f6" label={`قابل للإصلاح: ${totalMissing + totalDuplicates > 0 ? 'نعم ✓' : 'لا يوجد'}`} />
              </div>
            </div>

            {/* Right: Column Health */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '20px',
              overflow: 'hidden',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>صحة الأعمدة / Column Health</div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>اسم العمود</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>النوع</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>مفقود</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>صحة البيانات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnStats.map((cs, i) => (
                      <tr key={cs.col} style={{
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)',
                        animation: 'fadeIn 0.3s ease both',
                        animationDelay: `${i * 20}ms`,
                      }}>
                        <td style={{ padding: '8px', color: '#e2e8f0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cs.col}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 99, fontSize: 11,
                            background: `${cs.typeColor}22`, color: cs.typeColor,
                            border: `1px solid ${cs.typeColor}44`,
                          }}>{cs.type}</span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', color: cs.missing > 0 ? '#f59e0b' : '#94a3b8' }}>{cs.missing}</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
                              <div style={{ width: `${cs.health}%`, height: '100%', borderRadius: 3, background: cs.healthColor, transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: 10, color: cs.healthColor, minWidth: 28 }}>{cs.health}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: Quick Actions Bar ── */}
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap',
            padding: 16, marginBottom: 16,
            background: 'rgba(30,41,59,0.5)',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {([
              {
                label: 'تنقية البيانات / Clean',
                color: '#10b981',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
                onClick: () => window.dispatchEvent(new CustomEvent('kimit:navigate', { detail: 'cleaning' })),
              },
              {
                label: 'محادثة AI / Chat',
                color: '#3b82f6',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                onClick: () => window.dispatchEvent(new CustomEvent('kimit:navigate', { detail: 'chat' })),
              },
              {
                label: 'تصدير Excel / Export',
                color: '#10b981',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
                onClick: () => { if (info) { exportToExcel(info.workData, `Kimit_Data_${info.filename}.xlsx`); } },
              },
              {
                label: 'رفع ملف جديد / New File',
                color: '#f59e0b',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.89"/></svg>,
                onClick: () => { setDataset(null); window.dispatchEvent(new CustomEvent('kimit:navigate', { detail: 'home' })); },
              },
            ] as { label: string; color: string; icon: React.ReactNode; onClick: () => void }[]).map((btn) => (
              <QuickActionBtn key={btn.label} {...btn} />
            ))}
          </div>
        </>
      )}
      {/* ===== END LIVE DASHBOARD SECTION ===== */}

      <TransformationTimeline />

      <div style={{ marginBottom: 20 }}>
        <ExportActions 
          data={info.workData} 
          columns={info.columns.map(c => c.name)} 
          elementIdToCapture="dashboard-main-area" 
        />
      </div>

      <div id="dashboard-main-area" className="dash-main-grid-container">
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

            {/* Cross-filter active banner (Task 4) */}
            <AnimatePresence>
              {isCrossFiltered && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', background: 'rgba(212,175,55,0.06)',
                    borderBottom: '1px solid rgba(212,175,55,0.15)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                      <Filter size={11} color="#d4af37" />
                      <span style={{ fontSize: 10, color: '#d4af37', fontWeight: 700 }}>CROSS-FILTER ACTIVE</span>
                      {crossFilters.map(cf => (
                        <span key={cf.column} style={{
                          fontSize: 9, padding: '2px 8px', borderRadius: 20,
                          background: 'rgba(212,175,55,0.15)', color: '#d4af37',
                          border: '1px solid rgba(212,175,55,0.3)',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {cf.column}: <b>{cf.value}</b>
                          <button
                            onClick={() => setCrossFilter(cf.column, cf.value)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d4af37', padding: 0, lineHeight: 1 }}>
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={handleClearAllFilters}
                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Clear All
                    </button>
                  </div>
                  <div style={{ padding: '6px 16px', fontSize: 10, color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    Showing <b style={{ color: '#e2e8f0' }}>{crossFilteredData.length}</b> of{' '}
                    <b style={{ color: '#e2e8f0' }}>{info.workData.length}</b> records
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {activeTab === 'grid' ? (
                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ height: '45vh', minHeight: 280 }}>
                  <DataGrid
                    data={isCrossFiltered ? crossFilteredData : info.workData}
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
                <div key={i} id={`custom-chart-${i}`} style={{ position: 'relative' }}>
                  <DataChart
                    chart={ch}
                    onFilterClick={(col: string, v: string) => handleChartSegmentClick(col, v)}
                  />
                  <button onClick={() => setCustomCharts(customCharts.filter((_ch, idx) => idx !== i))}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.15)',
                      color: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {info.charts.slice(0, 4).map((ch, i) => (
                <div key={i} id={`kimit-chart-${i}`}>
                  <DataChart
                    chart={ch}
                    onFilterClick={(col: string, v: string) => handleChartSegmentClick(col, v)}
                  />
                </div>
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

          {/* ── Scenario Analysis / What-If Sliders (Task 2) ── */}
          <PredictiveSuite />

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
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 400px 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        @media (max-width: 768px) {
          .live-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .live-quality-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
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
    </div>
  );
};
