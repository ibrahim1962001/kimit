import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getSharedDashboard, type SharedDashboardDoc } from '../lib/dashboardShare';
import './smart-dashboard-redesign.css';

function readShareId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

export const SharedDashboardPage: React.FC = () => {
  const [doc, setDoc] = useState<SharedDashboardDoc | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    const id = readShareId();
    if (!id) { setStatus('notfound'); return; }
    let cancelled = false;
    getSharedDashboard(id)
      .then(d => {
        if (cancelled) return;
        if (!d) { setStatus('notfound'); return; }
        setDoc(d);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  const isAr = doc?.isAr ?? false;
  const dark = doc?.theme === 'dark';

  const meta = useMemo(() => {
    const owner = doc?.ownerName?.trim() || (isAr ? 'مستخدم Kimit' : 'Kimit user');
    const initial = (owner[0] || 'K').toUpperCase();
    return { owner, initial };
  }, [doc, isAr]);

  if (status === 'loading') {
    return (
      <div className="exp-dash-overlay" style={{ position: 'static' }}>
        <div className="exp-dash--overlay-panel" style={{ textAlign: 'center', paddingTop: 80 }}>
          <Loader2 size={34} className="analyzing-spinner" />
          <p style={{ marginTop: 14 }}>{isAr ? 'جاري تحميل اللوحة…' : 'Loading dashboard…'}</p>
        </div>
      </div>
    );
  }

  if (status === 'notfound' || status === 'error') {
    return (
      <div className="exp-dash-overlay" style={{ position: 'static' }}>
        <div className="exp-dash--overlay-panel" style={{ textAlign: 'center', paddingTop: 80 }}>
          <AlertTriangle size={40} color="#f59e0b" />
          <h2 style={{ marginTop: 12 }}>
            {status === 'notfound'
              ? (isAr ? 'الرابط غير موجود أو منتهي' : 'Dashboard link not found')
              : (isAr ? 'تعذّر تحميل اللوحة' : 'Could not load dashboard')}
          </h2>
          <a href="/" className="exp-dash-dl" style={{ marginTop: 16, display: 'inline-flex', textDecoration: 'none' }}>
            <ArrowLeft size={15} /> {isAr ? 'الذهاب إلى Kimit' : 'Go to Kimit'}
          </a>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className={`exp-dash-overlay ${dark ? 'exp-dash-overlay--dark' : ''}`} style={{ position: 'static' }} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="exp-dash--overlay-panel">
        <section className="exp-dash-hero">
          <div className="exp-dash-hero-top">
            <div>
              {doc.brandLogoDataUrl ? <img src={doc.brandLogoDataUrl} alt="" className="exp-dash-brand" /> : null}
              <h1>{doc.datasetName}</h1>
              <span className="exp-dash-badge">{doc.sheetTypeLabel || (isAr ? 'لوحة مشتركة' : 'Shared dashboard')}</span>
            </div>
            <div className="exp-dash-user">
              <div className="exp-dash-avatar"><span>{meta.initial}</span></div>
              <div>
                <div className="exp-dash-user-name">{meta.owner}</div>
                <div className="exp-dash-user-email">{isAr ? 'عبر Kimit' : 'via Kimit'}</div>
              </div>
            </div>
          </div>
          <p className="exp-dash-live">{isAr ? 'لوحة تفاعلية للقراءة فقط' : 'Read-only interactive dashboard'}</p>
        </section>

        {(doc.kpis?.length ?? 0) > 0 && (
          <div className="exp-dash-kpis">
            {doc.kpis.map(k => (
              <div key={k.title} className="exp-dash-kpi">
                <div className="exp-dash-kpi-label">{k.title}</div>
                <div className="exp-dash-kpi-value">{k.value}</div>
                {k.sub ? <div className="exp-dash-kpi-sub">{k.sub}</div> : null}
              </div>
            ))}
          </div>
        )}

        <div className="exp-dash-charts sd2-charts-grid">
          {doc.charts.map((chart, i) => (
            <article key={`${chart.title}-${i}`} className="sd2-chart-card exp-dash-chart-card">
              <h3>{chart.title}</h3>
              {chart.subtitle ? <p className="sd2-chart-sub">{chart.subtitle}</p> : null}
              <ReactECharts option={chart.option} notMerge lazyUpdate style={{ width: '100%', height: 240, minHeight: 200 }} opts={{ renderer: 'canvas' }} />
            </article>
          ))}
        </div>

        <footer className="exp-dash-footer">
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>{isAr ? 'صُنع بواسطة KIMIT.CLOUD' : 'Made with KIMIT.CLOUD'}</a>
        </footer>
      </div>
    </div>
  );
};
