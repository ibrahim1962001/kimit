import React, { useRef, useState, useEffect } from 'react';

import { analyzeDataset } from '../lib/dataUtils';
import { DataChart } from '../components/DataChart';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Filter, Plus, Trash2, Maximize2, FileText, Loader2 } from 'lucide-react';
import { generateExecutiveSummary } from '../lib/aiService';
import type { DatasetInfo, Lang, ChartInfo, SummaryReport } from '../types';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { AdSpace } from '../components/AdSpace';
import { AD_PROVIDERS } from '../config/adConfig';
import { DataPreview } from '../components/DataPreview';
import { CreatorFooter } from '../components/CreatorFooter';
import { useMediaQuery } from 'react-responsive';
import { Copy, AlertTriangle, AlertCircle, Lightbulb, TrendingUp, CheckCircle, Brain } from 'lucide-react';

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

export const DashboardPage: React.FC<Props> = ({ info: initialInfo, lang }) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const dashRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  
  // Filtering Logic
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<DatasetInfo>(initialInfo);
  
  // Custom Builder Logic
  const [customCharts, setCustomCharts] = useState<ChartInfo[]>([]);
  const [builder, setBuilder] = useState<{ x: string; y: string; type: ChartInfo['type'] }>({ x: '', y: '', type: 'bar' });

  // Advanced Features
  const [presentationMode, setPresentationMode] = useState(false);
  const [theme, setTheme] = useState('emerald');
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const t = T[lang];

  // providers منفصلة لكل بانر
  const topAdProvider = AD_PROVIDERS.filter(p => p.id === 'native_banner');
  const sidebarAdProvider = AD_PROVIDERS.filter(p => p.id === 'social_banner');

  const handleFetchSummary = async () => {
    const apiKey = localStorage.getItem('groq_key') || undefined;
    setLoadingSummary(true);
    try {
      const res = await generateExecutiveSummary(info, apiKey, lang);
      setSummary(res);
      if (!res.isLocal) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#6366f1'] });
      }
    } catch (e: unknown) {
      console.error(e);
      // Fallback is already handled inside generateExecutiveSummary, this catch is just for safety
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleCopyReport = () => {
    if (!summary) return;
    const reportText = `
Executive Summary:
${summary.executiveSummary}

Top Insights:
${summary.insights.map(i => '- ' + i).join('\n')}

Warnings & Anomalies:
${summary.warnings.map(i => '- ' + i).join('\n')}

Data Quality Issues:
${summary.qualityIssues.map(i => '- ' + i).join('\n')}

Actionable Recommendations:
${summary.recommendations.map(i => '- ' + i).join('\n')}

Suggested Opportunities:
${summary.opportunities.map(i => '- ' + i).join('\n')}
    `.trim();
    navigator.clipboard.writeText(reportText);
    alert(lang === 'ar' ? 'تم نسخ التقرير' : 'Report copied to clipboard');
  };

  const handleSummaryPDF = async () => {
    if (!summary) return;
    setLoadingSummary(true);
    try {
      const tempDiv = document.createElement('div');
      tempDiv.style.padding = '30px';
      tempDiv.style.background = '#0f172a';
      tempDiv.style.color = '#f8fafc';
      tempDiv.style.width = '800px';
      tempDiv.style.fontFamily = '"Plus Jakarta Sans", "Noto Sans Arabic", sans-serif';
      
      let html = `<h2 style="color: #10b981; border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px;">Kimit AI - Smart Analytics Report</h2>`;
      if (summary.isLocal) html += `<p style="color: #f59e0b; font-weight: bold;">[Local Analysis Mode]</p>`;
      
      html += `
        <div dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
          <h3 style="color: #38bdf8;">Executive Summary</h3>
          <p style="font-size: 14px;">${summary.executiveSummary}</p>
          
          <h3 style="color: #a855f7; margin-top: 20px;">Top Insights</h3>
          <ul style="font-size: 14px;">${summary.insights.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}</ul>
          
          <h3 style="color: #f59e0b; margin-top: 20px;">Warnings & Anomalies</h3>
          <ul style="font-size: 14px;">${summary.warnings.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}</ul>
          
          <h3 style="color: #ef4444; margin-top: 20px;">Data Quality</h3>
          <ul style="font-size: 14px;">${summary.qualityIssues.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}</ul>
          
          <h3 style="color: #10b981; margin-top: 20px;">Recommendations</h3>
          <ul style="font-size: 14px;">${summary.recommendations.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}</ul>
        </div>
      `;
      
      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);
      const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, backgroundColor: '#0f172a' });
      document.body.removeChild(tempDiv);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${info.filename.replace(/\.[^/.]+$/, "")}_Smart_Report.pdf`);
    } catch (pdfErr) {
      console.error('PDF Generation Error:', pdfErr);
    } finally {
      setLoadingSummary(false);
    }
  };
  const numCols = info.columns.filter(c => c.type === 'numeric').length;
  const txtCols = info.columns.filter(c => c.type === 'text').length;

  const totalCells = Math.max(1, info.rows * info.columns.length);
  const healthPercent = Math.max(0, Math.round(100 - ((info.totalNulls / totalCells) * 100) - ((info.duplicates / info.rows) * 100) - (info.anomalies.length * 0.5)));

  // Re-calculate DataInfo when filters change
  useEffect(() => {
    const active = Object.values(filters).some(v => v);
    if (!active) {
      setInfo(initialInfo);
      return;
    }
    const filteredWorkData = initialInfo.workData.filter(row => {
      return Object.entries(filters).every(([col, val]) => !val || String(row[col]) === val);
    });
    setInfo(analyzeDataset(new File([], initialInfo.filename), filteredWorkData));
  }, [filters, initialInfo]);

  // Phase 2.1: Proactive Insights — REMOVED auto-trigger
  // Summary is now only generated when the user clicks the button

  const getUniqueValues = (col: string) => {
    const vals = Array.from(new Set(initialInfo.workData.map(r => String(r[col]))));
    return vals.slice(0, 50).sort(); // Limit to 50 unique values for UI safety
  };

  const handleAddCustomChart = () => {
    if (!builder.x || !builder.y) return;
    
    // Aggregation logic
    const agg: Record<string, number> = {};
    info.workData.forEach(r => {
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
    const target = chartsRef.current || dashRef.current;
    if (!target) return;
    setExporting(true);
    try {
      // Use higher scale for PDF quality
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#020617', logging: false, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Kimit_Charts_${info.filename}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  const handleExportImage = async () => {
    const target = chartsRef.current || dashRef.current;
    if (!target) return;
    setExporting(true);
    try {
      // Direct PNG capture - much faster
      const canvas = await html2canvas(target, { scale: 1.5, backgroundColor: '#020617', useCORS: true });
      const link = document.createElement('a');
      link.download = `Kimit_Charts_${info.filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
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
          <p className="page-sub">Kimit Analytics · {info.filename}</p>
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
          <button className="btn-primary" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }} onClick={() => setPresentationMode(!presentationMode)}>
            <Maximize2 size={16} />
          </button>
          <button className="btn-primary" style={{ background: '#10b981', border: 'none', boxShadow: '0 0 15px rgba(16,185,129,0.2)' }} onClick={handleExportImage} disabled={exporting}>
            <Download size={16} /> {exporting ? '...' : (lang === 'ar' ? 'تحميل صورة' : 'IMAGE')}
          </button>
          <button className="btn-primary" style={{ background: '#10b981', border: 'none', opacity: 0.8 }} onClick={handleExportPDF} disabled={exporting}>
            <FileText size={16} /> {exporting ? '...' : 'PDF'}
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
        
        {/* Quick Preview Section */}
        <div className="dashboard-preview-section" style={{ padding: '0 20px', marginBottom: '20px' }}>
          <DataPreview data={info.workData} lang={lang} />
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

      {/* Stats KPI Grid */}
      <div className="kpi-grid">
        {[
          { label: t.rows, value: info.rows.toLocaleString(), color: 'green' },
          { label: t.cols, value: info.columns.length.toLocaleString(), color: 'blue' },
          { label: t.missing, value: info.totalNulls.toLocaleString(), color: info.totalNulls > 0 ? 'yellow' : 'green' },
          { label: t.dups, value: info.duplicates.toLocaleString(), color: info.duplicates > 0 ? 'red' : 'green' },
        ].map(s => (
          <div key={s.label} className={`stat-box ${s.color}`}>
            <div
              className="stat-val"
              style={{
                fontSize: s.value.length > 7 ? '16px' : s.value.length > 5 ? '20px' : s.value.length > 3 ? '26px' : '32px',
                lineHeight: 1.1,
              }}
            >
              {s.value}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Middle Banner Ad between KPIs and Charts */}
      <div className="dashboard-ad-top" style={{ marginTop: 15, marginBottom: 5 }}>
        <AdSpace
          type="responsive"
          providers={AD_PROVIDERS.filter(p => p.id === 'adsterra_main')}
          minHeight={90}
          lazyLoad
        />
      </div>

      <div className="dash-layout" style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 0 } : {}}>
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

          <div ref={chartsRef} style={{ background: '#020617', padding: '10px', borderRadius: '16px' }}>
            <div className="section-title">{t.chartsTitle}</div>
            <div
              className="charts-grid"
            style={isMobile ? {
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '14px',
            } : {}}
          >
            {customCharts.map((ch, i) => (
              <div key={`custom-${i}`} style={{ position: 'relative' }}>
                 <DataChart chart={ch} />
                 <button onClick={() => setCustomCharts(customCharts.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#ef4444', padding: 4, borderRadius: 4, cursor: 'pointer' }}>
                    <Trash2 size={14} />
                 </button>
              </div>
            ))}
            {/* On mobile show all charts — grid is 1 col so it's clean */}
            {info.charts.map((ch, i) => <DataChart key={i} chart={ch} />)}
          </div>
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
          <div className="insight-box summary" style={{ position: 'relative', padding: summary ? '0' : '20px', background: summary ? 'transparent' : 'var(--card-bg)', border: summary ? 'none' : '1px solid var(--border)' }}>
            {!summary ? (
              <>
                <button 
                  onClick={handleFetchSummary} 
                  disabled={loadingSummary}
                  style={{ width: '100%', padding: '15px', background: 'rgba(16,185,129,0.1)', border: '1px dashed var(--primary)', borderRadius: '10px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loadingSummary ? (<><Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> {lang === 'ar' ? 'جاري التوليد...' : 'Generating...'}</>) : (lang === 'ar' ? 'توليد تقرير ذكي شامل ✨' : 'Generate Smart Report ✨')}
                </button>
                <p style={{ marginTop: 10, fontSize: 11, opacity: 0.6, textAlign: 'center' }}>
                  {lang === 'ar'
                    ? `${info.rows.toLocaleString()} سجل · ${numCols} عمود رقمي · ${txtCols} عمود نصي`
                    : `${info.rows.toLocaleString()} rows · ${numCols} numeric cols · ${txtCols} text cols`
                  }
                </p>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="structured-report">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {summary.isLocal ? (
                      <span style={{ fontSize: 11, background: '#f59e0b', color: '#000', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>Local Analysis — No AI</span>
                    ) : (
                      <span style={{ fontSize: 11, background: 'var(--primary)', color: '#000', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>AI Generated ✨</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleCopyReport} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 12 }}>
                      <Copy size={14} /> {lang === 'ar' ? 'نسخ' : 'Copy'}
                    </button>
                    <button onClick={handleSummaryPDF} disabled={loadingSummary} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,0.2)', border: 'none', color: 'var(--primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 12 }}>
                      {loadingSummary ? <Loader2 size={14} className="spin" /> : <FileText size={14} />} PDF
                    </button>
                  </div>
                </div>

                <div className="report-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', marginBottom: 10, fontSize: 15 }}><Brain size={18} /> Executive Summary</h4>
                  <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>{summary.executiveSummary}</p>
                </div>

                <div className="report-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a855f7', marginBottom: 10, fontSize: 15 }}><TrendingUp size={18} /> Top Insights</h4>
                  <ol style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>
                    {summary.insights.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: 6 }}><strong>{item.split(':')[0]}</strong>{item.includes(':') ? ':' + item.split(':').slice(1).join(':') : ''}</li>
                    ))}
                  </ol>
                </div>

                <div className="report-card" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', marginBottom: 10, fontSize: 15 }}><AlertTriangle size={18} /> Warnings & Anomalies</h4>
                  <ul style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, lineHeight: 1.6, color: '#fcd34d' }}>
                    {summary.warnings.map((item, idx) => <li key={idx} style={{ marginBottom: 6 }}>{item}</li>)}
                  </ul>
                </div>

                <div className="report-card" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', marginBottom: 10, fontSize: 15 }}><AlertCircle size={18} /> Data Quality Issues</h4>
                  <ul style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, lineHeight: 1.6, color: '#fca5a5' }}>
                    {summary.qualityIssues.map((item, idx) => <li key={idx} style={{ marginBottom: 6 }}>{item}</li>)}
                  </ul>
                </div>

                <div className="report-card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 10, fontSize: 15 }}><CheckCircle size={18} /> Recommendations</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {summary.recommendations.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, background: 'rgba(16, 185, 129, 0.1)', padding: '10px 15px', borderRadius: '8px' }}>
                        <span style={{ fontSize: 13, lineHeight: 1.6, color: '#d1fae5' }}>{item}</span>
                        <button style={{ minWidth: '80px', background: '#10b981', border: 'none', color: '#000', fontSize: 11, fontWeight: 'bold', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>{lang === 'ar' ? 'تنفيذ' : 'Execute'}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="report-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60a5fa', marginBottom: 10, fontSize: 15 }}><Lightbulb size={18} /> Opportunities</h4>
                  <ul style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>
                    {summary.opportunities.map((item, idx) => <li key={idx} style={{ marginBottom: 6 }}>{item}</li>)}
                  </ul>
                </div>

              </motion.div>
            )}
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

          {/* Bottom Ad space in the Insights sidebar to fill empty vertical space */}
          <div className="dashboard-ad-vertical" style={{ marginTop: 20 }}>
            <AdSpace
              type="vertical"
              providers={AD_PROVIDERS.filter(p => p.id === 'native_banner')}
              minHeight={400}
              lazyLoad
            />
          </div>
        </div>
      </div>
      </div>
      <CreatorFooter lang={lang} />
    </div>
  );
};
