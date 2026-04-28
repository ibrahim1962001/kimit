import React, { useState } from 'react';
import { useKimitData } from '../hooks/useKimitData';
import { useKimitEngine } from '../hooks/useKimitEngine';
import { DataChart } from '../components/DataChart';
import { Plus, Trash2, FileText, Loader2, Sparkles, Database, ShieldCheck, Activity } from 'lucide-react';
import type { Lang, ChartInfo } from '../types';
import { motion } from 'framer-motion';
import { DataGrid } from '../components/Analysis/DataGrid';
import { TransformationTimeline } from '../components/Analysis/TransformationTimeline';
import { CreatorFooter } from '../components/CreatorFooter';
import { exportBrandedPDF, exportToExcel } from '../lib/exportUtils';
import { generateAInarrative } from '../lib/narrativeEngine';


interface Props { lang: Lang; }

const T = {
  ar: {
    title: 'منصة التحليل المتقدمة',
    healthTitle: 'مؤشر صحة البيانات',
    insights: 'رؤى الذكاء الاصطناعي',
    export: 'تصدير التقارير',
    undo: 'مركز التراجع',
    builder: 'صانع المخططات',
    records: 'سجل',
    columns: 'عمود',
  },
  en: {
    title: 'Advanced Analyst Suite',
    healthTitle: 'Data Health Score',
    insights: 'AI Narrative Insights',
    export: 'Executive Export',
    undo: 'Transformation Center',
    builder: 'Custom Chart Builder',
    records: 'Records',
    columns: 'Columns',
  }
};

export const DashboardPage: React.FC<Props> = ({ lang }) => {
  const { info } = useKimitData();
  const { removeDuplicates, fillMissingValues, getHealthStats } = useKimitEngine();
  
  const [exporting, setExporting] = useState(false);
  const [customCharts, setCustomCharts] = useState<ChartInfo[]>([]);
  const [builder, setBuilder] = useState<{ x: string; y: string; type: ChartInfo['type'] }>({ x: '', y: '', type: 'bar' });
  const [activeChartFilter, setActiveChartFilter] = useState<string>('');
  
  const health = getHealthStats();
  const t = T[lang];
  const insights = info ? generateAInarrative(info) : [];

  if (!info) return <div className="p-20 text-center">No Data found. Please upload a file.</div>;

  const handleAddCustomChart = () => {
    if (!builder.x || !builder.y) return;
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

  const handleFullPDF = async () => {
    setExporting(true);
    await exportBrandedPDF('dashboard-main-content', `Kimit_Report_${info.filename}.pdf`);
    setExporting(false);
  };

  const handleExcel = () => {
    exportToExcel(info.workData, `Kimit_Data_${info.filename}.xlsx`);
  };

  return (
    <div className="dash-layout-container">
      
      {/* 1. Header & Undo Engine */}
      <div className="dash-header-wrap">
        <div className="title-group">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="page-title" 
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <Sparkles className="text-primary" /> {t.title}
          </motion.h2>
          <p className="page-sub">{info.filename} • {info.rows.toLocaleString()} {t.records}</p>
        </div>
        
        <div className="actions-group">
          <button className="premium-button secondary" onClick={handleExcel}>
             <Database size={16} /> Excel
          </button>
          <button className="premium-button" onClick={handleFullPDF} disabled={exporting}>
             {exporting ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} 
             {lang === 'ar' ? 'تصدير PDF' : 'Branded PDF'}
          </button>
        </div>
      </div>

      <TransformationTimeline />

      <div className="dash-main-grid">
        
        {/* Left Column: Data & Charts */}
        <div className="main-analytics-flow" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* KPI Mini Row */}
          <div className="kpi-mini-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
            <div className="glass-card p-4" style={{ textAlign: 'center' }}>
               <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '24px' }}>{info.rows}</div>
               <div style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase' }}>{t.records}</div>
            </div>
            <div className="glass-card p-4" style={{ textAlign: 'center' }}>
               <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '24px' }}>{info.columns.length}</div>
               <div style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase' }}>{t.columns}</div>
            </div>
            <div className="glass-card p-4" style={{ textAlign: 'center' }}>
               <div style={{ color: health.color, fontWeight: 800, fontSize: '24px' }}>{health.score}%</div>
               <div style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase' }}>{health.label}</div>
            </div>
          </div>

          {/* Data Grid Section */}
          <div className="glass-panel" style={{ height: '45vh', minHeight: '300px', padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <DataGrid data={info.workData} columns={info.columns.map(c => c.name)} externalFilter={activeChartFilter} />
          </div>

          {/* Chart Section */}
          <div className="glass-panel p-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{t.builder}</h3>
               {activeChartFilter && (
                 <button onClick={() => setActiveChartFilter('')} style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 8px', borderRadius: '4px' }}>
                   Clear Filters
                 </button>
               )}
            </div>
            
            <div className="builder-controls">
               <select className="kimit-select" value={builder.x} onChange={e => setBuilder({...builder, x: e.target.value})}>
                 <option value="">X-Axis</option>
                 {info.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
               </select>
               <select className="kimit-select" value={builder.y} onChange={e => setBuilder({...builder, y: e.target.value})}>
                 <option value="">Y-Axis</option>
                 {info.columns.filter(c => c.type === 'numeric').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
               </select>
               <select className="kimit-select" value={builder.type} onChange={e => setBuilder({...builder, type: e.target.value as ChartInfo['type']})}>
                 <option value="bar">Bar Chart</option>
                 <option value="line">Line Chart</option>
                 <option value="pie">Pie Chart</option>
               </select>
               <button className="premium-button" onClick={handleAddCustomChart}><Plus size={16} /> Add</button>
            </div>

            <div className="charts-display-grid">
               {customCharts.map((ch, i) => (
                 <div key={i} className="relative group">
                   <DataChart chart={ch} onFilterClick={(_, v) => setActiveChartFilter(v)} />
                   <button onClick={() => setCustomCharts(customCharts.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20 p-1 rounded text-red-500"><Trash2 size={14} /></button>
                 </div>
               ))}
               {info.charts.slice(0, 4).map((ch, i) => <DataChart key={i} chart={ch} onFilterClick={(_, v) => setActiveChartFilter(v)} />)}
            </div>
          </div>
        </div>

        {/* Right Column: AI Insights & Tools */}
        <div className="sidebar-analytics" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Health Gauge */}
          <div className="glass-panel p-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), transparent)' }}>
             <h4 style={{ fontSize: '14px', opacity: 0.7, marginBottom: 15 }}>{t.healthTitle}</h4>
             <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={health.color} strokeWidth="3" strokeDasharray={`${health.score}, 100`} />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 800, fontSize: '24px', color: health.color }}>
                  {health.score}%
                </div>
             </div>
             <p style={{ marginTop: 15, fontSize: '12px', color: '#94a3b8' }}>Overall Data Integrity: <b>{health.label}</b></p>
          </div>

          {/* AI Narrative */}
          <div className="glass-panel p-6">
             <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                <ShieldCheck className="text-primary" size={20} />
                <h4 style={{ margin: 0, fontSize: '15px' }}>{t.insights}</h4>
             </div>
             <div className="insights-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.map((ins, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className={`insight-card ${ins.type}`}
                    style={{ 
                      padding: '12px', 
                      borderRadius: '8px', 
                      background: ins.type === 'positive' ? 'rgba(16, 185, 129, 0.05)' : ins.type === 'warning' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(56, 189, 248, 0.05)',
                      borderLeft: `3px solid ${ins.type === 'positive' ? '#10b981' : ins.type === 'warning' ? '#ef4444' : '#38bdf8'}`
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 4 }}>{ins.title}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8, lineHeight: 1.4 }}>{ins.description}</div>
                  </motion.div>
                ))}
             </div>
          </div>

          {/* Quick Transformation Tools */}
          <div className="glass-panel p-6">
             <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                <Activity className="text-blue-400" size={20} />
                <h4 style={{ margin: 0, fontSize: '15px' }}>Smart Transformations</h4>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={removeDuplicates} className="action-row-btn">
                   <span>Remove Duplicates</span>
                   <Trash2 size={14} />
                </button>
                <button onClick={fillMissingValues} className="action-row-btn">
                   <span>Auto-Fill Missing</span>
                   <Plus size={14} />
                </button>
             </div>
          </div>

        </div>
      </div>

      <CreatorFooter lang={lang} />

      <style>{`
        .glass-panel { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; backdrop-filter: blur(10px); }
        .glass-card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; }
        .premium-button { display: flex; align-items: center; gap: 8; background: var(--primary); color: #000; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: all 0.2s; }
        .premium-button:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3); }
        .premium-button.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .kimit-select { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: #f1f5f9; padding: 8px 12px; border-radius: 8px; font-size: 13px; outline: none; }
        .action-row-btn { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 12px 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; color: #cbd5e1; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .action-row-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
      `}</style>
    </div>
  );
};
