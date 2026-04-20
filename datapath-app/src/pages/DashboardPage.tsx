import React, { useRef, useState } from 'react';
import { DataChart } from '../components/DataChart';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Filter, Plus, Trash2, Maximize2, Volume2 } from 'lucide-react';
import type { DatasetInfo, Lang, ChartInfo } from '../types';
import { generateExecutiveSummary, speakText } from '../lib/aiService';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { AdSpace } from '../components/AdSpace';
import { AD_PROVIDERS } from '../config/adConfig';

interface Props { info: DatasetInfo; lang: Lang; }

const T = {
  ar: {
    title: 'التحليل والرسوم البيانية',
    rows: 'سجلات', cols: 'متغير', missing: 'قيم مفقودة', dups: 'تكرار',
    anomalies: '⚠️ قيم شاذة', correlations: '🔗 علاقات قوية',
    insights: '🧠 ملخص سريع', high: 'عالي', medium: 'متوسط',
    chartsTitle: 'الرسوم البيانية',
    filters: 'فلاتر البيانات (Slicers)',
    noFilters: 'لا توجد أعمدة نصية للفلترة',
    builderTitle: 'صانع المخططات المخصص',
    xAxis: 'المحور الأفقي (X)',
    yAxis: 'المحور الرأسي (Y)',
    chartType: 'نوع الرسم',
    addChart: 'إضافة للوحة التحكم',
    clearFilters: 'مسح الفلاتر',
  },
  en: {
    title: 'Analytics & Charts',
    rows: 'Records', cols: 'Columns', missing: 'Missing', dups: 'Duplicates',
    anomalies: '⚠️ Anomalies', correlations: '🔗 Correlations',
    insights: '🧠 Quick Insights', high: 'High', medium: 'Medium',
    chartsTitle: 'Charts',
    filters: 'Data Slicers',
    noFilters: 'No text columns to filter',
    builderTitle: 'Custom Chart Builder',
    xAxis: 'X Axis (Categorical)',
    yAxis: 'Y Axis (Numeric)',
    chartType: 'Chart Type',
    addChart: 'Add to Dashboard',
    clearFilters: 'Clear Filters',
  }
};

export const DashboardPage: React.FC<Props> = ({ info, lang }) => {
  const dashRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  
  // Filtering Logic
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  // Custom Builder Logic
  const [customCharts, setCustomCharts] = useState<ChartInfo[]>([]);
  const [builder, setBuilder] = useState<{ x: string; y: string; type: ChartInfo['type'] }>({ x: '', y: '', type: 'bar' });

  // Advanced Features
  const [presentationMode, setPresentationMode] = useState(false);
  const [theme, setTheme] = useState('emerald');
  const [summary, setSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const t = T[lang];

  // providers منفصلة لكل بانر
  const topAdProvider = AD_PROVIDERS.filter(p => p.id === 'native_banner');
  const sidebarAdProvider = AD_PROVIDERS.filter(p => p.id === 'social_banner');

  const handleFetchSummary = async () => {
    const apiKey = localStorage.getItem('groq_key') || '';
    if (!apiKey) return;
    setLoadingSummary(true);
    try {
      const res = await generateExecutiveSummary(info, apiKey, lang);
      setSummary(res);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#6366f1'] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSummary(false);
    }
  };
  const numCols = info.columns.filter(c => c.type === 'numeric').length;
  const txtCols = info.columns.filter(c => c.type === 'text').length;

  const totalCells = Math.max(1, info.rows * info.columns.length);
  const healthPercent = Math.max(0, Math.round(100 - ((info.totalNulls / totalCells) * 100) - ((info.duplicates / info.rows) * 100) - (info.anomalies.length * 0.5)));

  // Apply Filters to data for charts
  const filteredData = info.workData.filter(row => {
    return Object.entries(filters).every(([col, val]) => !val || String(row[col]) === val);
  });

  const getUniqueValues = (col: string) => {
    const vals = Array.from(new Set(info.workData.map(r => String(r[col]))));
    return vals.slice(0, 50).sort(); // Limit to 50 unique values for UI safety
  };

  const handleAddCustomChart = () => {
    if (!builder.x || !builder.y) return;
    
    // Aggregation logic
    const agg: Record<string, number> = {};
    filteredData.forEach(r => {
      const key = String(r[builder.x]);
      const val = Number(r[builder.y]) || 0;
      agg[key] = (agg[key] || 0) + val;
    });

    const newChart: ChartInfo = {
      title: `${builder.y} vs ${builder.x}`,
      type: builder.type,
      data: Object.entries(agg).map(([x, y]) => ({ x, y }))
    };
    setCustomCharts([newChart, ...customCharts]);
  };

  const handleExportPDF = async () => {
    if (!dashRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(dashRef.current, { scale: 2, backgroundColor: '#020617', logging: false, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Kemet_Dashboard_${info.filename}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  return (
    <div className="page" ref={dashRef}>
      <div className={`dashboard-header ${presentationMode ? 'presentation-mode' : ''}`}>
        <div className="title-group">
          <h2 className="page-title">{t.title}</h2>
          <p className="page-sub">Kemet Analytics · {info.filename}</p>
        </div>
        <div className="actions-group">
          <div className="theme-picker">
            <span className="theme-picker-label">Theme</span>
            {['emerald', 'indigo', 'amber', 'rose'].map(th => (
              <button
                key={th}
                className={`theme-dot ${theme === th ? 'active' : ''}`}
                onClick={() => { setTheme(th); document.body.className = `theme-${th}`; }}
                style={{ background: th === 'emerald' ? '#10b981' : th === 'indigo' ? '#6366f1' : th === 'amber' ? '#f59e0b' : '#f43f5e' }}
              />
            ))}
          </div>
          <button className="btn-primary" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }} onClick={() => setPresentationMode(!presentationMode)}>
            <Maximize2 size={16} />
          </button>
          <button className="btn-primary" style={{ background: '#3b82f6', border: 'none' }} onClick={handleExportPDF} disabled={exporting}>
            <Download size={16} /> {exporting ? '...' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="dash-content-wrapper">
        {/* Top Banner Ad */}
        <div className="dashboard-ad-top">
          <AdSpace
            type="responsive"
            providers={topAdProvider}
            minHeight={90}
          />
        </div>

        {/* Live Slicers Bar */}
      <div className="slicers-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 600, fontSize: 13 }}>
          <Filter size={16} /> {t.filters}
        </div>
        {info.columns.filter(c => c.type === 'text').slice(0, 3).map(col => (
          <div key={col.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label>{col.name}</label>
            <select
              value={filters[col.name] || ''}
              onChange={e => setFilters({ ...filters, [col.name]: e.target.value })}
            >
              <option value="">All</option>
              {getUniqueValues(col.name).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}
        {Object.keys(filters).length > 0 && (
          <button className="filter-reset" onClick={() => setFilters({})}>{t.clearFilters}</button>
        )}
      </div>

      {/* Stats */}
      <div className="kpi-grid">
        {[
          { label: t.rows, value: info.rows.toLocaleString(), color: 'green' },
          { label: t.cols, value: info.columns.length, color: 'blue' },
          { label: t.missing, value: info.totalNulls.toLocaleString(), color: info.totalNulls > 0 ? 'yellow' : 'green' },
          { label: t.dups, value: info.duplicates.toLocaleString(), color: info.duplicates > 0 ? 'red' : 'green' },
        ].map(s => (
          <div key={s.label} className={`stat-box ${s.color}`}>
            <div className="stat-val">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-layout">
        {/* Charts grid */}
        <div className="charts-section">
          {/* Custom Builder */}
          <div className="builder-panel">
            <div className="builder-row">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 15 }}>
                  <Plus size={18} color="#10b981" />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.builderTitle}</span>
                </div>
                <label>{t.xAxis}</label>
                <select value={builder.x} onChange={e => setBuilder({ ...builder, x: e.target.value })}>
                  <option value="">Select...</option>
                  {info.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>{t.yAxis}</label>
                <select value={builder.y} onChange={e => setBuilder({ ...builder, y: e.target.value })}>
                  <option value="">Select...</option>
                  {info.columns.filter(c => c.type === 'numeric').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>{t.chartType}</label>
                <select value={builder.type} onChange={e => setBuilder({ ...builder, type: e.target.value as ChartInfo['type'] })}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                  <option value="area">Area</option>
                </select>
              </div>
              <div className="builder-action">
                <button className="btn-primary" onClick={handleAddCustomChart}>{t.addChart}</button>
              </div>
            </div>
          </div>

          <div className="section-title">{t.chartsTitle}</div>
          <div className="charts-grid">
            {customCharts.map((ch, i) => (
              <div key={`custom-${i}`} style={{ position: 'relative' }}>
                 <DataChart chart={ch} />
                 <button onClick={() => setCustomCharts(customCharts.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#ef4444', padding: 4, borderRadius: 4, cursor: 'pointer' }}>
                    <Trash2 size={14} />
                 </button>
              </div>
            ))}
            {info.charts.map((ch, i) => <DataChart key={i} chart={ch} />)}
          </div>
        </div>

         {/* Insights sidebar */}
         <div className="insights-section">
           <div className="section-title">صحة البيانات (Data Health)</div>
            <div className="insight-box data-health-box">
              <div style={{
                fontSize: 36,
                fontWeight: 900,
                color: healthPercent > 80 ? '#10b981' : healthPercent > 50 ? '#f59e0b' : '#ef4444'
              }}>
                {healthPercent}%
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 5 }}>مؤشر جودة ونظافة البيانات</p>
            </div>

            {/* Side Square Ad */}
            <div className="dashboard-ad-square">
              <AdSpace
                type="responsive"
                providers={sidebarAdProvider}
                minHeight={250}
              />
            </div>

            <div className="section-title" style={{ marginTop: 20 }}>{t.insights}</div>
          <div className="insight-box summary" style={{ position: 'relative' }}>
            {!summary ? (
              <button 
                onClick={handleFetchSummary} 
                disabled={loadingSummary}
                style={{ width: '100%', padding: '15px', background: 'rgba(16,185,129,0.1)', border: '1px dashed var(--primary)', borderRadius: '10px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700 }}
              >
                {loadingSummary ? '...' : (lang === 'ar' ? 'توليد ملخص ذكي فوراً ✨' : 'Generate Smart Summary ✨')}
              </button>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                  <button onClick={() => speakText(summary, lang)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                    <Volume2 size={18} />
                  </button>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{summary}</div>
              </motion.div>
            )}
            <p style={{ marginTop: 10, fontSize: 11, opacity: 0.6 }}>
              {lang === 'ar'
                ? `${info.rows.toLocaleString()} سجل · ${numCols} عمود رقمي · ${txtCols} عمود نصي`
                : `${info.rows.toLocaleString()} rows · ${numCols} numeric cols · ${txtCols} text cols`
              }
            </p>
          </div>

          {info.anomalies.length > 0 && (
            <div className="insight-block">
              <div className="insight-block-title danger">{t.anomalies}</div>
              {info.anomalies.map((a, i) => (
                <div key={i} className="insight-item">
                  <div className="insight-item-top">
                    <span className="insight-col">{a.column}</span>
                    <span className={`sev-badge ${a.severity}`}>{a.severity === 'high' ? t.high : t.medium}</span>
                  </div>
                  <div className="insight-item-desc">{a.description}</div>
                </div>
              ))}
            </div>
          )}

          {info.correlations.length > 0 && (
            <div className="insight-block">
              <div className="insight-block-title purple">{t.correlations}</div>
              {info.correlations.map((c, i) => (
                <div key={i} className="insight-item corr">
                  <div className="insight-item-top">
                    <span className="insight-col">{c.col1} ↔ {c.col2}</span>
                    <span className="corr-val">{c.value.toFixed(2)}</span>
                  </div>
                  <div className="insight-item-desc">{c.strength}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
