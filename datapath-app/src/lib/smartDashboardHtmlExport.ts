import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { buildSmartDashboardWorkbook, type SmartDashboardExcelPayload } from './exportUtils';
import { openExportedDashboardPreview } from './smartDashboardExportPreview';

export interface SmartDashboardExportChart {
  title: string;
  subtitle?: string;
  option: object;
}

export interface SmartDashboardBundlePayload extends SmartDashboardExcelPayload {
  charts: SmartDashboardExportChart[];
  theme?: 'light' | 'dark';
  isAr?: boolean;
  sheetTypeLabel?: string;
  brandLogoDataUrl?: string;
  user?: {
    name?: string;
    email?: string;
    photoURL?: string;
  };
}

export type SmartDashboardBundleResult = {
  mode: 'zip' | 'files' | 'preview-only';
  baseName: string;
  previewOpened: boolean;
};

export type SmartDashboardBundleOptions = {
  /** When false, only download files (e.g. re-download from preview page). Default true. */
  openPreview?: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildStandaloneDashboardHtml(payload: SmartDashboardBundlePayload): string {
  const isAr = payload.isAr ?? false;
  const theme = payload.theme ?? 'light';
  const dark = theme === 'dark';
  const createdAt = new Date();
  const embed = JSON.stringify({
    datasetName: payload.datasetName,
    generated: createdAt.toISOString(),
    theme,
    kpis: payload.kpis ?? [],
    insights: payload.insights ?? [],
    quality: payload.quality ?? null,
    charts: payload.charts,
    sheetTypeLabel: payload.sheetTypeLabel ?? null,
    brandLogoDataUrl: payload.brandLogoDataUrl ?? null,
    user: payload.user ?? null,
  });
  const brandLogo = payload.brandLogoDataUrl?.trim() || '';

  const userName = payload.user?.name?.trim() || (isAr ? 'مستخدم' : 'User');
  const userEmail = payload.user?.email?.trim() || (isAr ? 'زائر' : 'Guest');
  const userPhoto = payload.user?.photoURL?.trim() || '';
  const userInitial = (userName[0] || 'U').toUpperCase();
  const userCard = `
    <div class="hero-user" title="${escapeHtml(userEmail)}">
      <div class="hero-user-avatar-wrap">
        ${
          userPhoto
            ? `<img src="${escapeHtml(userPhoto)}" alt="${escapeHtml(userName)}" class="hero-user-avatar" referrerpolicy="no-referrer" />`
            : `<span class="hero-user-fallback">${escapeHtml(userInitial)}</span>`
        }
        <span class="hero-user-status" aria-hidden="true"></span>
      </div>
      <div class="hero-user-meta">
        <div class="hero-user-name">${escapeHtml(userName)}</div>
        <div class="hero-user-email">${escapeHtml(userEmail)}</div>
      </div>
    </div>`;

  const kpiHtml = (payload.kpis ?? [])
    .map(
      k => `
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(k.title)}</div>
      <div class="kpi-value">${escapeHtml(String(k.value))}</div>
      ${k.sub ? `<div class="kpi-sub">${escapeHtml(k.sub)}</div>` : ''}
    </div>`,
    )
    .join('');

  const chartCards = payload.charts
    .map(
      (c, i) => `
    <section class="chart-card">
      <h3>${escapeHtml(c.title)}</h3>
      ${c.subtitle ? `<p class="chart-sub">${escapeHtml(c.subtitle)}</p>` : ''}
      <div id="chart-${i}" class="chart-host"></div>
    </section>`,
    )
    .join('');

  const loadErrorAr =
    'تعذّر تحميل مكتبة الرسوم. تأكد من اتصال الإنترنت ثم أعد فتح هذا الملف في Chrome أو Safari.';
  const loadErrorEn =
    'Could not load chart library. Connect to the internet and reopen this file in Chrome or Safari.';

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>KIMIT — ${escapeHtml(payload.datasetName)}</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js" crossorigin="anonymous"><\/script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: ${dark ? '#0f172a' : '#f1f5f9'};
      color: ${dark ? '#e2e8f0' : '#0f172a'};
      -webkit-text-size-adjust: 100%;
    }
    .wrap { max-width: 1280px; margin: 0 auto; padding: 24px 20px 48px; }
    .hero {
      background: linear-gradient(135deg, #0d9488, #2563eb);
      color: #fff;
      border-radius: 16px;
      padding: 22px 24px;
      margin-bottom: 20px;
    }
    .hero-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .hero-user {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 12px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.28);
      min-width: 170px;
      max-width: 100%;
    }
    .hero-user-avatar-wrap {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.2);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .hero-user-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .hero-user-fallback {
      font-size: 13px;
      font-weight: 800;
      color: #fff;
    }
    .hero-user-status {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #22c55e;
      border: 2px solid rgba(13,148,136,0.9);
    }
    .hero-user-meta {
      min-width: 0;
    }
    .hero-user-name, .hero-user-email {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
      line-height: 1.2;
    }
    .hero-user-name {
      font-size: 12px;
      font-weight: 700;
    }
    .hero-user-email {
      font-size: 11px;
      opacity: 0.85;
    }
    .hero-brand {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      object-fit: contain;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.35);
      padding: 4px;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.2);
      font-size: 0.75rem;
      font-weight: 600;
    }
    .load-error {
      background: ${dark ? '#422006' : '#fff7ed'};
      color: ${dark ? '#fdba74' : '#9a3412'};
      border: 1px solid ${dark ? '#ea580c' : '#fed7aa'};
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi {
      background: ${dark ? '#1e293b' : '#fff'};
      border: 1px solid ${dark ? '#334155' : '#e2e8f0'};
      border-radius: 12px;
      padding: 14px 16px;
    }
    .kpi-label { font-size: 0.72rem; color: ${dark ? '#94a3b8' : '#64748b'}; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-value { font-size: 1.35rem; font-weight: 700; margin-top: 4px; }
    .kpi-sub { font-size: 0.75rem; color: ${dark ? '#94a3b8' : '#64748b'}; margin-top: 4px; }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .chart-card {
      background: ${dark ? '#1e293b' : '#fff'};
      border: 1px solid ${dark ? '#334155' : '#e2e8f0'};
      border-radius: 14px;
      padding: 14px 14px 8px;
      min-height: 300px;
    }
    .chart-card h3 { margin: 0 0 4px; font-size: 0.95rem; }
    .chart-sub { margin: 0 0 8px; font-size: 0.78rem; color: ${dark ? '#94a3b8' : '#64748b'}; }
    .chart-host { width: 100%; height: 280px; min-height: 200px; }
    .footer-site {
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 11px;
      color: ${dark ? '#94a3b8' : '#64748b'};
      opacity: 0.9;
    }
    .footer-created-label {
      opacity: 0.85;
    }
    .footer-created-value {
      color: ${dark ? '#cbd5e1' : '#334155'};
      font-weight: 600;
    }
    @media (max-width: 640px) {
      .wrap { padding: 16px 12px 32px; }
      .hero { padding: 16px; border-radius: 12px; }
      .charts { grid-template-columns: 1fr; }
      .chart-card { min-height: 260px; }
      .chart-host { height: 220px; }
      .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hero-user-name, .hero-user-email { max-width: 120px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="hero-head">
        <div>
          ${brandLogo ? `<img src="${escapeHtml(brandLogo)}" alt="Brand Logo" class="hero-brand" />` : ''}
        </div>
        ${userCard}
      </div>
      <span class="badge">${escapeHtml(payload.sheetTypeLabel || (isAr ? 'عام' : 'General'))}</span>
    </header>
    <div id="load-error-slot"></div>
    ${kpiHtml ? `<div class="kpi-grid">${kpiHtml}</div>` : ''}
    <div class="charts">${chartCards}</div>
    <p class="footer-site">
      <span>KIMIT.CLOUD</span>
      <span>
        <span class="footer-created-label">${isAr ? 'تاريخ الإنشاء' : 'Created on'}</span>
        <span class="footer-created-value"> ${createdAt.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </span>
    </p>
  </div>
  <script type="application/json" id="kimit-payload">${embed.replace(/</g, '\\u003c')}<\/script>
  <script>
    const payload = JSON.parse(document.getElementById('kimit-payload').textContent);
    const loadErrorMsg = ${JSON.stringify(isAr ? loadErrorAr : loadErrorEn)};
    const instances = [];

    function showLoadError() {
      var slot = document.getElementById('load-error-slot');
      if (!slot || slot.dataset.filled) return;
      slot.dataset.filled = '1';
      slot.innerHTML = '<p class="load-error">' + loadErrorMsg + '</p>';
    }

    function initCharts() {
      if (!window.echarts) {
        showLoadError();
        return;
      }
      payload.charts.forEach(function (chart, i) {
        var el = document.getElementById('chart-' + i);
        if (!el) return;
        var inst = echarts.init(el, null, { renderer: 'canvas' });
        inst.setOption(chart.option, true);
        instances.push(inst);
      });
      window.setTimeout(function () {
        instances.forEach(function (c) { c.resize(); });
      }, 350);
    }

    function waitForEcharts(attempts) {
      if (window.echarts) {
        initCharts();
        return;
      }
      if (attempts <= 0) {
        showLoadError();
        return;
      }
      window.setTimeout(function () { waitForEcharts(attempts - 1); }, 250);
    }

    function onReady() {
      waitForEcharts(24);
    }

    window.addEventListener('resize', function () {
      instances.forEach(function (c) { c.resize(); });
    });
    window.addEventListener('orientationchange', function () {
      window.setTimeout(function () {
        instances.forEach(function (c) { c.resize(); });
      }, 300);
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  <\/script>
</body>
</html>`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function isMobileExportContext(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

function buildExportReadme(baseName: string, isAr?: boolean): string {
  if (isAr) {
    return [
      'KIMIT — تصدير الداشبورد الذكي',
      '',
      '1. فك ضغط هذا الملف.',
      `2. افتح "${baseName}.html" في Chrome أو Safari (يحتاج إنترنت لعرض الرسوم).`,
      `3. ملف "${baseName}.xlsx" يحتوي على البيانات والجداول.`,
    ].join('\n');
  }
  return [
    'KIMIT — Smart Dashboard export',
    '',
    '1. Unzip this file.',
    `2. Open "${baseName}.html" in Chrome or Safari (internet required for charts).`,
    `3. "${baseName}.xlsx" contains data and pivot-ready sheets.`,
  ].join('\n');
}

const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/** Excel + HTML download; opens in-app live preview first (mobile-safe). */
export async function exportSmartDashboardBundle(
  payload: SmartDashboardBundlePayload,
  options: SmartDashboardBundleOptions = {},
): Promise<SmartDashboardBundleResult> {
  const openPreview = options.openPreview !== false;
  const baseName = (payload.filename ?? `Smart_Dashboard_${payload.datasetName}`).replace(/\.xlsx$/i, '');

  if (openPreview) {
    openExportedDashboardPreview(payload);
  }

  const html = buildStandaloneDashboardHtml(payload);
  const workbook = buildSmartDashboardWorkbook({ ...payload, filename: `${baseName}.xlsx` });

  if (isMobileExportContext()) {
    const zip = new JSZip();
    zip.file(
      `${baseName}.xlsx`,
      XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }),
    );
    zip.file(`${baseName}.html`, html);
    zip.file('README.txt', buildExportReadme(baseName, payload.isAr));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${baseName}.zip`);
    return { mode: 'zip', baseName, previewOpened: openPreview };
  }

  XLSX.writeFile(workbook, `${baseName}.xlsx`);
  await delay(450);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${baseName}.html`);
  return { mode: 'files', baseName, previewOpened: openPreview };
}

/** @deprecated Use exportSmartDashboardBundle — kept for direct HTML-only downloads. */
export function downloadTextFile(content: string, filename: string, mime = 'text/html;charset=utf-8'): void {
  downloadBlob(new Blob([content], { type: mime }), filename);
}
