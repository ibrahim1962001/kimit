import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, Download } from 'lucide-react';
import {
  clearExportedDashboardPreview,
  readExportedDashboardPreview,
} from '../lib/smartDashboardExportPreview';
import { exportSmartDashboardBundle } from '../lib/smartDashboardHtmlExport';
import type { SmartDashboardBundlePayload } from '../lib/smartDashboardHtmlExport';
import './smart-dashboard-redesign.css';
import './exported-dashboard.css';

interface Props {
  onBack: () => void;
}

export const ExportedDashboardPage: React.FC<Props> = ({ onBack }) => {
  const [payload, setPayload] = useState<SmartDashboardBundlePayload | null>(() =>
    readExportedDashboardPreview(),
  );
  const [downloading, setDownloading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const isAr = payload?.isAr ?? false;
  const dark = payload?.theme === 'dark';

  useEffect(() => {
    const onOpen = () => setPayload(readExportedDashboardPreview());
    window.addEventListener('kimit:open-export-preview', onOpen);
    return () => window.removeEventListener('kimit:open-export-preview', onOpen);
  }, []);

  const meta = useMemo(() => {
    if (!payload) return null;
    const userName = payload.user?.name?.trim() || (isAr ? 'مستخدم' : 'User');
    const userEmail = payload.user?.email?.trim() || (isAr ? 'زائر' : 'Guest');
    const userPhoto = payload.user?.photoURL?.trim() || '';
    const initial = (userName[0] || 'U').toUpperCase();
    return { userName, userEmail, userPhoto, initial };
  }, [payload, isAr]);

  if (!payload || !meta) {
    return (
      <div className="exp-dash exp-dash--empty">
        <p>{isAr ? 'لا توجد معاينة. صدّر من الداشبورد الذكي.' : 'No preview. Export from Smart Dashboard.'}</p>
        <button type="button" className="exp-dash-back" onClick={onBack}>
          <ArrowLeft size={16} />
          {isAr ? 'رجوع' : 'Back'}
        </button>
      </div>
    );
  }

  const handleBack = () => {
    onBack();
  };

  const handleRedownload = async () => {
    setDownloading(true);
    setHint(isAr ? 'جاري التنزيل…' : 'Downloading…');
    try {
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
    <div className={`exp-dash ${dark ? 'exp-dash--dark' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
      <header className="exp-dash-toolbar">
        <button type="button" className="exp-dash-back" onClick={handleBack}>
          <ArrowLeft size={16} />
          {isAr ? 'رجوع للداشبورد' : 'Back to dashboard'}
        </button>
        <button
          type="button"
          className="exp-dash-dl"
          disabled={downloading}
          onClick={() => void handleRedownload()}
        >
          <Download size={14} />
          {downloading ? (isAr ? 'جاري التنزيل…' : 'Downloading…') : isAr ? 'تنزيل الملفات' : 'Download files'}
        </button>
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
          {isAr ? 'معاينة تفاعلية — تعمل على الموبايل والكمبيوتر' : 'Live interactive preview — mobile & desktop'}
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
  );
};

export function cleanupExportedDashboardPreview(): void {
  clearExportedDashboardPreview();
}
