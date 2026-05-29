import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, Download, X } from 'lucide-react';
import type { SmartDashboardBundlePayload } from '../lib/smartDashboardHtmlExport';

interface Props {
  payload: SmartDashboardBundlePayload;
  onClose: () => void;
}

export const ExportedDashboardOverlay: React.FC<Props> = ({ payload, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const isAr = payload.isAr ?? false;
  const dark = payload.theme === 'dark';

  const meta = useMemo(() => {
    const userName = payload.user?.name?.trim() || (isAr ? 'مستخدم' : 'User');
    const userEmail = payload.user?.email?.trim() || (isAr ? 'زائر' : 'Guest');
    const userPhoto = payload.user?.photoURL?.trim() || '';
    const initial = (userName[0] || 'U').toUpperCase();
    return { userName, userEmail, userPhoto, initial };
  }, [payload, isAr]);

  const handleRedownload = async () => {
    setDownloading(true);
    setHint(isAr ? 'جاري التنزيل…' : 'Downloading…');
    try {
      const { exportSmartDashboardBundle } = await import('../lib/smartDashboardHtmlExport');
      const result = await exportSmartDashboardBundle(payload, { openPreview: false });
      setHint(
        result.mode === 'zip'
          ? isAr
            ? 'تم تنزيل ZIP'
            : 'ZIP downloaded'
          : isAr
            ? 'تم تنزيل Excel و HTML'
            : 'Excel + HTML downloaded',
      );
    } catch {
      setHint(isAr ? 'فشل التنزيل' : 'Download failed');
    } finally {
      setDownloading(false);
      window.setTimeout(() => setHint(null), 8000);
    }
  };

  return (
    <div
      className={`exp-dash-overlay ${dark ? 'exp-dash-overlay--dark' : ''}`}
      dir={isAr ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? 'معاينة الداشبورد' : 'Dashboard preview'}
    >
      <div className="exp-dash exp-dash--overlay-panel">
        <header className="exp-dash-toolbar">
          <button type="button" className="exp-dash-back" onClick={onClose}>
            <ArrowLeft size={16} />
            {isAr ? 'إغلاق المعاينة' : 'Close preview'}
          </button>
          <div className="exp-dash-toolbar-actions">
            <button
              type="button"
              className="exp-dash-dl"
              disabled={downloading}
              onClick={() => void handleRedownload()}
            >
              <Download size={14} />
              {downloading ? (isAr ? 'جاري التنزيل…' : 'Downloading…') : isAr ? 'تنزيل الملفات' : 'Download files'}
            </button>
            <button type="button" className="exp-dash-icon-close" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'}>
              <X size={18} />
            </button>
          </div>
        </header>
        {hint && <p className="exp-dash-hint">{hint}</p>}

        <section className="exp-dash-hero">
          <div className="exp-dash-hero-top">
            <div>
              {payload.brandLogoDataUrl ? (
                <img src={payload.brandLogoDataUrl} alt="" className="exp-dash-brand" />
              ) : null}
              <h1>{payload.datasetName}</h1>
              <span className="exp-dash-badge">
                {payload.sheetTypeLabel || (isAr ? 'عام' : 'General')}
              </span>
            </div>
            <div className="exp-dash-user">
              <div className="exp-dash-avatar">
                {meta.userPhoto ? (
                  <img src={meta.userPhoto} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span>{meta.initial}</span>
                )}
              </div>
              <div>
                <div className="exp-dash-user-name">{meta.userName}</div>
                <div className="exp-dash-user-email">{meta.userEmail}</div>
              </div>
            </div>
          </div>
          <p className="exp-dash-live">
            {isAr ? 'معاينة تفاعلية — تعمل على الموبايل' : 'Live preview — works on mobile'}
          </p>
        </section>

        {(payload.kpis?.length ?? 0) > 0 && (
          <div className="exp-dash-kpis">
            {payload.kpis!.map(k => (
              <div key={k.title} className="exp-dash-kpi">
                <div className="exp-dash-kpi-label">{k.title}</div>
                <div className="exp-dash-kpi-value">{k.value}</div>
                {k.sub ? <div className="exp-dash-kpi-sub">{k.sub}</div> : null}
              </div>
            ))}
          </div>
        )}

        <div className="exp-dash-charts sd2-charts-grid">
          {payload.charts.map((chart, i) => (
            <article key={`${chart.title}-${i}`} className="sd2-chart-card exp-dash-chart-card">
              <h3>{chart.title}</h3>
              {chart.subtitle ? <p className="sd2-chart-sub">{chart.subtitle}</p> : null}
              <ReactECharts
                option={chart.option}
                notMerge
                lazyUpdate
                style={{ width: '100%', height: 240, minHeight: 200 }}
                opts={{ renderer: 'canvas' }}
              />
            </article>
          ))}
        </div>

        <footer className="exp-dash-footer">KIMIT.CLOUD</footer>
      </div>
    </div>
  );
};
