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
  const [errDetail, setErrDetail] = useState<string>('');
  const shareId = readShareId();

  useEffect(() => {
    if (!shareId) { setStatus('notfound'); return; }
    let cancelled = false;
    getSharedDashboard(shareId)
      .then(d => {
        if (cancelled) return;
        if (!d) { setStatus('notfound'); return; }
        setDoc(d);
        setStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setErrDetail(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [shareId]);

  const isAr = doc?.isAr ?? false;
  const dark = doc?.theme === 'dark';

  const meta = useMemo(() => {
    const owner = doc?.ownerName?.trim() || (isAr ? 'مستخدم Kimit' : 'Kimit user');
    const initial = (owner[0] || 'K').toUpperCase();
    return { owner, initial };
  }, [doc, isAr]);

  const fullScreen: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#f1f5f9',
    color: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '24px',
    gap: '12px',
  };

  if (status === 'loading') {
    return (
      <div style={fullScreen}>
        <Loader2 size={34} className="analyzing-spinner" color="#0d9488" />
        <p style={{ fontSize: 15 }}>{isAr ? 'جاري تحميل اللوحة…' : 'Loading dashboard…'}</p>
      </div>
    );
  }

  if (status === 'notfound' || status === 'error') {
    const noId = !shareId;
    return (
      <div style={fullScreen}>
        <AlertTriangle size={44} color="#f59e0b" />
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          {noId
            ? (isAr ? 'لا يوجد رابط لوحة' : 'No dashboard link')
            : status === 'notfound'
              ? (isAr ? 'الرابط غير موجود أو منتهي' : 'Dashboard link not found')
              : (isAr ? 'تعذّر تحميل اللوحة' : 'Could not load dashboard')}
        </h2>
        <p style={{ margin: 0, maxWidth: 460, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          {noId
            ? (isAr
                ? 'هذا الرابط لا يحتوي على معرّف لوحة. افتح الرابط الكامل الذي يبدأ بـ /shared?id=…'
                : 'This link has no dashboard id. Open the full link that starts with /shared?id=…')
            : status === 'notfound'
              ? (isAr ? 'تأكد من نسخ الرابط كاملاً.' : 'Make sure the full link was copied.')
              : (isAr ? 'حدث خطأ أثناء التحميل.' : 'An error occurred while loading.')}
        </p>
        {status === 'error' && errDetail && (
          <code style={{ fontSize: 11, color: '#b91c1c', wordBreak: 'break-all', maxWidth: 460 }}>{errDetail}</code>
        )}
        <a
          href="/"
          style={{
            marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg, #0d9488, #2563eb)', color: '#fff',
            padding: '10px 18px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13,
          }}
        >
          <ArrowLeft size={15} /> {isAr ? 'الذهاب إلى Kimit' : 'Go to Kimit'}
        </a>
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
